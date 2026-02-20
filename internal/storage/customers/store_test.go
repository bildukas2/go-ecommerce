package customers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	platformdb "goecommerce/internal/platform/db"
)

func TestFavoritesDuplicateSafeAndCustomerScoped(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "customer_favorites")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}
	productID := lookupProductID(t, ctx, db)

	c1, err := store.CreateCustomer(ctx, fmt.Sprintf("fav-c1-%d@example.com", time.Now().UnixNano()), "hash-c1")
	if err != nil {
		t.Fatalf("create customer 1: %v", err)
	}
	c2, err := store.CreateCustomer(ctx, fmt.Sprintf("fav-c2-%d@example.com", time.Now().UnixNano()), "hash-c2")
	if err != nil {
		t.Fatalf("create customer 2: %v", err)
	}

	created, err := store.AddFavorite(ctx, c1.ID, productID)
	if err != nil {
		t.Fatalf("add favorite first: %v", err)
	}
	if !created {
		t.Fatalf("expected first add favorite to create row")
	}
	createdAgain, err := store.AddFavorite(ctx, c1.ID, productID)
	if err != nil {
		t.Fatalf("add favorite duplicate: %v", err)
	}
	if createdAgain {
		t.Fatalf("expected duplicate favorite insert to be no-op")
	}

	c1Favorites, err := store.ListFavorites(ctx, c1.ID, 1, 20)
	if err != nil {
		t.Fatalf("list customer 1 favorites: %v", err)
	}
	if len(c1Favorites.Items) != 1 {
		t.Fatalf("expected customer 1 favorites count 1, got %d", len(c1Favorites.Items))
	}
	if c1Favorites.Items[0].ProductID != productID {
		t.Fatalf("expected favorite product %s, got %s", productID, c1Favorites.Items[0].ProductID)
	}

	c2Favorites, err := store.ListFavorites(ctx, c2.ID, 1, 20)
	if err != nil {
		t.Fatalf("list customer 2 favorites: %v", err)
	}
	if len(c2Favorites.Items) != 0 {
		t.Fatalf("expected customer 2 favorites count 0, got %d", len(c2Favorites.Items))
	}
}

func TestListOrdersByCustomerScopedAndIncludesItemSummaries(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "orders")
	assertTableExists(t, ctx, db, "order_items")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}
	c1, err := store.CreateCustomer(ctx, fmt.Sprintf("ord-c1-%d@example.com", time.Now().UnixNano()), "hash-c1")
	if err != nil {
		t.Fatalf("create customer 1: %v", err)
	}
	c2, err := store.CreateCustomer(ctx, fmt.Sprintf("ord-c2-%d@example.com", time.Now().UnixNano()), "hash-c2")
	if err != nil {
		t.Fatalf("create customer 2: %v", err)
	}

	variantID, unitPrice, currency := lookupVariantForOrder(t, ctx, db)
	o1 := insertTestOrder(t, ctx, db, c1.ID)
	insertTestOrderItem(t, ctx, db, o1, variantID, unitPrice, currency)
	o2 := insertTestOrder(t, ctx, db, c2.ID)
	insertTestOrderItem(t, ctx, db, o2, variantID, unitPrice, currency)

	c1Orders, err := store.ListOrdersByCustomer(ctx, c1.ID, 1, 20)
	if err != nil {
		t.Fatalf("list customer 1 orders: %v", err)
	}
	if len(c1Orders.Items) != 1 {
		t.Fatalf("expected customer 1 orders count 1, got %d", len(c1Orders.Items))
	}
	if c1Orders.Items[0].ID != o1 {
		t.Fatalf("expected order %s, got %s", o1, c1Orders.Items[0].ID)
	}
	if len(c1Orders.Items[0].Items) == 0 {
		t.Fatalf("expected order item summaries")
	}
	if c1Orders.Items[0].Items[0].Quantity != 2 {
		t.Fatalf("expected quantity 2, got %d", c1Orders.Items[0].Items[0].Quantity)
	}
}

