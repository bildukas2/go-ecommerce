package catalog

import "testing"

func TestAtoiDefault(t *testing.T) {
	tests := []struct {
		name string
		in   string
		def  int
		want int
	}{
		{name: "valid", in: "12", def: 1, want: 12},
		{name: "trimmed", in: " 7 ", def: 1, want: 7},
		{name: "empty", in: "", def: 5, want: 5},
		{name: "invalid", in: "abc", def: 9, want: 9},
		{name: "zero", in: "0", def: 3, want: 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := atoiDefault(tt.in, tt.def)
			if got != tt.want {
				t.Fatalf("atoiDefault(%q, %d) = %d, want %d", tt.in, tt.def, got, tt.want)
			}
		})
	}
}
