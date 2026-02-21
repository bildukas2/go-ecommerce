package shipping

import (
	"context"
	"time"
)

type Provider struct {
	ID        string
	Key       string
	Name      string
	Enabled   bool
	Mode      string
	ConfigJSON []byte
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Zone struct {
	ID            string
	Name          string
	CountriesJSON []byte
	Enabled       bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Method struct {
	ID               string
	ZoneID           string
	ProviderKey      string
	ServiceCode      string
	Title            string
	Enabled          bool
	SortOrder        int
	PricingMode      string
	PricingRulesJSON []byte
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type ProvidersStore interface {
	CreateProvider(ctx context.Context, key, name string, mode string, configJSON []byte) error
	UpdateProvider(ctx context.Context, key string, enabled bool, mode string, configJSON []byte) error
	GetProvider(ctx context.Context, key string) (*Provider, error)
	ListProviders(ctx context.Context) ([]Provider, error)
	DeleteProvider(ctx context.Context, key string) error
}

type ZonesStore interface {
	CreateZone(ctx context.Context, name string, countriesJSON []byte) (string, error)
	UpdateZone(ctx context.Context, id string, name string, countriesJSON []byte, enabled bool) error
	GetZone(ctx context.Context, id string) (*Zone, error)
	ListZones(ctx context.Context) ([]Zone, error)
	DeleteZone(ctx context.Context, id string) error
	GetZoneByCountry(ctx context.Context, country string) (*Zone, error)
}

type MethodsStore interface {
	CreateMethod(ctx context.Context, method Method) (string, error)
	UpdateMethod(ctx context.Context, method Method) error
	GetMethod(ctx context.Context, id string) (*Method, error)
	ListMethodsByZone(ctx context.Context, zoneID string) ([]Method, error)
	ListMethods(ctx context.Context) ([]Method, error)
	DeleteMethod(ctx context.Context, id string) error
}

type TerminalsStore interface {
	GetCachedTerminals(ctx context.Context, providerKey, country string) ([]byte, time.Time, error)
	UpsertCachedTerminals(ctx context.Context, providerKey, country string, payloadJSON []byte) error
	DeleteCachedTerminals(ctx context.Context, providerKey, country string) error
}
