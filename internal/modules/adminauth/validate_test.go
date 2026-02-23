package adminauth

import "testing"

func TestNormalizeAndValidateEmail(t *testing.T) {
	email, err := normalizeAndValidateEmail("  ADMIN@Example.com ")
	if err != nil {
		t.Fatalf("expected valid email, got error: %v", err)
	}
	if email != "admin@example.com" {
		t.Fatalf("expected normalized lowercase email, got %q", email)
	}
}

func TestNormalizeAndValidateEmailRejectsNonASCII(t *testing.T) {
	if _, err := normalizeAndValidateEmail("аdmin@example.com"); err == nil { // cyrillic 'а'
		t.Fatalf("expected non-ASCII email to be rejected")
	}
}

func TestNormalizeAndValidatePasswordRejectsIllegalChars(t *testing.T) {
	cases := []string{
		" secret",
		"secret ",
		"sec\u0007ret",
		"sec\u200Bret",
	}
	for _, input := range cases {
		if _, err := normalizeAndValidatePassword(input); err == nil {
			t.Fatalf("expected password %q to be rejected", input)
		}
	}
}

func TestValidateLoginRequestRequiresCaptcha(t *testing.T) {
	_, _, errs := validateLoginRequest(loginRequest{
		Email:        "admin@example.com",
		Password:     "StrongPassword!123",
		CaptchaToken: "",
	}, true)
	if len(errs) == 0 {
		t.Fatalf("expected validation errors for missing captcha")
	}
	found := false
	for _, err := range errs {
		if err.Field == "captchaToken" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected captchaToken validation error")
	}
}

func TestValidateLoginRequestCaptchaOptional(t *testing.T) {
	_, _, errs := validateLoginRequest(loginRequest{
		Email:        "admin@example.com",
		Password:     "StrongPassword!123",
		CaptchaToken: "",
	}, false)
	if len(errs) != 0 {
		t.Fatalf("expected no validation errors, got %d", len(errs))
	}
}
