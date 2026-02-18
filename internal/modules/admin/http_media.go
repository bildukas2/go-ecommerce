package admin

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	platformhttp "goecommerce/internal/platform/http"
	stormedia "goecommerce/internal/storage/media"
)

const (
	maxMediaImageBytes  = 5 << 20
	maxMediaImportBytes = maxMediaImageBytes + 1024
	maxMediaListLimit   = 100
	mediaListDefault    = 50
	mediaHTTPTimeout    = 15 * time.Second
)

var allowedMediaMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
	"image/gif":  ".gif",
}

type importURLRequest struct {
	URL              string  `json:"url"`
	Alt              *string `json:"alt"`
	ConsentConfirmed bool    `json:"consent_confirmed"`
}

func (m *module) handleMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || r.URL.Path != "/admin/media" {
		http.NotFound(w, r)
		return
	}
	if m.media == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	limit := atoiDefault(strings.TrimSpace(r.URL.Query().Get("limit")), mediaListDefault)
	if limit <= 0 || limit > maxMediaListLimit {
		limit = mediaListDefault
	}
	offset := atoiDefault(strings.TrimSpace(r.URL.Query().Get("offset")), 0)
	if offset < 0 {
		offset = 0
	}

	items, err := m.media.ListAssets(r.Context(), stormedia.ListAssetsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "list media error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"items":  items,
		"limit":  limit,
		"offset": offset,
	})
}

func (m *module) handleMediaUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/media/upload" {
		http.NotFound(w, r)
		return
	}
	if m.media == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxMediaImportBytes)
	if err := r.ParseMultipartForm(maxMediaImportBytes); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "invalid multipart form")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	data, mimeType, err := readAndValidateImage(file, maxMediaImageBytes)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	alt := strings.TrimSpace(r.FormValue("alt"))
	storagePath, publicURL, err := m.writeUploadFile(r, data, mimeType)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "store upload error")
		return
	}

	item, err := m.media.CreateAsset(r.Context(), stormedia.CreateAssetInput{
		URL:         publicURL,
		StoragePath: storagePath,
		MIMEType:    mimeType,
		SizeBytes:   int64(len(data)),
		Alt:         alt,
		SourceType:  stormedia.SourceTypeUpload,
	})
	if err != nil {
		_ = os.Remove(filepath.Join(m.uploadsDir, filepath.FromSlash(storagePath)))
		platformhttp.Error(w, http.StatusInternalServerError, "create media asset error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, item)
}

func (m *module) handleMediaImportURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.URL.Path != "/admin/media/import-url" {
		http.NotFound(w, r)
		return
	}
	if m.media == nil {
		platformhttp.Error(w, http.StatusServiceUnavailable, "db unavailable")
		return
	}

	var req importURLRequest
	if err := decodeRequest(r, &req); err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if !req.ConsentConfirmed {
		platformhttp.Error(w, http.StatusBadRequest, "consent_confirmed must be true")
		return
	}
	rawURL := strings.TrimSpace(req.URL)
	parsedURL, err := parseAndValidateImportURL(rawURL)
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if m.validateImportHost != nil {
		err = m.validateImportHost(r.Context(), parsedURL.Hostname())
	} else {
		err = validateImportHostSafety(r.Context(), parsedURL.Hostname())
	}
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	var data []byte
	var mimeType string
	if m.downloadImportImage != nil {
		data, mimeType, err = m.downloadImportImage(r.Context(), rawURL)
	} else {
		data, mimeType, err = m.downloadRemoteImage(r.Context(), rawURL)
	}
	if err != nil {
		platformhttp.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	alt := strings.TrimSpace(valueOrEmpty(req.Alt))
	storagePath, publicURL, err := m.writeUploadFile(r, data, mimeType)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "store upload error")
		return
	}

	sourceURL := parsedURL.String()
	item, err := m.media.CreateAsset(r.Context(), stormedia.CreateAssetInput{
		URL:         publicURL,
		StoragePath: storagePath,
		MIMEType:    mimeType,
		SizeBytes:   int64(len(data)),
		Alt:         alt,
		SourceType:  stormedia.SourceTypeURLImport,
		SourceURL:   &sourceURL,
	})
	if err != nil {
		_ = os.Remove(filepath.Join(m.uploadsDir, filepath.FromSlash(storagePath)))
		platformhttp.Error(w, http.StatusInternalServerError, "create media asset error")
		return
	}

	_ = platformhttp.JSON(w, http.StatusCreated, item)
}