func TestUpdatePasswordAndRevokeSessions(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "customer_sessions")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}
	customer, err := store.CreateCustomer(ctx, fmt.Sprintf("pwd-%d@example.com", time.Now().UnixNano()), "old-hash")
	if err != nil {
		t.Fatalf("create customer: %v", err)
	}
	if _, err := store.CreateSession(ctx, customer.ID, fmt.Sprintf("tok-a-%d", time.Now().UnixNano()), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("create session a: %v", err)
	}
	if _, err := store.CreateSession(ctx, customer.ID, fmt.Sprintf("tok-b-%d", time.Now().UnixNano()), time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("create session b: %v", err)
	}

	if err := store.UpdatePasswordAndRevokeSessions(ctx, customer.ID, "new-hash"); err != nil {
		t.Fatalf("update password and revoke sessions: %v", err)
	}

	var gotHash string
	if err := db.QueryRowContext(ctx, "SELECT password_hash FROM customers WHERE id = $1", customer.ID).Scan(&gotHash); err != nil {
		t.Fatalf("query password hash: %v", err)
	}
	if gotHash != "new-hash" {
		t.Fatalf("expected updated hash new-hash, got %s", gotHash)
	}

	var activeSessions int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM customer_sessions WHERE customer_id = $1 AND revoked_at IS NULL", customer.ID).Scan(&activeSessions); err != nil {
		t.Fatalf("count active sessions: %v", err)
	}
	if activeSessions != 0 {
		t.Fatalf("expected zero active sessions after password change, got %d", activeSessions)
	}
}

