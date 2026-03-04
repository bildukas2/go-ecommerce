package admin

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"goecommerce/internal/modules/adminauth"
	platformhttp "goecommerce/internal/platform/http"
	platformversion "goecommerce/internal/platform/version"
)

const (
	updateConfirmText = "UPDATE"
	maxUpdateLogBytes = 200000
)

type systemUpdateRunRequest struct {
	Channel     string `json:"channel"`
	ConfirmText string `json:"confirm_text"`
}

type systemUpdateJob struct {
	ID                string     `json:"id"`
	Status            string     `json:"status"`
	Channel           string     `json:"channel"`
	CurrentVersion    string     `json:"current_version"`
	LatestVersion     string     `json:"latest_version"`
	RequestedBy       string     `json:"requested_by_email"`
	Command           string     `json:"command"`
	Log               string     `json:"log"`
	Error             string     `json:"error"`
	TriggeredAt       time.Time  `json:"triggered_at"`
	StartedAt         *time.Time `json:"started_at,omitempty"`
	FinishedAt        *time.Time `json:"finished_at,omitempty"`
	APIRestartPlanned bool       `json:"api_restart_planned"`
}

func (m *module) handleSystemUpdateCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	m.handleVersionCheck(w, r)
}

func (m *module) handleSystemUpdateRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if m.db == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if _, err := os.Stat(m.updateScriptPath); err != nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "update script unavailable")
		return
	}

	var req systemUpdateRunRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	channel, err := validateSystemUpdateRunRequest(req)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	hasRunning, err := m.hasRunningSystemUpdateJob(r.Context())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "update check failed")
		return
	}
	if hasRunning {
		platformhttp.Error(w, http.StatusConflict, "another update job is already running")
		return
	}

	requestedBy := ""
	if user, ok := adminauth.SessionUserFromContext(r.Context()); ok {
		requestedBy = strings.TrimSpace(user.Email)
	}
	if requestedBy == "" {
		requestedBy = "admin"
	}
	currentVersion := platformversion.BackendVersion
	latestVersion := currentVersion
	if latest, err := m.resolveLatestVersion(r.Context(), channel); err == nil && strings.TrimSpace(latest) != "" {
		latestVersion = strings.TrimSpace(latest)
	}

	job, err := m.insertSystemUpdateJob(r.Context(), channel, currentVersion, latestVersion, requestedBy)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to create update job")
		return
	}

	go m.runSystemUpdateJob(job.ID)

	_ = platformhttp.JSON(w, http.StatusAccepted, map[string]any{
		"job": job,
	})
}

func (m *module) handleSystemUpdateJobStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	if m.db == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/admin/system/update/jobs/") {
		http.NotFound(w, r)
		return
	}
	jobID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/admin/system/update/jobs/"))
	if jobID == "" || strings.Contains(jobID, "/") {
		http.NotFound(w, r)
		return
	}

	job, err := m.getSystemUpdateJob(r.Context(), jobID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			platformhttp.Error(w, http.StatusNotFound, "not found")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "failed to load update job")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{"job": job})
}

func (m *module) runSystemUpdateJob(jobID string) {
	ctx := context.Background()
	_ = m.markSystemUpdateJobRunning(ctx, jobID)
	_ = m.appendSystemUpdateJobLog(ctx, jobID, "[system] update started\n")

	cmd := exec.Command("bash", m.updateScriptPath)
	cmd.Dir = m.projectRoot
	cmd.Env = append(os.Environ(),
		"ROOT_DIR="+m.projectRoot,
		"SKIP_API_RESTART=1",
	)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		_ = m.failSystemUpdateJob(ctx, jobID, "failed to capture stdout")
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		_ = m.failSystemUpdateJob(ctx, jobID, "failed to capture stderr")
		return
	}
	if err := cmd.Start(); err != nil {
		_ = m.failSystemUpdateJob(ctx, jobID, "failed to start update command")
		return
	}

	done := make(chan struct{}, 2)
	go m.streamSystemUpdateLog(ctx, jobID, stdout, done)
	go m.streamSystemUpdateLog(ctx, jobID, stderr, done)

	waitErr := cmd.Wait()
	<-done
	<-done
	if waitErr != nil {
		_ = m.failSystemUpdateJob(ctx, jobID, "update command failed")
		return
	}

	_ = m.completeSystemUpdateJob(ctx, jobID)
	_ = m.appendSystemUpdateJobLog(ctx, jobID, "[system] update completed; restarting API service\n")
	_ = exec.Command("systemctl", "restart", "volm-api").Run()
}

func (m *module) streamSystemUpdateLog(ctx context.Context, jobID string, src io.Reader, done chan<- struct{}) {
	defer func() {
		done <- struct{}{}
	}()
	scanner := bufio.NewScanner(src)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}
		_ = m.appendSystemUpdateJobLog(ctx, jobID, line+"\n")
	}
}

