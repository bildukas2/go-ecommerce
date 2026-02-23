package adminauth

import (
	"errors"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func normalizeAndValidateEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", errors.New("email is required")
	}
	if !utf8.ValidString(email) {
		return "", errors.New("email is invalid")
	}
	for _, r := range email {
		if r > unicode.MaxASCII {
			return "", errors.New("email must be ASCII")
		}
		if hasIllegalRune(r) {
			return "", errors.New("email contains invalid characters")
		}
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || !strings.EqualFold(parsed.Address, email) {
		return "", errors.New("email is invalid")
	}
	return email, nil
}

func normalizeAndValidatePassword(raw string) (string, error) {
	if raw == "" {
		return "", errors.New("password is required")
	}
	if raw != strings.TrimSpace(raw) {
		return "", errors.New("password cannot start or end with whitespace")
	}
	if !utf8.ValidString(raw) {
		return "", errors.New("password is invalid")
	}
	for _, r := range raw {
		if hasIllegalRune(r) {
			return "", errors.New("password contains invalid characters")
		}
	}
	return raw, nil
}

func hasIllegalRune(r rune) bool {
	if r < 0x20 || r == 0x7F {
		return true
	}
	if unicode.IsControl(r) {
		return true
	}
	if unicode.Is(unicode.Cf, r) {
		return true
	}
	return false
}

func validateLoginRequest(in loginRequest) (email string, password string, errs []ValidationError) {
	email, err := normalizeAndValidateEmail(in.Email)
	if err != nil {
		errs = append(errs, ValidationError{Field: "email", Message: err.Error()})
	}
	password, err = normalizeAndValidatePassword(in.Password)
	if err != nil {
		errs = append(errs, ValidationError{Field: "password", Message: err.Error()})
	}
	if strings.TrimSpace(in.CaptchaToken) == "" {
		errs = append(errs, ValidationError{Field: "captchaToken", Message: "captchaToken is required"})
	}
	return email, password, errs
}

func hasRole(codes []string, roleCode string) bool {
	roleCode = strings.ToLower(strings.TrimSpace(roleCode))
	for _, code := range codes {
		if strings.ToLower(strings.TrimSpace(code)) == roleCode {
			return true
		}
	}
	return false
}
