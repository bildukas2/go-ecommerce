package admin

import "testing"

func TestValidateSystemUpdateRunRequest(t *testing.T) {
	tests := []struct {
		name      string
		req       systemUpdateRunRequest
		want      string
		shouldErr bool
	}{
		{
			name: "defaults to prod",
			req: systemUpdateRunRequest{
				ConfirmText: "UPDATE",
			},
			want: "prod",
		},
		{
			name: "dev channel",
			req: systemUpdateRunRequest{
				Channel:     "dev",
				ConfirmText: "UPDATE",
			},
			want: "dev",
		},
		{
			name: "invalid channel",
			req: systemUpdateRunRequest{
				Channel:     "beta",
				ConfirmText: "UPDATE",
			},
			shouldErr: true,
		},
		{
			name: "missing confirm",
			req: systemUpdateRunRequest{
				Channel:     "prod",
				ConfirmText: "GO",
			},
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateSystemUpdateRunRequest(tt.req)
			if tt.shouldErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected channel %q, got %q", tt.want, got)
			}
		})
	}
}
