package payments

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

type PaymentMethod struct {
	ID           string          `json:"id"`
	Key          string          `json:"key"`
	Title        string          `json:"title"`
	Description  string          `json:"description"`
	Instructions string          `json:"instructions"`
	Enabled      bool            `json:"enabled"`
	PaymentType  string          `json:"payment_type"`
	ConfigJSON   json.RawMessage `json:"config_json"`
	SortOrder    int             `json:"sort_order"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type BankTransferConfig struct {
	AccountName   string `json:"account_name"`
	AccountNumber string `json:"account_number"`
	BankName      string `json:"bank_name"`
	SortCode      string `json:"sort_code,omitempty"`
	IBAN          string `json:"iban,omitempty"`
	BICSwift      string `json:"bic_swift,omitempty"`
}

type MethodsStore interface {
	CreateMethod(ctx context.Context, method PaymentMethod) (string, error)
	UpdateMethod(ctx context.Context, method PaymentMethod) error
	DeleteMethod(ctx context.Context, id string) error
	GetMethod(ctx context.Context, id string) (*PaymentMethod, error)
	GetMethodByKey(ctx context.Context, key string) (*PaymentMethod, error)
	ListMethods(ctx context.Context) ([]PaymentMethod, error)
}

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}
