package checkout

import (
	"context"
	"errors"
	"testing"

	stororders "goecommerce/internal/storage/orders"
)

type fakeEmailService struct {
	called int
	to     string
	lang   string
	data   map[string]any
	err    error
}

func (f *fakeEmailService) SendOrderConfirmation(_ context.Context, to, lang string, data map[string]any) error {
	f.called++
	f.to = to
	f.lang = lang
	f.data = data
	return f.err
}

func TestSendOrderConfirmationBestEffortNoService(t *testing.T) {
	m := &module{}
	m.sendOrderConfirmationBestEffort(context.Background(), stororders.Order{
		ID:     "ord-1",
		Number: "ORD-1",
	}, "customer@example.com", true, nil, "en-US,en;q=0.9")
}

func TestSendOrderConfirmationBestEffortServiceFailureDoesNotBreak(t *testing.T) {
	fake := &fakeEmailService{err: errors.New("smtp unavailable")}
	m := &module{email: fake}

	m.sendOrderConfirmationBestEffort(context.Background(), stororders.Order{
		ID:     "ord-2",
		Number: "ORD-2",
	}, "customer@example.com", true, nil, "lt-LT")

	if fake.called != 1 {
		t.Fatalf("expected send to be called once, got %d", fake.called)
	}
	if fake.to != "customer@example.com" {
		t.Fatalf("unexpected recipient: %q", fake.to)
	}
	if fake.lang != "lt" {
		t.Fatalf("unexpected language: %q", fake.lang)
	}
	if got := fake.data["OrderNumber"]; got != "ORD-2" {
		t.Fatalf("unexpected order number payload: %#v", got)
	}
}
