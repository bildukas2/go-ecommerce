package app

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestRouterServesUploadsDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	uploadsDir := filepath.Join(tmpDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		t.Fatalf("mkdir uploads dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(uploadsDir, "hello.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatalf("write upload file: %v", err)
	}

	previousUploadsDir := os.Getenv("UPLOADS_DIR")
	t.Setenv("UPLOADS_DIR", uploadsDir)
	defer func() {
		_ = os.Setenv("UPLOADS_DIR", previousUploadsDir)
	}()

	router := NewRouter(Deps{})
	req := httptest.NewRequest(http.MethodGet, "/uploads/hello.txt", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if string(body) != "hello" {
		t.Fatalf("expected body %q, got %q", "hello", string(body))
	}
}
