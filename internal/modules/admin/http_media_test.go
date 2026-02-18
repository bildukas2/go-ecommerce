package admin

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	stormedia "goecommerce/internal/storage/media"
)

type fakeMediaStore struct {
	createAssetFn func(context.Context, stormedia.CreateAssetInput) (stormedia.Asset, error)
	listAssetsFn  func(context.Context, stormedia.ListAssetsParams) ([]stormedia.Asset, error)
}

func (f *fakeMediaStore) CreateAsset(ctx context.Context, in stormedia.CreateAssetInput) (stormedia.Asset, error) {
	if f.createAssetFn == nil {
		return stormedia.Asset{}, nil
	}
	return f.createAssetFn(ctx, in)
}

func (f *fakeMediaStore) ListAssets(ctx context.Context, in stormedia.ListAssetsParams) ([]stormedia.Asset, error) {
	if f.listAssetsFn == nil {
		return []stormedia.Asset{}, nil
	}
	return f.listAssetsFn(ctx, in)
}

func TestAdminMediaListSuccess(t *testing.T) {
	store := &fakeMediaStore{
		listAssetsFn: func(_ context.Context, in stormedia.ListAssetsParams) ([]stormedia.Asset, error) {
			if in.Limit != 10 || in.Offset != 20 {
				t.Fatalf("unexpected pagination: %+v", in)
			}
			return []stormedia.Asset{{ID: "asset-1", URL: "http://localhost:8080/uploads/a.png"}}, nil
		},
	}
	m := &module{media: store, user: "admin", pass: "pass", uploadsDir: t.TempDir()}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	req := httptest.NewRequest(http.MethodGet, "/admin/media?limit=10&offset=20", nil)
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("admin:pass")))
	res := httptest.NewRecorder()
	mux.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["limit"] != float64(10) || payload["offset"] != float64(20) {
		t.Fatalf("unexpected pagination payload: %#v", payload)
	}
}

func TestAdminMediaUploadSuccess(t *testing.T) {
	var captured stormedia.CreateAssetInput
	store := &fakeMediaStore{
		createAssetFn: func(_ context.Context, in stormedia.CreateAssetInput) (stormedia.Asset, error) {
			captured = in
			return stormedia.Asset{
				ID:          "asset-1",
				URL:         in.URL,
				StoragePath: in.StoragePath,
				MIMEType:    in.MIMEType,
				SizeBytes:   in.SizeBytes,
				Alt:         in.Alt,
				SourceType:  in.SourceType,
				CreatedAt:   time.Now().UTC(),
			}, nil
		},
	}
	uploadsDir := t.TempDir()
	m := &module{media: store, user: "admin", pass: "pass", uploadsDir: uploadsDir}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminMultipartRequest(t, mux, "/admin/media/upload", "file", "photo.png", samplePNG(), "Hero image")
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d, body=%s", http.StatusCreated, res.Code, res.Body.String())
	}
	if captured.SourceType != stormedia.SourceTypeUpload {
		t.Fatalf("expected source type %q, got %q", stormedia.SourceTypeUpload, captured.SourceType)
	}
	if captured.MIMEType != "image/png" {
		t.Fatalf("expected mime type image/png, got %q", captured.MIMEType)
	}
	if captured.Alt != "Hero image" {
		t.Fatalf("expected alt to be persisted")
	}
	if captured.StoragePath == "" {
		t.Fatalf("expected storage path to be set")
	}
	if _, err := os.Stat(filepath.Join(uploadsDir, filepath.FromSlash(captured.StoragePath))); err != nil {
		t.Fatalf("expected stored file to exist: %v", err)
	}
}

func TestAdminMediaUploadRejectsUnsupportedType(t *testing.T) {
	store := &fakeMediaStore{}
	m := &module{media: store, user: "admin", pass: "pass", uploadsDir: t.TempDir()}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	res := performAdminMultipartRequest(t, mux, "/admin/media/upload", "file", "file.txt", []byte("hello"), "")
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
	if !strings.Contains(res.Body.String(), "unsupported image type") {
		t.Fatalf("unexpected body: %s", res.Body.String())
	}
}

