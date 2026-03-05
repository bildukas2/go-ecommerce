package settings

import "testing"

func TestValidateUpdateShopSettingsRequest(t *testing.T) {
	tests := []struct {
		name      string
		input     updateShopSettingsRequest
		want      string
		shouldErr bool
	}{
		{
			name:      "valid lowercase trimmed",
			input:     updateShopSettingsRequest{Currency: " eur "},
			want:      "EUR",
			shouldErr: false,
		},
		{
			name:      "invalid length",
			input:     updateShopSettingsRequest{Currency: "EURO"},
			shouldErr: true,
		},
		{
			name:      "invalid symbols",
			input:     updateShopSettingsRequest{Currency: "U$D"},
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateUpdateShopSettingsRequest(tt.input)
			if tt.shouldErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.Currency != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got.Currency)
			}
		})
	}
}
