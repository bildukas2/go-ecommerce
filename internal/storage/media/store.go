package media

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

const (
	SourceTypeUpload    = "upload"
	SourceTypeURLImport = "url_import"
)

type Asset struct {
	ID          string    `json:"id"`
	URL         string    `json:"url"`
	StoragePath string    `json:"storage_path"`
	MIMEType    string    `json:"mime_type"`
	SizeBytes   int64     `json:"size_bytes"`
	Alt         string    `json:"alt"`
	SourceType  string    `json:"source_type"`
	SourceURL   *string   `json:"source_url"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateAssetInput struct {
	URL         string
	StoragePath string
	MIMEType    string
	SizeBytes   int64
	Alt         string
	SourceType  string
	SourceURL   *string
}

type ListAssetsParams struct {
	Limit  int
	Offset int
}

type Store struct {
	db *sql.DB

	stmtCreateAsset *sql.Stmt
	stmtListAssets  *sql.Stmt
}

func NewStore(ctx context.Context, db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}

	stmtCreateAsset, err := db.PrepareContext(ctx, `
		INSERT INTO media_assets (url, storage_path, mime_type, size_bytes, alt, source_type, source_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, url, storage_path, mime_type, size_bytes, alt, source_type, source_url, created_at`)
	if err != nil {
		return nil, err
	}

	stmtListAssets, err := db.PrepareContext(ctx, `
		SELECT id, url, storage_path, mime_type, size_bytes, alt, source_type, source_url, created_at
		FROM media_assets
		ORDER BY created_at DESC, id DESC
		LIMIT $1 OFFSET $2`)
	if err != nil {
		_ = stmtCreateAsset.Close()
		return nil, err
	}

	return &Store{
		db:              db,
		stmtCreateAsset: stmtCreateAsset,
		stmtListAssets:  stmtListAssets,
	}, nil
}

func (s *Store) Close() error {
	var firstErr error
	for _, stmt := range []*sql.Stmt{s.stmtCreateAsset, s.stmtListAssets} {
		if stmt == nil {
			continue
		}
		if err := stmt.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func (s *Store) CreateAsset(ctx context.Context, in CreateAssetInput) (Asset, error) {
	var (
		out          Asset
		sourceURLRaw sql.NullString
	)

	err := s.stmtCreateAsset.QueryRowContext(
		ctx,
		in.URL,
		in.StoragePath,
		in.MIMEType,
		in.SizeBytes,
		in.Alt,
		in.SourceType,
		toNullString(in.SourceURL),
	).Scan(
		&out.ID,
		&out.URL,
		&out.StoragePath,
		&out.MIMEType,
		&out.SizeBytes,
		&out.Alt,
		&out.SourceType,
		&sourceURLRaw,
		&out.CreatedAt,
	)
	if err != nil {
		return Asset{}, err
	}
	if sourceURLRaw.Valid {
		out.SourceURL = &sourceURLRaw.String
	}
	return out, nil
}

func (s *Store) ListAssets(ctx context.Context, in ListAssetsParams) ([]Asset, error) {
	limit, offset := sanitizePagination(in)

	rows, err := s.stmtListAssets.QueryContext(ctx, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Asset, 0, limit)
	for rows.Next() {
		var (
			item         Asset
			sourceURLRaw sql.NullString
		)
		if err := rows.Scan(
			&item.ID,
			&item.URL,
			&item.StoragePath,
			&item.MIMEType,
			&item.SizeBytes,
			&item.Alt,
			&item.SourceType,
			&sourceURLRaw,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if sourceURLRaw.Valid {
			item.SourceURL = &sourceURLRaw.String
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func sanitizePagination(in ListAssetsParams) (limit, offset int) {
	limit = in.Limit
	offset = in.Offset
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return
}

func toNullString(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	if *v == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *v, Valid: true}
}