func (m *module) hasRunningSystemUpdateJob(ctx context.Context) (bool, error) {
	var exists bool
	err := m.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM admin_update_jobs
			WHERE status IN ('pending', 'running')
		)
	`).Scan(&exists)
	return exists, err
}

func (m *module) insertSystemUpdateJob(ctx context.Context, channel, currentVersion, latestVersion, requestedBy string) (systemUpdateJob, error) {
	command := m.updateScriptPath
	row := m.db.QueryRowContext(ctx, `
		INSERT INTO admin_update_jobs (
			channel,
			status,
			current_version,
			latest_version,
			requested_by_email,
			command,
			log,
			error
		)
		VALUES ($1, 'pending', $2, $3, $4, $5, '', '')
		RETURNING id, status, channel, current_version, latest_version, requested_by_email, command, log, error, triggered_at, started_at, finished_at
	`, channel, currentVersion, latestVersion, requestedBy, command)
	return scanSystemUpdateJob(row)
}

func (m *module) markSystemUpdateJobRunning(ctx context.Context, jobID string) error {
	_, err := m.db.ExecContext(ctx, `
		UPDATE admin_update_jobs
		SET status = 'running', started_at = now(), updated_at = now()
		WHERE id = $1
	`, jobID)
	return err
}

func (m *module) appendSystemUpdateJobLog(ctx context.Context, jobID, chunk string) error {
	if strings.TrimSpace(chunk) == "" {
		return nil
	}
	_, err := m.db.ExecContext(ctx, `
		UPDATE admin_update_jobs
		SET log = right(log || $2, $3), updated_at = now()
		WHERE id = $1
	`, jobID, chunk, maxUpdateLogBytes)
	return err
}

func (m *module) failSystemUpdateJob(ctx context.Context, jobID, errMsg string) error {
	_, err := m.db.ExecContext(ctx, `
		UPDATE admin_update_jobs
		SET status = 'failed', error = $2, finished_at = now(), updated_at = now()
		WHERE id = $1
	`, jobID, strings.TrimSpace(errMsg))
	return err
}

func (m *module) completeSystemUpdateJob(ctx context.Context, jobID string) error {
	_, err := m.db.ExecContext(ctx, `
		UPDATE admin_update_jobs
		SET status = 'success', finished_at = now(), updated_at = now()
		WHERE id = $1
	`, jobID)
	return err
}

func (m *module) getSystemUpdateJob(ctx context.Context, jobID string) (systemUpdateJob, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT id, status, channel, current_version, latest_version, requested_by_email, command, log, error, triggered_at, started_at, finished_at
		FROM admin_update_jobs
		WHERE id = $1
	`, jobID)
	return scanSystemUpdateJob(row)
}

func scanSystemUpdateJob(scanner interface{ Scan(dest ...any) error }) (systemUpdateJob, error) {
	var job systemUpdateJob
	var startedAt sql.NullTime
	var finishedAt sql.NullTime
	err := scanner.Scan(
		&job.ID,
		&job.Status,
		&job.Channel,
		&job.CurrentVersion,
		&job.LatestVersion,
		&job.RequestedBy,
		&job.Command,
		&job.Log,
		&job.Error,
		&job.TriggeredAt,
		&startedAt,
		&finishedAt,
	)
	if err != nil {
		return systemUpdateJob{}, err
	}
	if startedAt.Valid {
		t := startedAt.Time
		job.StartedAt = &t
	}
	if finishedAt.Valid {
		t := finishedAt.Time
		job.FinishedAt = &t
	}
	job.APIRestartPlanned = job.Status == "success"
	return job, nil
}

func validateSystemUpdateRunRequest(req systemUpdateRunRequest) (string, error) {
	channel := strings.ToLower(strings.TrimSpace(req.Channel))
	if channel == "" {
		channel = "prod"
	}
	if channel != "prod" && channel != "dev" {
		return "", errors.New("channel must be one of: prod, dev")
	}
	if strings.TrimSpace(req.ConfirmText) != updateConfirmText {
		return "", errors.New("confirm_text must be UPDATE")
	}
	return channel, nil
}

func (m *module) resolveLatestVersion(ctx context.Context, channel string) (string, error) {
	owner := strings.TrimSpace(os.Getenv("GITHUB_REPO_OWNER"))
	if owner == "" {
		owner = "bildukas2"
	}
	repo := strings.TrimSpace(os.Getenv("GITHUB_REPO_NAME"))
	if repo == "" {
		repo = "go-ecommerce"
	}
	client := &http.Client{Timeout: 5 * time.Second}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if channel == "dev" {
		rawURL := "https://raw.githubusercontent.com/" + owner + "/" + repo + "/refs/heads/main/version.json"
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err != nil {
			return "", err
		}
		if token := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return "", errors.New("non-200 response")
		}
		var payload struct {
			Version string `json:"version"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			return "", err
		}
		return strings.TrimSpace(payload.Version), nil
	}

	apiURL := "https://api.github.com/repos/" + owner + "/" + repo + "/releases/latest"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("non-200 response")
	}
	var payload struct {
		TagName string `json:"tag_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}
	latest := strings.TrimPrefix(strings.TrimSpace(payload.TagName), "v")
	if latest == "" {
		slog.Warn("update: latest release tag is empty")
	}
	return latest, nil
}
