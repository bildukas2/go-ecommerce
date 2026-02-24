package cms

import (
	"testing"
)

func TestSanitizeHTML(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "no script",
			in:   "<p>Hello</p>",
			want: "<p>Hello</p>",
		},
		{
			name: "simple script",
			in:   "<p>Hello</p><script>alert(1)</script>",
			want: "<p>Hello</p>",
		},
		{
			name: "script with attributes",
			in:   "<script src=\"evil.js\"></script><p>Safe</p>",
			want: "<p>Safe</p>",
		},
		{
			name: "multiline script",
			in:   "<script>\nconsole.log('hi');\n</script><p>Safe</p>",
			want: "<p>Safe</p>",
		},
		{
			name: "inline event handler double quotes",
			in:   "<button onclick=\"alert(1)\">Click me</button>",
			want: "<button >Click me</button>",
		},
		{
			name: "inline event handler single quotes",
			in:   "<button onmouseover='evil()'>Hover me</button>",
			want: "<button >Hover me</button>",
		},
		{
			name: "inline event handler no quotes",
			in:   "<button onerror=alert(1)>Error</button>",
			want: "<button >Error</button>",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeHTML(tt.in)
			if got != tt.want {
				t.Errorf("sanitizeHTML() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestValidatePageRequest(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		slug    string
		status  string
		wantErr bool
	}{
		{name: "valid", title: "About", slug: "/about", status: "published", wantErr: false},
		{name: "empty title", title: "", slug: "/about", status: "published", wantErr: true},
		{name: "invalid slug no slash", title: "About", slug: "about", status: "published", wantErr: true},
		{name: "invalid slug format", title: "About", slug: "/About Me", status: "published", wantErr: true},
		{name: "reserved slug", title: "Admin", slug: "/admin", status: "published", wantErr: true},
		{name: "invalid status", title: "About", slug: "/about", status: "invalid", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePageRequest(tt.title, tt.slug, tt.status)
			if (err != nil) != tt.wantErr {
				t.Errorf("validatePageRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateNavigationRequest(t *testing.T) {
	pageID := "page-1"
	url := "https://example.com"
	
	tests := []struct {
		name    string
		label   string
		navType string
		pageID  *string
		url     *string
		wantErr bool
	}{
		{name: "valid page", label: "Home", navType: "page", pageID: &pageID, wantErr: false},
		{name: "valid url", label: "External", navType: "url", url: &url, wantErr: false},
		{name: "missing label", label: "", navType: "page", pageID: &pageID, wantErr: true},
		{name: "invalid type", label: "Home", navType: "invalid", pageID: &pageID, wantErr: true},
		{name: "missing page id", label: "Home", navType: "page", pageID: nil, wantErr: true},
		{name: "missing url", label: "External", navType: "url", url: nil, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateNavigationRequest(tt.label, tt.navType, tt.pageID, tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateNavigationRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
