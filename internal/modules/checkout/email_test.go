package checkout

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	stororders "goecommerce/internal/storage/orders"
	storpayments "goecommerce/internal/storage/payments"
)

type fakeEmailService struct {
	called int
	to     string
	lang   string
	data   map[string]any
	err    error
}

type fakePaymentStore struct {
	method *storpayments.PaymentMethod
	err    error
	last   string
}

func (f *fakePaymentStore) GetMethodByKey(_ context.Context, key string) (*storpayments.PaymentMethod, error) {
	f.last = key
	if f.err != nil {
		return nil, f.err
	}
	return f.method, nil
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

func TestSendOrderConfirmationBestEffortBankTransferPayload(t *testing.T) {
	cfg, _ := json.Marshal(storpayments.BankTransferConfig{
		AccountName:   "ACME UAB",
		AccountNumber: "1234567890",
		BankName:      "SEB",
		IBAN:          "LT123456789012345678",
		BICSwift:      "CBVILT2X",
		SortCode:      "70440",
	})
	payments := &fakePaymentStore{
		method: &storpayments.PaymentMethod{
			Title:        "Bank Transfer",
			Instructions: "Use order number as payment reference.",
			ConfigJSON:   cfg,
		},
	}
	email := &fakeEmailService{}
	m := &module{email: email, payments: payments}

	m.sendOrderConfirmationBestEffort(context.Background(), stororders.Order{
		ID:            "ord-3",
		Number:        "ORD-3",
		PaymentMethod: "bank_transfer",
		TotalCents:    12345,
		Currency:      "eur",
	}, "customer@example.com", true, nil, "en-US")

	if email.called != 1 {
		t.Fatalf("expected send to be called once, got %d", email.called)
	}
	if payments.last != "bank-transfer" {
		t.Fatalf("expected bank transfer key lookup, got %q", payments.last)
	}
	if got := email.data["IsBankTransfer"]; got != true {
		t.Fatalf("expected IsBankTransfer true, got %#v", got)
	}
	if got := email.data["Total"]; got != "123.45" {
		t.Fatalf("unexpected formatted total: %#v", got)
	}
	if got := email.data["Currency"]; got != "EUR" {
		t.Fatalf("unexpected currency: %#v", got)
	}
	if got := email.data["BankIBAN"]; got != "LT123456789012345678" {
		t.Fatalf("unexpected bank iban: %#v", got)
	}
}

func TestSendOrderConfirmationBestEffortNonBankTransferPayload(t *testing.T) {
	email := &fakeEmailService{}
	m := &module{email: email}

	m.sendOrderConfirmationBestEffort(context.Background(), stororders.Order{
		ID:            "ord-4",
		Number:        "ORD-4",
		PaymentMethod: "cash_on_delivery",
		TotalCents:    2500,
		Currency:      "eur",
	}, "customer@example.com", true, nil, "lt-LT")

	if email.called != 1 {
		t.Fatalf("expected send to be called once, got %d", email.called)
	}
	if got := email.data["IsBankTransfer"]; got != false {
		t.Fatalf("expected IsBankTransfer false, got %#v", got)
	}
}
