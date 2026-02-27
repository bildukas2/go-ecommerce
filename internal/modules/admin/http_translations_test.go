package admin

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestAdminTranslationsList(t *testing.T) {
	tempDir := t.TempDir()
	os.WriteFile(filepath.Join(tempDir, "en.json"), []byte("{}"), 0644)
	os.WriteFile(filepath.Join(tempDir, "lt.json"), []byte("{}"), 0644)
	os.WriteFile(filepath.Join(tempDir, "readme.txt"), []byte("not a json"), 0644)

	m := &module{translationsDir: tempDir}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminGetRequest(t, mux, "/admin/translations")
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	items, ok := payload["items"].([]any)
	if !ok {
		t.Fatalf("expected items array, got %#v", payload["items"])
	}

	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}

	foundEn := false
	foundLt := false
	for _, item := range items {
		if item == "en" {
			foundEn = true
		}
		if item == "lt" {
			foundLt = true
		}
	}

	if !foundEn || !foundLt {
		t.Fatalf("expected en and lt to be in items: %#v", items)
	}
}

func TestAdminTranslationDetail(t *testing.T) {
	tempDir := t.TempDir()
	initialData := `{"hello": "world"}`
	os.WriteFile(filepath.Join(tempDir, "en.json"), []byte(initialData), 0644)

	m := &module{translationsDir: tempDir}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	// Test GET
	res := performAdminGetRequest(t, mux, "/admin/translations/en")
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["hello"] != "world" {
		t.Fatalf("expected world, got %#v", payload["hello"])
	}

	// Test UPDATE (PUT)
	updateData := map[string]any{"hello": "updated"}
	res = performAdminJSONRequest(t, mux, http.MethodPut, "/admin/translations/en", updateData)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d, body=%s", http.StatusOK, res.Code, res.Body.String())
	}

	// Verify file content
	data, _ := os.ReadFile(filepath.Join(tempDir, "en.json"))
	var updated map[string]any
	json.Unmarshal(data, &updated)
	if updated["hello"] != "updated" {
		t.Fatalf("expected updated, got %#v", updated["hello"])
	}

	// Test GET updated
	res = performAdminGetRequest(t, mux, "/admin/translations/en")
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	json.Unmarshal(res.Body.Bytes(), &payload)
	if payload["hello"] != "updated" {
		t.Fatalf("expected updated in response, got %#v", payload["hello"])
	}
}

func TestAdminTranslationNotFound(t *testing.T) {
	tempDir := t.TempDir()
	m := &module{translationsDir: tempDir}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminGetRequest(t, mux, "/admin/translations/nonexistent")
	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, res.Code)
	}
}

func TestAdminTranslationInvalidName(t *testing.T) {
	tempDir := t.TempDir()
	m := &module{translationsDir: tempDir}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminGetRequest(t, mux, "/admin/translations/invalid*name")
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func performAdminGetRequest(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("admin:pass")))
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	return res
}
