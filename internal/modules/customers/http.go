package customers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"goecommerce/internal/app"
	platformhttp "goecommerce/internal/platform/http"
	storcustomers "goecommerce/internal/storage/customers"
)

const (
	minimumPasswordLength = 8
	defaultSessionTTL     = 30 * 24 * time.Hour
)

type customerStore interface {
	CreateCustomer(ctx context.Context, email, passwordHash string) (storcustomers.Customer, error)
	GetCustomerByEmail(ctx context.Context, email string) (storcustomers.Customer, error)
	CreateSession(ctx context.Context, customerID, tokenHash string, expiresAt time.Time) (storcustomers.Session, error)
	GetCustomerBySessionTokenHash(ctx context.Context, tokenHash string) (storcustomers.Customer, error)
	RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error
}

type module struct {
	store      customerStore
	sessionTTL time.Duration
	now        func() time.Time
}

func NewModule(deps app.Deps) app.Module {
	var store customerStore
	if deps.DB != nil {
		if st, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
			store = st
		}
	}
	return &module{store: store, sessionTTL: defaultSessionTTL, now: time.Now}
}

func (m *module) Name() string { return "customers" }

func (m *module) Close() error {
	if closer, ok := m.store.(interface{ Close() error }); ok && closer != nil {
		return closer.Close()
	}
	return nil
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/auth/register", m.handleRegister)
	mux.HandleFunc("/auth/login", m.handleLogin)
	mux.HandleFunc("/auth/logout", m.handleLogout)
	mux.HandleFunc("/auth/me", m.handleMe)
}

type credentialsRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authCustomerResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

func (m *module) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/register" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	var body credentialsRequest
	if err := decodeAuthRequest(r, &body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, password, err := validateCredentials(body)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	passwordHash, err := hashPassword(password)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "register error")
		return
	}
	customer, err := m.store.CreateCustomer(r.Context(), email, passwordHash)
	if err != nil {
		if errors.Is(err, storcustomers.ErrConflict) {
			platformhttp.Error(w, http.StatusConflict, "email already in use")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "register error")
		return
	}
	if err := m.startSession(w, r, customer.ID); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "register error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusCreated, toAuthResponse(customer))
}

func (m *module) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/login" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	var body credentialsRequest
	if err := decodeAuthRequest(r, &body); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, password, err := validateCredentials(body)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	customer, err := m.store.GetCustomerByEmail(r.Context(), email)
	if err != nil || !verifyPassword(customer.PasswordHash, password) {
		platformhttp.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err := m.startSession(w, r, customer.ID); err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "login error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, toAuthResponse(customer))
}

func (m *module) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/auth/logout" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	_, tokenHash, err := resolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err == nil {
		_ = m.store.RevokeSessionByTokenHash(r.Context(), tokenHash)
	}
	clearSessionCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (m *module) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/auth/me" {
		http.NotFound(w, r)
		return
	}
	if m.store == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}
	customer, _, err := resolveAuthenticatedCustomer(r.Context(), r, m.store)
	if err != nil {
		if errors.Is(err, errUnauthenticated) {
			platformhttp.Error(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		platformhttp.Error(w, http.StatusInternalServerError, "auth error")
		return
	}
	_ = platformhttp.JSON(w, http.StatusOK, toAuthResponse(customer))
}

func toAuthResponse(c storcustomers.Customer) authCustomerResponse {
	return authCustomerResponse{ID: c.ID, Email: c.Email, CreatedAt: c.CreatedAt}
}

func (m *module) startSession(w http.ResponseWriter, r *http.Request, customerID string) error {
	token, err := generateSessionToken()
	if err != nil {
		return err
	}
	expiresAt := m.now().Add(m.sessionTTL)
	if _, err := m.store.CreateSession(r.Context(), customerID, hashSessionToken(token), expiresAt); err != nil {
		return err
	}
	setSessionCookie(w, r, token, int(m.sessionTTL.Seconds()))
	return nil
}

func decodeAuthRequest(r *http.Request, dst any) error {
	defer r.Body.Close()
	const maxBodyBytes = 1 << 20
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes+1))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return errors.New("invalid body")
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return errors.New("invalid body")
	}
	return nil
}

func validateCredentials(in credentialsRequest) (string, string, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	password := strings.TrimSpace(in.Password)
	if email == "" || password == "" {
		return "", "", errors.New("email and password are required")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", "", errors.New("invalid email")
	}
	if len(password) < minimumPasswordLength {
		return "", "", errors.New("password must be at least 8 characters")
	}
	return email, password, nil
}
