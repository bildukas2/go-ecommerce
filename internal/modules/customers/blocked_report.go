package customers

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

const blockedReportMessageMaxRunes = 1000

var htmlTagPattern = regexp.MustCompile(`<[^>]+>`)

type blockedReportRequest struct {
	Email   string `json:"email"`
	Message string `json:"message"`
}

func (m *module) handleBlockedReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/support/blocked-report" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	reportStore, ok := m.store.(interface {
		CreateBlockedReport(ctx context.Context, in storcustomers.CreateBlockedReportInput) (storcustomers.BlockedReport, error)
	})
	if !ok {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var body blockedReportRequest
	if err := decodeAuthRequest(r, &body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" {
		platformhttp.Error(w, http.StatusBadRequest, "email is required")
		return
	}
	if _, err := mail.ParseAddress(email); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid email")
		return
	}
	message, err := sanitizeBlockedReportMessage(body.Message)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	ip := requestIP(r)
	if ip == "" {
		ip = "unknown"
	}
	if _, err := reportStore.CreateBlockedReport(r.Context(), storcustomers.CreateBlockedReportInput{
		IP:      ip,
		Email:   email,
		Message: message,
	}); err != nil {
		if errors.Is(err, storcustomers.ErrInvalid) {
			platformhttp.Error(w, http.StatusBadRequest, "invalid report payload")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "blocked report submit error")
		return
	}

	securitySeverity := "security"
	m.writeCustomerActionLog(r, "blocked.report_submitted", nil, &securitySeverity, map[string]any{
		"ip":      ip,
		"email":   email,
		"message": message,
	})
	_ = platformhttp.JSON(w, http.StatusCreated, map[string]any{"status": "ok"})
}

func sanitizeBlockedReportMessage(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("message is required")
	}
	if utf8.RuneCountInString(trimmed) > blockedReportMessageMaxRunes {
		return "", errors.New("message is too long (max 1000 characters)")
	}
	if htmlTagPattern.MatchString(trimmed) {
		return "", errors.New("html tags are not allowed")
	}

	var builder strings.Builder
	builder.Grow(len(trimmed))
	removedHidden := false
	for _, r := range trimmed {
		if isAllowedReportRune(r) {
			builder.WriteRune(r)
			continue
		}
		removedHidden = true
	}

	if removedHidden {
		return "", errors.New("hidden/control characters are not allowed")
	}
	out := strings.TrimSpace(builder.String())
	if out == "" {
		return "", errors.New("message is required")
	}
	return out, nil
}

func isAllowedReportRune(r rune) bool {
	if r == '\n' || r == '\r' || r == '\t' {
		return true
	}
	if unicode.IsControl(r) {
		return false
	}
	if unicode.Is(unicode.Cf, r) {
		return false
	}
	return r != utf8.RuneError
}
