package shipping

import "context"

// Capabilities describes what features a shipping provider supports
type Capabilities struct {
	Terminals      bool // ListTerminals supported
	CreateShipment bool // ShipmentCreator interface
	Labels         bool // LabelProvider interface
	Tracking       bool // Tracker interface
	Pickup         bool // PickupRequester interface
}

// Provider is the base interface for shipping providers
type Provider interface {
	// Key returns the unique identifier for this provider (e.g., "omniva")
	Key() string
	// Name returns the human-readable name (e.g., "Omniva")
	Name() string
	// Capabilities returns what features this provider supports
	Capabilities() Capabilities
	// ListTerminals returns parcel terminals/lockers for a country
	ListTerminals(ctx context.Context, country string) ([]Terminal, error)
}

// QuoteProvider is an optional interface for live rate quoting
type QuoteProvider interface {
	Quote(ctx context.Context, req QuoteRequest) ([]ShippingOption, error)
}

// ShipmentCreator is an optional interface for creating shipments
type ShipmentCreator interface {
	CreateShipment(ctx context.Context, req ShipmentRequest) (*ShipmentResult, error)
}

// LabelProvider is an optional interface for label generation
type LabelProvider interface {
	GetLabel(ctx context.Context, shipmentID string) ([]byte, error)
}

// Tracker is an optional interface for shipment tracking
type Tracker interface {
	GetTracking(ctx context.Context, trackingNumber string) (*TrackingInfo, error)
}

// PickupRequester is an optional interface for courier pickup
type PickupRequester interface {
	RequestPickup(ctx context.Context, req PickupRequest) (*PickupResult, error)
}

type Terminal struct {
	ID       string
	Name     string
	Country  string
	City     string
	Address  string
	Postcode string
	Lat      float64
	Lon      float64
	Hours    string
	Type     string // parcel_locker, post_office, etc.
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

// ShipmentRequest represents a request to create a shipment
type ShipmentRequest struct {
	Recipient   ContactInfo
	Sender      ContactInfo
	Parcel      ParcelInfo
	ServiceCode string
	Reference   string
}

// ShipmentResult represents the result of creating a shipment
type ShipmentResult struct {
	ShipmentID     string
	TrackingNumber string
	LabelURL       string
}

// ContactInfo represents address information
type ContactInfo struct {
	Name     string
	Phone    string
	Email    string
	Address  string
	City     string
	Postcode string
	Country  string
}

// ParcelInfo represents parcel dimensions and weight
type ParcelInfo struct {
	Weight float64
	Length float64
	Width  float64
	Height float64
}

// TrackingInfo represents shipment tracking data
type TrackingInfo struct {
	TrackingNumber string
	Status         string
	Events         []TrackingEvent
}

// TrackingEvent represents a single tracking event
type TrackingEvent struct {
	Timestamp string
	Status    string
	Location  string
	Message   string
}

// PickupRequest represents a courier pickup request
type PickupRequest struct {
	Address      ContactInfo
	Parcels      int
	ReadyTime    string
	ContactName  string
	ContactPhone string
}

// PickupResult represents the result of a pickup request
type PickupResult struct {
	PickupID    string
	ConfirmedAt string
}

type ProviderFactory func(config map[string]any) (Provider, error)
