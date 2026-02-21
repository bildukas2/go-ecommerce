package shipping

import "context"

type Provider interface {
	ListTerminals(ctx context.Context, country string) ([]Terminal, error)
	Quote(ctx context.Context, req QuoteRequest) ([]ShippingOption, error)
}

type Terminal struct {
	ID      string
	Name    string
	Country string
	City    string
	Address string
	Lat     float64
	Lon     float64
	Hours   string
}

type QuoteRequest struct {
	Weight     float64
	Country    string
	ZipCode    string
	Dimensions *Dimensions
}

type Dimensions struct {
	Length float64
	Width  float64
	Height float64
}

type ShippingOption struct {
	ServiceCode string
	ServiceName string
	Price       int
	Currency    string
	Estimate    string
	MetaJSON    map[string]any
}

type ProviderFactory func(config map[string]any) (Provider, error)
