package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func findRepoRoot(t *testing.T) string {
	t.Helper()

	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("could not locate repo root from working directory")
		}
		dir = parent
	}
}

func TestAirConfigUsesEntrypointAndNoDeprecatedBuildBin(t *testing.T) {
	root := findRepoRoot(t)
	raw, err := os.ReadFile(filepath.Join(root, ".air.toml"))
	if err != nil {
		t.Fatalf("read .air.toml: %v", err)
	}

	content := string(raw)

	if strings.Contains(content, "\nbin =") || strings.Contains(content, "\n  bin =") {
		t.Fatal(".air.toml still contains deprecated build.bin")
	}
	if !strings.Contains(content, "entrypoint =") {
		t.Fatal(".air.toml must define build.entrypoint")
	}
	if !strings.Contains(content, `cmd = "go build -o`) {
		t.Fatal(".air.toml build.cmd must compile a binary via go build -o")
	}
}
