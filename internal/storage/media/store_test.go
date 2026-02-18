package media

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestSanitizePagination(t *testing.T) {
	tests := []struct {
		name       string
		in         ListAssetsParams
		wantLimit  int
		wantOffset int
	}{
		{name: "defaults", in: ListAssetsParams{}, wantLimit: 50, wantOffset: 0},
		{name: "custom", in: ListAssetsParams{Limit: 10, Offset: 5}, wantLimit: 10, wantOffset: 5},
		{name: "limit too high", in: ListAssetsParams{Limit: 999, Offset: 2}, wantLimit: 50, wantOffset: 2},
		{name: "offset negative", in: ListAssetsParams{Limit: 10, Offset: -9}, wantLimit: 10, wantOffset: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limit, offset := sanitizePagination(tt.in)
			if limit != tt.wantLimit || offset != tt.wantOffset {
				t.Fatalf("sanitizePagination(%+v) = (%d, %d), want (%d, %d)", tt.in, limit, offset, tt.wantLimit, tt.wantOffset)
			}
		})
	}
}

func TestStoreCreateAndListAssets(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping integration test")
	}

	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("new media store error (is migration 010 applied?): %v", err)
	}
	defer store.Close()

	suffix := time.Now().UnixNano()
	url := fmt.Sprintf("http://localhost:8080/uploads/test-%d.png", suffix)
	path := fmt.Sprintf("2026/02/test-%d.png", suffix)
	sourceURL := fmt.Sprintf("https://example.com/source-%d.png", suffix)

	created, err := store.CreateAsset(ctx, CreateAssetInput{
		URL:         url,
		StoragePath: path,
		MIMEType:    "image/png",
		SizeBytes:   321,
		Alt:         "Example image",
		SourceType:  SourceTypeURLImport,
		SourceURL:   &sourceURL,
	})
	if err != nil {
		t.Fatalf("create asset error: %v", err)
	}
	if created.ID == "" {
		t.Fatalf("expected created asset id")
	}
	if created.URL != url {
		t.Fatalf("expected url %q, got %q", url, created.URL)
	}

	items, err := store.ListAssets(ctx, ListAssetsParams{Limit: 20, Offset: 0})
	if err != nil {
		t.Fatalf("list assets error: %v", err)
	}

	found := false
	for _, item := range items {
		if item.ID != created.ID {
			continue
		}
		found = true
		if item.StoragePath != path {
			t.Fatalf("expected storage path %q, got %q", path, item.StoragePath)
		}
		if item.SourceType != SourceTypeURLImport {
			t.Fatalf("expected source type %q, got %q", SourceTypeURLImport, item.SourceType)
		}
		if item.SourceURL == nil || *item.SourceURL != sourceURL {
			t.Fatalf("expected source url %q, got %#v", sourceURL, item.SourceURL)
		}
	}
	if !found {
		t.Fatalf("created asset %s not found in list", created.ID)
	}
}
