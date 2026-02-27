package admin

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	platformhttp "goecommerce/internal/platform/http"
)

func (m *module) handleTranslations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	files, err := os.ReadDir(m.translationsDir)
	if err != nil {
		platformhttp.Error(w, http.StatusInternalServerError, "failed to read translations directory")
		return
	}

	var locales []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") {
			locales = append(locales, strings.TrimSuffix(f.Name(), ".json"))
		}
	}

	_ = platformhttp.JSON(w, http.StatusOK, map[string]any{
		"items": locales,
	})
}

func (m *module) handleTranslationDetail(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/admin/translations/") {
		http.NotFound(w, r)
		return
	}

	locale := r.URL.Path[len("/admin/translations/"):]
	if i := strings.IndexByte(locale, '/'); i >= 0 {
		locale = locale[:i]
	}
	locale = strings.TrimSpace(locale)
	if locale == "" {
		http.NotFound(w, r)
		return
	}

	// Basic security: only allow alphanumeric and underscores for locale names
	for _, char := range locale {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_' || char == '-') {
			platformhttp.Error(w, http.StatusBadRequest, "invalid locale name")
			return
		}
	}

	filePath := filepath.Join(m.translationsDir, locale+".json")

	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(filePath)
		if err != nil {
			if os.IsNotExist(err) {
				platformhttp.Error(w, http.StatusNotFound, "translation not found")
				return
			}
			platformhttp.Error(w, http.StatusInternalServerError, "failed to read translation file")
			return
		}

		var translations map[string]any
		if err := json.Unmarshal(data, &translations); err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to parse translation file")
			return
		}

		_ = platformhttp.JSON(w, http.StatusOK, translations)

	case http.MethodPut, http.MethodPost:
		var translations map[string]any
		if err := json.NewDecoder(r.Body).Decode(&translations); err != nil {
			platformhttp.Error(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		data, err := json.MarshalIndent(translations, "", "  ")
		if err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to serialize translations")
			return
		}

		if err := os.WriteFile(filePath, data, 0644); err != nil {
			platformhttp.Error(w, http.StatusInternalServerError, "failed to write translation file")
			return
		}

		_ = platformhttp.JSON(w, http.StatusOK, map[string]string{"status": "ok"})

	case http.MethodDelete:
		// Optional: implement if needed, but not requested explicitly
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)

	default:
		http.NotFound(w, r)
	}
}
