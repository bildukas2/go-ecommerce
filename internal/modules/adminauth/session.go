package adminauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	adminSessionCookieName = "admin_session"
	sessionKeyPrefix       = "admin:session:"
)

var (
	ErrUnauthenticated = errors.New("unauthenticated")
	ErrSessionNotFound = errors.New("session not found")
)

type SessionUser struct {
	ID          string   `json:"id"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	Roles       []string `json:"roles"`
}

type SessionState struct {
	User      SessionUser `json:"user"`
	CreatedAt time.Time   `json:"created_at"`
}

type sessionCache interface {
	Set(ctx context.Context, key string, value string, ttl time.Duration) error
	Get(ctx context.Context, key string) (string, error)
	Del(ctx context.Context, key string) error
}

type redisSessionCache struct {
	client *redis.Client
}

func (c *redisSessionCache) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

func (c *redisSessionCache) Get(ctx context.Context, key string) (string, error) {
	v, err := c.client.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return "", ErrSessionNotFound
		}
		return "", err
	}
	return v, nil
}

func (c *redisSessionCache) Del(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

type SessionManager struct {
	cache sessionCache
	ttl   time.Duration
}

func NewSessionManager(cache sessionCache, ttl time.Duration) *SessionManager {
	return &SessionManager{cache: cache, ttl: ttl}
}

func (m *SessionManager) Available() bool {
	return m != nil && m.cache != nil && m.ttl > 0
}

func (m *SessionManager) Create(ctx context.Context, user SessionUser, now time.Time) (string, SessionState, error) {
	if !m.Available() {
		return "", SessionState{}, errors.New("session cache unavailable")
	}
	token, err := generateOpaqueToken(32)
	if err != nil {
		return "", SessionState{}, err
	}
	state := SessionState{
		User:      user,
		CreatedAt: now.UTC(),
	}
	raw, err := json.Marshal(state)
	if err != nil {
		return "", SessionState{}, err
	}
	if err := m.cache.Set(ctx, m.key(token), string(raw), m.ttl); err != nil {
		return "", SessionState{}, err
	}
	return token, state, nil
}

func (m *SessionManager) Resolve(ctx context.Context, token string) (SessionState, error) {
	if !m.Available() {
		return SessionState{}, errors.New("session cache unavailable")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return SessionState{}, ErrSessionNotFound
	}
	raw, err := m.cache.Get(ctx, m.key(token))
	if err != nil {
		return SessionState{}, err
	}
	var state SessionState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return SessionState{}, err
	}
	return state, nil
}

func (m *SessionManager) Destroy(ctx context.Context, token string) error {
	if !m.Available() {
		return nil
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil
	}
	return m.cache.Del(ctx, m.key(token))
}

func (m *SessionManager) key(token string) string {
	return sessionKeyPrefix + hashSessionToken(token)
}

func generateOpaqueToken(bytesLen int) (string, error) {
	b := make([]byte, bytesLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, token string, ttl time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     adminSessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttl.Seconds()),
		Secure:   shouldUseSecureCookie(r),
	})
}

func clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     adminSessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Secure:   shouldUseSecureCookie(r),
	})
}

func resolveSessionTokenFromRequest(r *http.Request) (string, error) {
	cookie, err := r.Cookie(adminSessionCookieName)
	if err != nil {
		return "", ErrUnauthenticated
	}
	token := strings.TrimSpace(cookie.Value)
	if token == "" {
		return "", ErrUnauthenticated
	}
	return token, nil
}

func shouldUseSecureCookie(r *http.Request) bool {
	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	goEnv := strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	if appEnv == "production" || goEnv == "production" {
		return true
	}
	if r != nil && r.TLS != nil {
		return true
	}
	if r != nil && strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}
