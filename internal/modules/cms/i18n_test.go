package cms

import (
	"testing"
)

func TestResolveI18n(t *testing.T) {
	tests := []struct {
		name     string
		raw      []byte
		lang     string
		fallback string
		want     string
	}{
		{
			name:     "empty raw returns fallback",
			raw:      nil,
			lang:     "lt",
			fallback: "Default",
			want:     "Default",
		},
		{
			name:     "requested lang exists",
			raw:      []byte(`{"en": "English", "lt": "Lithuanian"}`),
			lang:     "lt",
			fallback: "Default",
			want:     "Lithuanian",
		},
		{
			name:     "requested lang missing falls back to en",
			raw:      []byte(`{"en": "English"}`),
			lang:     "lt",
			fallback: "Default",
			want:     "English",
		},
		{
			name:     "requested lang empty falls back to en",
			raw:      []byte(`{"en": "English", "lt": ""}`),
			lang:     "lt",
			fallback: "Default",
			want:     "English",
		},
		{
			name:     "requested and en missing returns fallback",
			raw:      []byte(`{"fr": "French"}`),
			lang:     "lt",
			fallback: "Default",
			want:     "Default",
		},
		{
			name:     "invalid json returns fallback",
			raw:      []byte(`invalid`),
			lang:     "lt",
			fallback: "Default",
			want:     "Default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ResolveI18n(tt.raw, tt.lang, tt.fallback); got != tt.want {
				t.Errorf("ResolveI18n() = %v, want %v", got, tt.want)
			}
		})
	}
}
