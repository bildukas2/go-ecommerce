package cms

import (
	"encoding/json"
	"strings"
)

// ResolveI18n resolves a localized string from a JSONB map.
// If lang is provided and exists, it returns that.
// Otherwise it falls back to "en".
// If both are missing or empty, it returns the provided fallback.
func ResolveI18n(raw []byte, lang string, fallback string) string {
	if len(raw) == 0 {
		return fallback
	}

	var m map[string]string
	if err := json.Unmarshal(raw, &m); err != nil {
		return fallback
	}

	// Try requested language
	if lang != "" {
		if val, ok := m[lang]; ok && strings.TrimSpace(val) != "" {
			return val
		}
	}

	// Fallback to English
	if val, ok := m["en"]; ok && strings.TrimSpace(val) != "" {
		return val
	}

	return fallback
}