func readAndValidateImage(r io.Reader, maxBytes int64) ([]byte, string, error) {
	content, err := io.ReadAll(io.LimitReader(r, maxBytes+1))
	if err != nil {
		return nil, "", errors.New("unable to read image")
	}
	if int64(len(content)) > maxBytes {
		return nil, "", errors.New("image exceeds 5MB limit")
	}
	if len(content) == 0 {
		return nil, "", errors.New("image file is empty")
	}
	detected := http.DetectContentType(sniffBytes(content))
	if _, ok := allowedMediaMIMEs[detected]; !ok {
		return nil, "", errors.New("unsupported image type")
	}
	return content, detected, nil
}

func sniffBytes(content []byte) []byte {
	if len(content) <= 512 {
		return content
	}
	return content[:512]
}

func (m *module) downloadRemoteImage(ctx context.Context, rawURL string) ([]byte, string, error) {
	client := &http.Client{
		Timeout: mediaHTTPTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			return validateImportHostSafety(ctx, req.URL.Hostname())
		},
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", errors.New("invalid import url")
	}
	resp, err := client.Do(request)
	if err != nil {
		return nil, "", errors.New("failed to download image")
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", errors.New("image URL returned non-success status")
	}
	return readAndValidateImage(resp.Body, maxMediaImageBytes)
}

func parseAndValidateImportURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, errors.New("url must be a valid http/https URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("url must be a valid http/https URL")
	}
	if strings.TrimSpace(parsed.Hostname()) == "" {
		return nil, errors.New("url host is required")
	}
	if parsed.User != nil {
		return nil, errors.New("url credentials are not allowed")
	}
	return parsed, nil
}

func validateImportHostSafety(ctx context.Context, host string) error {
	host = strings.TrimSpace(strings.ToLower(host))
	if host == "" {
		return errors.New("url host is required")
	}
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") {
		return errors.New("url host is not allowed")
	}

	if parsedIP := net.ParseIP(host); parsedIP != nil {
		if isBlockedIP(parsedIP) {
			return errors.New("url host is not allowed")
		}
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return errors.New("unable to resolve url host")
	}
	if len(ips) == 0 {
		return errors.New("unable to resolve url host")
	}
	for _, ip := range ips {
		if isBlockedIP(ip) {
			return errors.New("url host is not allowed")
		}
	}
	return nil
}

func isBlockedIP(ip net.IP) bool {
	return ip.IsPrivate() ||
		ip.IsLoopback() ||
		ip.IsLinkLocalMulticast() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsMulticast() ||
		ip.IsUnspecified()
}

func (m *module) writeUploadFile(r *http.Request, content []byte, mimeType string) (storagePath string, publicURL string, err error) {
	ext := allowedMediaMIMEs[mimeType]
	filename, err := randomHexFilename(ext)
	if err != nil {
		return "", "", err
	}
	now := time.Now().UTC()
	storagePath = fmt.Sprintf("%04d/%02d/%s", now.Year(), int(now.Month()), filename)
	absolutePath := filepath.Join(m.uploadsDir, filepath.FromSlash(storagePath))
	if err := os.MkdirAll(filepath.Dir(absolutePath), 0o755); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(absolutePath, content, 0o644); err != nil {
		return "", "", err
	}

	publicURL = buildPublicUploadURL(r, storagePath)
	return storagePath, publicURL, nil
}

func randomHexFilename(ext string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf) + ext, nil
}

func buildPublicUploadURL(r *http.Request, storagePath string) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if xfp := firstHeaderCSVValue(r.Header.Get("X-Forwarded-Proto")); xfp != "" {
		scheme = strings.ToLower(xfp)
	}

	host := strings.TrimSpace(r.Host)
	if xfh := firstHeaderCSVValue(r.Header.Get("X-Forwarded-Host")); xfh != "" {
		host = xfh
	}
	return scheme + "://" + host + "/uploads/" + strings.ReplaceAll(storagePath, "\\", "/")
}

func firstHeaderCSVValue(v string) string {
	if v == "" {
		return ""
	}
	parts := strings.Split(v, ",")
	return strings.TrimSpace(parts[0])
}

func valueOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
