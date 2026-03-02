package adminauth

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
	storadminauth "goecommerce/internal/storage/adminauth"
	"golang.org/x/crypto/bcrypt"
)

const (
	csrfCookieName = "csrf_token"
	csrfTokenBytes = 16
)

type loginRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	CaptchaToken string `json:"captchaToken"`
}

type authErrorResponse struct {
	Error   string            `json:"error"`
	Code    string            `json:"code"`
	Details []ValidationError `json:"details,omitempty"`
}

type authMeResponse struct {
	User SessionUser `json:"user"`
}

func (m *module) handleCSRF(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/admin/auth/csrf" {
		http.NotFound(w, r)
		return
	}
	token := currentOrNewCSRFToken(r)
	http.SetCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
		Secure:   shouldUseSecureCookie(r),
	})
	_ = platformhttp.JSON(w, http.StatusOK, map[string]string{"csrf_token": token})
}

func (m *module) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/auth/login" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil || m.sessions == nil || !m.sessions.Available() {
		platformhttp.Error(w, http.StatusServiceUnavailable, "auth unavailable")
		return
	}
	if m.protect == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "auth unavailable")
		return
	}

	var req loginRequest
	if err := decodeAuthRequest(r, &req); err != nil {
		writeAuthError(w, http.StatusBadRequest, "validation_error", "invalid body", nil)
		return
	}

	email, password, validationErrs := validateLoginRequest(req, m.protect.IsCaptchaRequired())
	if len(validationErrs) > 0 {
		writeAuthError(w, http.StatusBadRequest, "validation_error", "validation failed", validationErrs)
		return
	}
	clientIP := platformhttp.ClientIP(r)
	if allowed, err := m.protect.IsIPAllowed(r.Context(), clientIP); err != nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "auth unavailable")
		return
	} else if !allowed {
		m.protect.SleepFailureDelay()
		writeAuthError(w, http.StatusTooManyRequests, "too_many_attempts", "too many attempts", nil)
		return
	}
	if locked, err := m.protect.IsEmailLocked(r.Context(), email); err != nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "auth unavailable")
		return
	} else if locked {
		m.protect.SleepFailureDelay()
		writeAuthError(w, http.StatusTooManyRequests, "too_many_attempts", "too many attempts", nil)
		return
	}
	if ok, err := m.protect.VerifyCaptcha(r.Context(), req.CaptchaToken, clientIP); err != nil || !ok {
		m.protect.SleepFailureDelay()
		writeAuthError(w, http.StatusBadRequest, "captcha_failed", "captcha failed", nil)
		return
	}

	user, err := m.store.GetUserByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, storadminauth.ErrNotFound) {
			m.respondCredentialFailure(w, r, email)
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	if !user.IsActive || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		m.respondCredentialFailure(w, r, email)
		return
	}

	roleCodes, err := m.store.ListRoleCodesByUserID(r.Context(), user.ID)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	if !hasRole(roleCodes, "admin") {
		m.respondCredentialFailure(w, r, email)
		return
	}
	if err := m.protect.ResetEmailFailures(r.Context(), email); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}

	sessionUser := SessionUser{
		ID:          user.ID,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Roles:       roleCodes,
	}
	token, _, err := m.sessions.Create(r.Context(), sessionUser, m.now())
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	if err := m.store.UpdateLastLoginAt(r.Context(), user.ID, m.now()); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	setSessionCookie(w, r, token, m.sessionTT)
	_ = platformhttp.JSON(w, http.StatusOK, authMeResponse{User: sessionUser})
}

func (m *module) respondCredentialFailure(w http.ResponseWriter, r *http.Request, email string) {
	if m.protect == nil {
		writeAuthError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password", nil)
		return
	}
	locked, err := m.protect.RegisterEmailFailure(r.Context(), email)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	m.protect.SleepFailureDelay()
	if locked {
		writeAuthError(w, http.StatusTooManyRequests, "too_many_attempts", "too many attempts", nil)
		return
	}
	writeAuthError(w, http.StatusUnauthorized, "invalid_credentials", "invalid email or password", nil)
}

func (m *module) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/auth/logout" {
		http.NotFound(w, r)
		return
	}
	token, err := resolveSessionTokenFromRequest(r)
	if err == nil {
		_ = m.sessions.Destroy(r.Context(), token)
	}
	clearSessionCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/admin/auth/me" {
		http.NotFound(w, r)
		return
	}
	if m.sessions == nil || !m.sessions.Available() {
		platformhttp.Error(w, http.StatusServiceUnavailable, "auth unavailable")
		return
	}
	token, err := resolveSessionTokenFromRequest(r)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "unauthorized", "unauthorized", nil)
		return
	}
	state, err := m.sessions.Resolve(r.Context(), token)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			writeAuthError(w, http.StatusUnauthorized, "unauthorized", "unauthorized", nil)
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, authMeResponse{User: state.User})
}

func decodeAuthRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		return errors.New("invalid body")
	}
	if len(body) == 0 {
		return errors.New("invalid body")
	}
	if len(body) > maxBodyBytes {
		return errors.New("invalid body")
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return errors.New("invalid body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid body")
	}
	return nil
}

func writeAuthError(w http.ResponseWriter, status int, code string, message string, details []ValidationError) {
	_ = platformhttp.JSON(w, status, authErrorResponse{
		Error:   message,
		Code:    strings.TrimSpace(code),
		Details: details,
	})
}

func currentOrNewCSRFToken(r *http.Request) string {
	if r != nil {
		if cookie, err := r.Cookie(csrfCookieName); err == nil {
			token := strings.TrimSpace(cookie.Value)
			if token != "" {
				return token
			}
		}
	}
	return generateCSRFToken()
}

func generateCSRFToken() string {
	b := make([]byte, csrfTokenBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
