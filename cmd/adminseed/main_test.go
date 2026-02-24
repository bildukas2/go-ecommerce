package main

import "testing"

func TestDeriveDisplayNameFromEmail(t *testing.T) {
	t.Run("uses local part", func(t *testing.T) {
		got := deriveDisplayNameFromEmail("admin.user@example.com")
		if got != "admin.user" {
			t.Fatalf("expected local part, got %q", got)
		}
	})

	t.Run("fallback", func(t *testing.T) {
		got := deriveDisplayNameFromEmail("@example.com")
		if got != "Admin" {
			t.Fatalf("expected fallback display name, got %q", got)
		}
	})
}
