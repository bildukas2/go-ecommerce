package customers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	storcustomers "goecommerce/internal/storage/customers"
)

type blockedReportTestStore struct {
	createBlockedReportFn func(context.Context, storcustomers.CreateBlockedReportInput) (storcustomers.BlockedReport, error)
	insertActionLogFn     func(context.Context, storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error)
}

func (f *blockedReportTestStore) CreateCustomer(context.Context, string, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}
func (f *blockedReportTestStore) GetCustomerByEmail(context.Context, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}
func (f *blockedReportTestStore) CreateSession(context.Context, string, string, time.Time) (storcustomers.Session, error) {
	return storcustomers.Session{}, errors.New("not implemented")
}
func (f *blockedReportTestStore) GetCustomerBySessionTokenHash(context.Context, string) (storcustomers.Customer, error) {
	return storcustomers.Customer{}, errors.New("not implemented")
}
func (f *blockedReportTestStore) RevokeSessionByTokenHash(context.Context, string) error {
	return errors.New("not implemented")
}
func (f *blockedReportTestStore) RevokeSessionsByCustomerID(context.Context, string) error {
	return errors.New("not implemented")
}
func (f *blockedReportTestStore) AddFavorite(context.Context, string, string) (bool, error) {
	return false, errors.New("not implemented")
}
func (f *blockedReportTestStore) RemoveFavorite(context.Context, string, string) error {
	return errors.New("not implemented")
}
func (f *blockedReportTestStore) ListFavorites(context.Context, string, int, int) (storcustomers.FavoritesPage, error) {
	return storcustomers.FavoritesPage{}, errors.New("not implemented")
}
func (f *blockedReportTestStore) ListOrdersByCustomer(context.Context, string, int, int) (storcustomers.OrdersPage, error) {
	return storcustomers.OrdersPage{}, errors.New("not implemented")
}
func (f *blockedReportTestStore) UpdatePasswordAndRevokeSessions(context.Context, string, string) error {
	return errors.New("not implemented")
}

func (f *blockedReportTestStore) CreateBlockedReport(
	ctx context.Context,
	in storcustomers.CreateBlockedReportInput,
) (storcustomers.BlockedReport, error) {
	if f.createBlockedReportFn == nil {
		return storcustomers.BlockedReport{}, nil
	}
	return f.createBlockedReportFn(ctx, in)
}

func (f *blockedReportTestStore) InsertCustomerActionLog(
	ctx context.Context,
	in storcustomers.CreateCustomerActionLogInput,
) (storcustomers.CustomerActionLog, error) {
	if f.insertActionLogFn == nil {
		return storcustomers.CustomerActionLog{}, nil
	}
	return f.insertActionLogFn(ctx, in)
}

func TestSanitizeBlockedReportMessageRejectsHTMLAndHiddenChars(t *testing.T) {
	if _, err := sanitizeBlockedReportMessage("<b>hello</b>"); err == nil {
		t.Fatalf("expected html validation error")
	}
	if _, err := sanitizeBlockedReportMessage("hello\u200Bworld"); err == nil {
		t.Fatalf("expected hidden character validation error")
	}
}

func TestHandleBlockedReportSuccess(t *testing.T) {
	var (
		capturedReport *storcustomers.CreateBlockedReportInput
		capturedLog    *storcustomers.CreateCustomerActionLogInput
	)
	store := &blockedReportTestStore{
		createBlockedReportFn: func(_ context.Context, in storcustomers.CreateBlockedReportInput) (storcustomers.BlockedReport, error) {
			copy := in
			capturedReport = &copy
			return storcustomers.BlockedReport{ID: "rep-1"}, nil
		},
		insertActionLogFn: func(_ context.Context, in storcustomers.CreateCustomerActionLogInput) (storcustomers.CustomerActionLog, error) {
			copy := in
			capturedLog = &copy
			return storcustomers.CustomerActionLog{}, nil
		},
	}
	m := &module{store: store, sessionTTL: defaultSessionTTL, now: time.Now}

	body, err := json.Marshal(map[string]string{
		"email":   "blocked@example.com",
		"message": "I believe this block is a mistake",
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/support/blocked-report", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", "198.51.100.88")
	res := httptest.NewRecorder()
	m.handleBlockedReport(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, res.Code)
	}
	if capturedReport == nil {
		t.Fatalf("expected blocked report persistence")
	}
	if capturedReport.IP != "198.51.100.88" {
		t.Fatalf("unexpected report ip %q", capturedReport.IP)
	}
	if capturedLog == nil || capturedLog.Action != "blocked.report_submitted" {
		t.Fatalf("expected blocked report action log, got %#v", capturedLog)
	}
}

func TestHandleBlockedReportRejectsHTMLPayload(t *testing.T) {
	store := &blockedReportTestStore{}
	m := &module{store: store, sessionTTL: defaultSessionTTL, now: time.Now}

	body, err := json.Marshal(map[string]string{
		"email":   "blocked@example.com",
		"message": "<script>alert(1)</script>",
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/support/blocked-report", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	m.handleBlockedReport(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}
