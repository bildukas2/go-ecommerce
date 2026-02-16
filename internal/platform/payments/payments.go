package payments

import (
	"context"
	"fmt"
	"os"
)

type Provider interface {
	CreateCheckout(ctx context.Context, amountCents int, currency string, orderNumber string) (string, error)
}

type stripeStub struct {
	pub string
	sec string
}

func (s *stripeStub) CreateCheckout(_ context.Context, amountCents int, currency string, orderNumber string) (string, error) {
	_ = amountCents
	_ = currency
	return fmt.Sprintf("https://checkout.stripe.com/test/%s", orderNumber), nil
}

func NewFromEnv() Provider {
	pub := os.Getenv("STRIPE_PUBLIC_KEY")
	sec := os.Getenv("STRIPE_SECRET_KEY")
	return &stripeStub{pub: pub, sec: sec}
}