func TestAdminMediaImportURLRequiresConsent(t *testing.T) {
	store := &fakeMediaStore{}
	m := &module{media: store, user: "admin", pass: "pass", uploadsDir: t.TempDir()}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"url":               "https://example.com/cat.png",
		"consent_confirmed": false,
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/media/import-url", body)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestAdminMediaImportURLBlocksPrivateHost(t *testing.T) {
	store := &fakeMediaStore{}
	m := &module{media: store, user: "admin", pass: "pass", uploadsDir: t.TempDir()}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"url":               "http://127.0.0.1/image.png",
		"consent_confirmed": true,
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/media/import-url", body)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
	if !strings.Contains(res.Body.String(), "url host is not allowed") {
		t.Fatalf("unexpected body: %s", res.Body.String())
	}
}

func TestAdminMediaImportURLSuccess(t *testing.T) {
	var captured stormedia.CreateAssetInput
	store := &fakeMediaStore{
		createAssetFn: func(_ context.Context, in stormedia.CreateAssetInput) (stormedia.Asset, error) {
			captured = in
			return stormedia.Asset{
				ID:          "asset-url-1",
				URL:         in.URL,
				StoragePath: in.StoragePath,
				MIMEType:    in.MIMEType,
				SizeBytes:   in.SizeBytes,
				Alt:         in.Alt,
				SourceType:  in.SourceType,
				SourceURL:   in.SourceURL,
				CreatedAt:   time.Now().UTC(),
			}, nil
		},
	}
	uploadsDir := t.TempDir()
	m := &module{
		media:      store,
		user:       "admin",
		pass:       "pass",
		uploadsDir: uploadsDir,
		validateImportHost: func(_ context.Context, host string) error {
			if host == "" {
				t.Fatalf("expected host")
			}
			return nil
		},
		downloadImportImage: func(_ context.Context, rawURL string) ([]byte, string, error) {
			if rawURL != "https://example.com/cat.png" {
				t.Fatalf("unexpected URL: %s", rawURL)
			}
			return samplePNG(), "image/png", nil
		},
	}
	mux := http.NewServeMux()
	m.RegisterRoutes(mux)

	body := map[string]any{
		"url":               "https://example.com/cat.png",
		"alt":               "Imported",
		"consent_confirmed": true,
	}
	res := performAdminJSONRequest(t, mux, http.MethodPost, "/admin/media/import-url", body)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d, body=%s", http.StatusCreated, res.Code, res.Body.String())
	}
	if captured.SourceType != stormedia.SourceTypeURLImport {
		t.Fatalf("expected source type %q, got %q", stormedia.SourceTypeURLImport, captured.SourceType)
	}
	if captured.SourceURL == nil || *captured.SourceURL != "https://example.com/cat.png" {
		t.Fatalf("unexpected source url: %#v", captured.SourceURL)
	}
	if captured.Alt != "Imported" {
		t.Fatalf("expected alt to be persisted")
	}
	if _, err := os.Stat(filepath.Join(uploadsDir, filepath.FromSlash(captured.StoragePath))); err != nil {
		t.Fatalf("expected stored file to exist: %v", err)
	}
}

func performAdminMultipartRequest(t *testing.T, h http.Handler, path, fieldName, filename string, fileContent []byte, alt string) *httptest.ResponseRecorder {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileWriter, err := writer.CreateFormFile(fieldName, filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := fileWriter.Write(fileContent); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if alt != "" {
		if err := writer.WriteField("alt", alt); err != nil {
			t.Fatalf("write alt field: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("admin:pass")))
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	return res
}

func samplePNG() []byte {
	raw, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9q8AAAAASUVORK5CYII=")
	return raw
}
