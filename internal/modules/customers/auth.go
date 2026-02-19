package customers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	storcustomers "goecommerce/internal/storage/customers"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionCookieName = "customer_session"
)

var errUnauthenticated = errors.New("unauthenticated")

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func verifyPassword(passwordHash, password string) bool {
	if passwordHash == "" || password == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) == nil
}

func generateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, token string, ttlSeconds int) {
	cookie := &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   ttlSeconds,
		Secure:   requestIsSecure(r),
	}
	http.SetCookie(w, cookie)
}

func clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	cookie := &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Secure:   requestIsSecure(r),
	}
	http.SetCookie(w, cookie)
}

func requestIsSecure(r *http.Request) bool {
	if r != nil && r.TLS != nil {
		return true
	}
	if r != nil && strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}

type sessionCustomerStore interface {
	GetCustomerBySessionTokenHash(ctx context.Context, tokenHash string) (storcustomers.Customer, error)
}

func resolveAuthenticatedCustomer(ctx context.Context, r *http.Request, store sessionCustomerStore) (storcustomers.Customer, string, error) {
	if store == nil {
		return storcustomers.Customer{}, "", errUnauthenticated
	}
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return storcustomers.Customer{}, "", errUnauthenticated
	}
	token := strings.TrimSpace(cookie.Value)
	if token == "" {
		return storcustomers.Customer{}, "", errUnauthenticated
	}
	hashed := hashSessionToken(token)
	customer, err := store.GetCustomerBySessionTokenHash(ctx, hashed)
	if err != nil {
		if errors.Is(err, storcustomers.ErrNotFound) {
			return storcustomers.Customer{}, "", errUnauthenticated
		}
		return storcustomers.Customer{}, "", err
	}
	return customer, hashed, nil
}