func TestCustomerGroupsCreateUpdateDeleteAndListCounts(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customer_groups")
	assertTableExists(t, ctx, db, "customers")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	seed := time.Now().UnixNano()
	created, err := store.CreateCustomerGroup(ctx, fmt.Sprintf("VIP %d", seed), fmt.Sprintf("vip-%d", seed))
	if err != nil {
		t.Fatalf("create group: %v", err)
	}
	if created.CustomerCount != 0 {
		t.Fatalf("expected empty group count, got %d", created.CustomerCount)
	}

	customer, err := store.CreateCustomer(ctx, fmt.Sprintf("group-count-%d@example.com", seed), "hash")
	if err != nil {
		t.Fatalf("create customer: %v", err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE customers SET group_id = $2::uuid WHERE id = $1::uuid`, customer.ID, created.ID); err != nil {
		t.Fatalf("assign customer to group: %v", err)
	}

	list, err := store.ListCustomerGroups(ctx)
	if err != nil {
		t.Fatalf("list groups: %v", err)
	}
	var listed *CustomerGroup
	for i := range list {
		if list[i].ID == created.ID {
			listed = &list[i]
			break
		}
	}
	if listed == nil {
		t.Fatalf("created group not present in list")
	}
	if listed.CustomerCount != 1 {
		t.Fatalf("expected group customer count 1, got %d", listed.CustomerCount)
	}

	updated, err := store.UpdateCustomerGroup(ctx, created.ID, fmt.Sprintf("VIP Updated %d", seed), fmt.Sprintf("vip-updated-%d", seed))
	if err != nil {
		t.Fatalf("update group: %v", err)
	}
	if updated.Code != fmt.Sprintf("vip-updated-%d", seed) {
		t.Fatalf("expected updated code, got %s", updated.Code)
	}
	if updated.CustomerCount != 1 {
		t.Fatalf("expected updated group count 1, got %d", updated.CustomerCount)
	}

	if err := store.DeleteCustomerGroup(ctx, created.ID); !errors.Is(err, ErrGroupAssigned) {
		t.Fatalf("expected ErrGroupAssigned when deleting assigned group, got %v", err)
	}

	if _, err := db.ExecContext(ctx, `UPDATE customers SET group_id = NULL WHERE id = $1::uuid`, customer.ID); err != nil {
		t.Fatalf("clear customer group assignment: %v", err)
	}
	if err := store.DeleteCustomerGroup(ctx, created.ID); err != nil {
		t.Fatalf("delete group after unassign: %v", err)
	}
}

func TestCustomerGroupsProtectSystemGuestGroup(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customer_groups")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	var systemID string
	if err := db.QueryRowContext(ctx, `SELECT id FROM customer_groups WHERE code = 'not-logged-in'`).Scan(&systemID); err != nil {
		t.Fatalf("query system group: %v", err)
	}

	_, err = store.UpdateCustomerGroup(ctx, systemID, "Renamed", "renamed")
	if !errors.Is(err, ErrProtected) {
		t.Fatalf("expected ErrProtected on system group update, got %v", err)
	}

	err = store.DeleteCustomerGroup(ctx, systemID)
	if !errors.Is(err, ErrProtected) {
		t.Fatalf("expected ErrProtected on system group delete, got %v", err)
	}
}

func TestCustomerGroupsCreateConflict(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customer_groups")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	seed := time.Now().UnixNano()
	name := fmt.Sprintf("Wholesale Duplicate %d", seed)
	code := fmt.Sprintf("dup-group-%d", seed)
	if _, err := store.CreateCustomerGroup(ctx, name, code); err != nil {
		t.Fatalf("create first group: %v", err)
	}

	_, err = store.CreateCustomerGroup(ctx, name, code)
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict on duplicate group create, got %v", err)
	}
}

func TestCustomerActionLogsInsertAndFilterPagination(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customer_action_logs")
	assertTableExists(t, ctx, db, "customers")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	customer, err := store.CreateCustomer(ctx, fmt.Sprintf("log-%d@example.com", time.Now().UnixNano()), "hash")
	if err != nil {
		t.Fatalf("create customer: %v", err)
	}

	created, err := store.InsertCustomerActionLog(ctx, CreateCustomerActionLogInput{
		CustomerID: &customer.ID,
		IP:         "203.0.113.5",
		Action:     "customer.created",
		Severity:   ptrString("info"),
		MetaJSON:   []byte(`{"source":"store-test"}`),
	})
	if err != nil {
		t.Fatalf("insert customer action log: %v", err)
	}
	if created.IP == "" {
		t.Fatalf("expected non-empty IP in stored log")
	}

	if _, err := store.InsertCustomerActionLog(ctx, CreateCustomerActionLogInput{
		IP:     "203.0.113.6",
		Action: "ip.blocked",
	}); err != nil {
		t.Fatalf("insert security action log: %v", err)
	}

	from := time.Now().UTC().Add(-time.Hour)
	to := time.Now().UTC().Add(time.Hour)
	list, err := store.ListCustomerActionLogs(ctx, ListCustomerActionLogsParams{
		Page:   1,
		Limit:  1,
		Query:  "203.0.113.5",
		Action: "customer.created",
		From:   &from,
		To:     &to,
	})
	if err != nil {
		t.Fatalf("list customer action logs: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected exactly one filtered log row, got %d", len(list.Items))
	}
	if list.Items[0].IP != "203.0.113.5" {
		t.Fatalf("unexpected log IP: %s", list.Items[0].IP)
	}
}

func TestAdminCustomersCRUDAndFiltering(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "customers")
	assertTableExists(t, ctx, db, "customer_groups")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	seed := time.Now().UnixNano()
	groupA, err := store.CreateCustomerGroup(ctx, fmt.Sprintf("Admin Test A %d", seed), fmt.Sprintf("admin-test-a-%d", seed))
	if err != nil {
		t.Fatalf("create group A: %v", err)
	}
	groupB, err := store.CreateCustomerGroup(ctx, fmt.Sprintf("Admin Test B %d", seed), fmt.Sprintf("admin-test-b-%d", seed))
	if err != nil {
		t.Fatalf("create group B: %v", err)
	}

	emailOne := fmt.Sprintf("admin-customer-%d@example.com", seed)
	customerOne, err := store.CreateAdminCustomer(ctx, AdminCustomerUpsertInput{
		Email:            &emailOne,
		Phone:            ptrString("+1 202 555 0101"),
		FirstName:        "Alice",
		LastName:         "Admin",
		Status:           "active",
		GroupID:          &groupA.ID,
		IsAnonymous:      false,
		ShippingFullName: "Alice Admin",
		ShippingAddress1: "100 Main Street",
		ShippingCity:     "Austin",
		ShippingCountry:  "US",
		BillingFullName:  "Alice Admin",
		BillingAddress1:  "100 Main Street",
		BillingCity:      "Austin",
		BillingCountry:   "US",
		CompanyName:      "Example LLC",
		CompanyVAT:       "US-TAX-100",
		WantsInvoice:     true,
	})
	if err != nil {
		t.Fatalf("create admin customer one: %v", err)
	}
	if customerOne.Email == nil || *customerOne.Email != emailOne {
		t.Fatalf("unexpected customer one email: %#v", customerOne.Email)
	}

	customerTwo, err := store.CreateAdminCustomer(ctx, AdminCustomerUpsertInput{
		Status:      "disabled",
		GroupID:     &groupB.ID,
		IsAnonymous: true,
		FirstName:   "Guest",
		LastName:    "Checkout",
	})
	if err != nil {
		t.Fatalf("create admin customer two: %v", err)
	}
	if !customerTwo.IsAnonymous {
		t.Fatalf("expected second customer to be anonymous")
	}
	if customerTwo.Email != nil {
		t.Fatalf("expected anonymous customer email to be nil")
	}

	updatedOne, err := store.UpdateAdminCustomer(ctx, customerOne.ID, AdminCustomerUpsertInput{
		Email:            &emailOne,
		Phone:            ptrString("+1 202 555 0199"),
		FirstName:        "Alice",
		LastName:         "Updated",
		Status:           "disabled",
		GroupID:          &groupB.ID,
		IsAnonymous:      false,
		ShippingFullName: "Alice Updated",
		ShippingAddress1: "250 Updated Road",
		ShippingCity:     "Dallas",
		ShippingCountry:  "US",
		BillingFullName:  "Alice Updated",
		BillingAddress1:  "250 Updated Road",
		BillingCity:      "Dallas",
		BillingCountry:   "US",
		WantsInvoice:     false,
	})
	if err != nil {
		t.Fatalf("update admin customer one: %v", err)
	}
	if updatedOne.LastName != "Updated" || updatedOne.Status != "disabled" {
		t.Fatalf("unexpected updated customer payload: %#v", updatedOne)
	}
	if updatedOne.GroupID == nil || *updatedOne.GroupID != groupB.ID {
		t.Fatalf("expected updated customer group to be group B")
	}

	reEnabledOne, err := store.UpdateAdminCustomerStatus(ctx, customerOne.ID, "active")
	if err != nil {
		t.Fatalf("update admin customer status: %v", err)
	}
	if reEnabledOne.Status != "active" {
		t.Fatalf("expected status active, got %s", reEnabledOne.Status)
	}
	if _, err := store.InsertCustomerActionLog(ctx, CreateCustomerActionLogInput{
		CustomerID: &customerOne.ID,
		IP:         "198.51.100.200",
		Action:     "customer.updated",
	}); err != nil {
		t.Fatalf("insert customer one action log: %v", err)
	}
	if _, err := store.InsertCustomerActionLog(ctx, CreateCustomerActionLogInput{
		CustomerID: &customerTwo.ID,
		IP:         "198.51.100.201",
		Action:     "customer.created",
	}); err != nil {
		t.Fatalf("insert customer two action log: %v", err)
	}

	activeFiltered, err := store.ListCustomers(ctx, AdminCustomersListParams{
		Page:   1,
		Limit:  20,
		Status: "active",
	})
	if err != nil {
		t.Fatalf("list active customers: %v", err)
	}
	foundActive := false
	for _, item := range activeFiltered.Items {
		if item.ID == customerOne.ID {
			foundActive = true
			if item.LatestIP == nil || *item.LatestIP != "198.51.100.200" {
				t.Fatalf("expected latest customer IP for customer one, got %#v", item.LatestIP)
			}
		}
	}
	if !foundActive {
		t.Fatalf("expected active filter to include customer one")
	}

	anonymousFiltered, err := store.ListCustomers(ctx, AdminCustomersListParams{
		Page:      1,
		Limit:     20,
		Anonymous: "anonymous",
	})
	if err != nil {
		t.Fatalf("list anonymous customers: %v", err)
	}
	foundAnonymous := false
	for _, item := range anonymousFiltered.Items {
		if item.ID == customerTwo.ID {
			foundAnonymous = true
		}
	}
	if !foundAnonymous {
		t.Fatalf("expected anonymous filter to include customer two")
	}

	queryFiltered, err := store.ListCustomers(ctx, AdminCustomersListParams{
		Page:  1,
		Limit: 20,
		Query: "Alice Updated",
	})
	if err != nil {
		t.Fatalf("list queried customers: %v", err)
	}
	foundQuery := false
	for _, item := range queryFiltered.Items {
		if item.ID == customerOne.ID {
			foundQuery = true
		}
	}
	if !foundQuery {
		t.Fatalf("expected query filter to include customer one")
	}

	groupFiltered, err := store.ListCustomers(ctx, AdminCustomersListParams{
		Page:    1,
		Limit:   20,
		GroupID: groupB.ID,
	})
	if err != nil {
		t.Fatalf("list grouped customers: %v", err)
	}
	foundGroupA := false
	foundGroupB := false
	for _, item := range groupFiltered.Items {
		if item.ID == customerOne.ID {
			foundGroupA = true
		}
		if item.ID == customerTwo.ID {
			foundGroupB = true
		}
	}
	if !foundGroupA || !foundGroupB {
		t.Fatalf("expected group filter to include both customers after reassignment")
	}

	anonSorted, err := store.ListCustomers(ctx, AdminCustomersListParams{
		Page:  1,
		Limit: 50,
		Sort:  "anonymous_desc",
	})
	if err != nil {
		t.Fatalf("list sorted customers: %v", err)
	}
	customerOneIndex := -1
	customerTwoIndex := -1
	for i, item := range anonSorted.Items {
		if item.ID == customerOne.ID {
			customerOneIndex = i
		}
		if item.ID == customerTwo.ID {
			customerTwoIndex = i
		}
	}
	if customerOneIndex == -1 || customerTwoIndex == -1 {
		t.Fatalf("expected sorted results to include test customers")
	}
	if customerTwoIndex >= customerOneIndex {
		t.Fatalf("expected anonymous_desc sort to place anonymous customer before registered one")
	}
}

func TestAdminCustomersCreateRejectsMissingEmailForRegistered(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	_, err = store.CreateAdminCustomer(ctx, AdminCustomerUpsertInput{
		FirstName:   "No",
		LastName:    "Email",
		Status:      "active",
		IsAnonymous: false,
	})
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for registered customer without email, got %v", err)
	}
}

func TestBlockedIPsCreateDeleteAndLookup(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "blocked_ips")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	seed := time.Now().UnixNano()
	reason := "integration-block"
	expiresAt := time.Now().UTC().Add(2 * time.Hour).Round(time.Second)
	blocked, err := store.CreateBlockedIP(ctx, CreateBlockedIPInput{
		IP:        fmt.Sprintf("198.51.100.%d", seed%200+1),
		Reason:    &reason,
		ExpiresAt: &expiresAt,
	})
	if err != nil {
		t.Fatalf("create blocked ip: %v", err)
	}
	if blocked.ID == "" || blocked.IP == "" {
		t.Fatalf("expected blocked ip payload with id and ip")
	}

	isBlocked, err := store.IsIPBlocked(ctx, blocked.IP)
	if err != nil {
		t.Fatalf("lookup blocked ip: %v", err)
	}
	if !isBlocked {
		t.Fatalf("expected ip to be blocked")
	}

	deleted, err := store.DeleteBlockedIP(ctx, blocked.ID)
	if err != nil {
		t.Fatalf("delete blocked ip: %v", err)
	}
	if deleted.ID != blocked.ID {
		t.Fatalf("expected deleted id %s, got %s", blocked.ID, deleted.ID)
	}

	isBlocked, err = store.IsIPBlocked(ctx, blocked.IP)
	if err != nil {
		t.Fatalf("lookup blocked ip after delete: %v", err)
	}
	if isBlocked {
		t.Fatalf("expected ip to be unblocked after delete")
	}
}

func TestBlockedReportsCreate(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping customers integration test")
	}
	ctx := context.Background()
	db, err := platformdb.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("db open error: %v", err)
	}
	defer db.Close()

	assertTableExists(t, ctx, db, "blocked_reports")

	store, err := NewStore(ctx, db)
	if err != nil {
		t.Fatalf("customers store init: %v", err)
	}

	report, err := store.CreateBlockedReport(ctx, CreateBlockedReportInput{
		IP:      "203.0.113.44",
		Email:   fmt.Sprintf("blocked-report-%d@example.com", time.Now().UnixNano()),
		Message: "Please review this block.",
	})
	if err != nil {
		t.Fatalf("create blocked report: %v", err)
	}
	if report.ID == "" {
		t.Fatalf("expected persisted report id")
	}
	if report.IP != "203.0.113.44" {
		t.Fatalf("unexpected report ip: %s", report.IP)
	}
}

func ptrString(v string) *string {
	return &v
}

func assertTableExists(t *testing.T, ctx context.Context, db *sql.DB, name string) {
	t.Helper()
	var regclass *string
	if err := db.QueryRowContext(ctx, "SELECT to_regclass('public."+name+"')").Scan(&regclass); err != nil || regclass == nil || *regclass == "" {
		t.Skipf("%s table not present; apply migrations to run this test", name)
	}
}

func lookupProductID(t *testing.T, ctx context.Context, db *sql.DB) string {
	t.Helper()
	var productID string
	if err := db.QueryRowContext(ctx, "SELECT id FROM products LIMIT 1").Scan(&productID); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no products seeded; skipping")
		}
		t.Fatalf("lookup product id: %v", err)
	}
	return productID
}

func lookupVariantForOrder(t *testing.T, ctx context.Context, db *sql.DB) (string, int, string) {
	t.Helper()
	var (
		variantID string
		price     int
		currency  string
	)
	if err := db.QueryRowContext(ctx, "SELECT id, price_cents, currency FROM product_variants LIMIT 1").Scan(&variantID, &price, &currency); err != nil {
		if err == sql.ErrNoRows {
			t.Skip("no product variants seeded; skipping")
		}
		t.Fatalf("lookup variant: %v", err)
	}
	return variantID, price, currency
}

func insertTestOrder(t *testing.T, ctx context.Context, db *sql.DB, customerID string) string {
	t.Helper()
	var orderID string
	number := fmt.Sprintf("ORD-T-%d", time.Now().UnixNano())
	if err := db.QueryRowContext(ctx, `
		INSERT INTO orders (number, status, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, customer_id)
		VALUES ($1, 'pending_payment', 'USD', 1000, 0, 0, 1000, $2)
		RETURNING id
	`, number, customerID).Scan(&orderID); err != nil {
		t.Fatalf("insert test order: %v", err)
	}
	return orderID
}

func insertTestOrderItem(t *testing.T, ctx context.Context, db *sql.DB, orderID, variantID string, unitPrice int, currency string) {
	t.Helper()
	if _, err := db.ExecContext(ctx, `
		INSERT INTO order_items (order_id, product_variant_id, unit_price_cents, currency, quantity)
		VALUES ($1, $2, $3, $4, 2)
	`, orderID, variantID, unitPrice, currency); err != nil {
		t.Fatalf("insert test order item: %v", err)
	}
}
