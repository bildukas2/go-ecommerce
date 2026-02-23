# Bugs, Security Issues & Problems

> Analysis date: 2026-02-23

## CRITICAL - Security Vulnerabilities

### 1. X-Forwarded-For Header Spoofing
**Files**: `internal/platform/http/ratelimit.go:98-107`, `ip_block.go:60-75`, `modules/customers/action_logs.go:61-71`

The code trusts the `X-Forwarded-For` header from any client. A TODO comment acknowledges this. Without trusted proxy validation, attackers can:
- Bypass rate limiting entirely
- Bypass IP blocking
- Forge audit log entries

```go
// TODO: For production, only trust X-Forwarded-For if behind a known/trusted proxy.
xff := r.Header.Get("X-Forwarded-For")
```

**Fix**: Add a `TRUSTED_PROXIES` env var. Only accept X-Forwarded-For from those IPs.

---

### 2. Weak Admin Authentication
**File**: `internal/modules/admin/http.go:131-144`

- Basic Auth with env var credentials (`ADMIN_USER`/`ADMIN_PASS`)
- No brute-force protection (no rate limit on login failures)
- String comparison vulnerable to timing attacks
- Default credentials: `admin/admin`

```go
u, p, ok := r.BasicAuth()
if !ok || u != m.user || p != m.pass {
    // No failure counting, no lockout
}
```

**Fix**: Add login attempt rate limiting. Use `subtle.ConstantTimeCompare()`. Consider JWT-based admin auth.

---

### 3. No CSRF Protection
**Files**: All POST/PUT/PATCH/DELETE handlers

No CSRF token validation exists anywhere. Since the app uses cookie-based sessions, any state-changing request is vulnerable to cross-site request forgery.

**Fix**: Add CSRF token middleware (double-submit cookie or synchronizer token pattern).

---

### 4. .env File May Contain Real Credentials
**File**: `.env` (root)

While `.gitignore` includes `.env`, the file exists on disk with `ADMIN_USER=admin`, `ADMIN_PASS=admin`, Stripe test keys. If `.gitignore` was added after initial commit, credentials may be in git history.

**Fix**: Verify `.env` is not in git history. Rotate any exposed credentials. Use `.env.example` only.

---

### 5. Session Cookie Security Gap
**File**: `internal/modules/customers/auth.go:51-62`

- `Secure` flag depends on `X-Forwarded-Proto` header (which is also unsanitized)
- No session rotation on privilege escalation
- No session binding to IP or User-Agent

```go
Secure: requestIsSecure(r), // Trusts X-Forwarded-Proto
```

---

### 6. Database SSL Disabled
**File**: `.env`

```
DATABASE_URL=postgres://app:app@localhost:5435/ecommerce?sslmode=disable
```

Database credentials sent in plaintext. Fine for local dev, dangerous if copy-pasted to production.

---

## HIGH - Bugs & Race Conditions

### 7. Race Condition in Rate Limiter Fallback
**File**: `internal/platform/http/ratelimit.go:77-95`

The `fallbackStore` uses `sync.Map.LoadOrStore()` which stores a pointer. The subsequent `entry.count++` is not atomic and can race with concurrent goroutines.

```go
val, loaded := rl.fallbackStore.LoadOrStore(key, &rateLimitEntry{count: 1, ...})
entry := val.(*rateLimitEntry)
entry.count++ // RACE: multiple goroutines can increment simultaneously
```

**Fix**: Use `atomic.Int64` for count, or protect with a mutex.

---

### 8. Checkout Total Calculation Bug
**File**: `web/hooks/use-checkout-state.ts:208`

When `setCart` is called, it dispatches `SET_TOTALS` with `total = subtotal`, completely ignoring the current `shippingPrice`. This means the displayed total is wrong until shipping is re-selected.

```tsx
dispatch({ type: "SET_TOTALS", payload: {
  subtotal: cart.Totals.SubtotalCents,
  total: cart.Totals.SubtotalCents  // BUG: should be + state.shippingPrice
}});
```

**Fix**: Compute total as `subtotal + shippingPrice`, or use a derived/memoized value instead of storing total in state.

---

### 9. N+1 Query in Customer List
**File**: `internal/storage/customers/store.go:949-960`

For each customer with a group, a separate `SELECT name, code FROM customer_groups WHERE id = $1` is executed.

**Fix**: Use a `LEFT JOIN` on `customer_groups` in the main query.

---

### 10. N+1 Query in Action Logs
**File**: `internal/storage/customers/store.go:1601-1607`

After inserting each log entry, a separate query fetches the customer email.

**Fix**: Pass the email into the insert function, or join in the query.

---

### 11. Double Fetch on Cart Update (Frontend)
**File**: `web/app/checkout/page.tsx:113-129`

```tsx
const handleUpdateQuantity = async (itemId, quantity) => {
  await updateCart(itemId, quantity);     // Fetches updated cart
  const updatedCart = await getCart();    // Fetches again!
  setCart(updatedCart);
};
```

**Fix**: Use the response from `updateCart` directly.

---

### 12. Module Init Errors Silently Swallowed
**Files**: All module `module.go` files

```go
if st, err := storcustomers.NewStore(context.Background(), deps.DB); err == nil {
    store = st
}
// If err != nil, silently ignored - module runs without store
```

**Fix**: Return errors from module init, or at minimum log them.

---

### 13. Potential Module Registry Race
**File**: `internal/app/modules.go:15-33`

`modulesRegistry` is a plain `map[string]Module{}` written during `init()`. If `RegisterModule()` is called from multiple goroutines, it panics.

**Fix**: Not an issue if only called during init, but add a comment or mutex to be safe.

---

### 14. Correlated Subqueries in Favorites
**File**: `internal/storage/customers/store.go:391-422`

Three correlated subqueries per favorite item (image, price, currency).

**Fix**: Refactor to use `LEFT JOIN` or `LATERAL JOIN`.

---

### 15. Prepared Statement Leak on Error
**File**: `internal/storage/media/store.go:54-76`

If the second `PrepareContext()` fails, the first prepared statement is only cleaned up in some error paths.

**Fix**: Use defer pattern or ensure all prior statements are closed on any error.

---

## MEDIUM - Code Quality & UX Issues

### 16. No Structured Logging
**Files**: Entire backend

Only uses `log.Printf()`. No structured fields, no log levels, no correlation IDs.

**Fix**: Add `slog` (standard library in Go 1.21+) with JSON output.

---

### 17. No Request Timeouts on Frontend Fetch
**File**: `web/lib/checkout-api.ts`

All `fetch()` calls have no timeout or `AbortController`. Slow network could hang indefinitely.

**Fix**: Wrap fetch with a timeout using `AbortController`.

---

### 18. No Debounce on Country Change
**File**: `web/app/checkout/page.tsx:158-161`

Country input triggers an immediate API call to fetch shipping quotes. Typing triggers multiple requests.

**Fix**: Debounce the country change handler (300-500ms).

---

### 19. Missing Frontend Test Coverage
Only 1 test file found: `web/lib/color-swatches.test.ts`. No component tests, no hook tests.

---

### 20. Terminal Fetch Bypasses Cache
**File**: `web/hooks/use-terminals.ts:33-68`

```tsx
const res = await fetch(url.toString(), { cache: "no-store" });
```

Terminals don't change frequently. Should use browser cache or `stale-while-revalidate`.

---

### 21. Hardcoded DB Pool Settings
**File**: `internal/platform/db/db.go:33-35`

```go
db.SetMaxOpenConns(10)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(30 * time.Minute)
```

While configurable via env vars, defaults may be too low for production.

---

### 22. Missing Database Indexes (Suspected)
Based on query patterns, these columns likely need indexes:
- `customer_sessions(token_hash)`
- `customer_favorites(customer_id, created_at)`
- `customer_action_logs(customer_id, created_at)`
- `orders(customer_id, created_at)`

Need to verify against actual migration files.

---

### 23. Hardcoded Shipping Prices
**File**: `internal/platform/shipping/providers/omniva/omniva.go:102-149`

Shipping prices are hardcoded. Should come from the shipping_methods configuration.

---

### 24. Magic Strings in Frontend CSS
**File**: `web/app/checkout/page.tsx:141`

```tsx
const sectionPanel = "glass rounded-[28px] border border-surface-border bg-surface/80 p-6 shadow-[0_30px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-colors";
```

Hardcoded border radius values (`[18px]`, `[28px]`, `[36px]`) not in design system.

---

### 25. AddressSection State Sync
**File**: `web/components/checkout/address-section.tsx:55-83`

Three separate `useEffect` hooks syncing props to local state. Causes unnecessary re-renders.

**Fix**: Consolidate into single effect or use controlled pattern.

---

## LOW - Improvements

### 26. No CI/CD Pipeline
No `.github/workflows/` directory. All testing is manual.

### 27. No API Documentation
No OpenAPI/Swagger spec. The `docs/` directory is empty.

### 28. No Metrics/Observability
No Prometheus, no OpenTelemetry, no request tracing.

### 29. No Error Boundary Components (Frontend)
React error boundaries not implemented. A component crash takes down the whole page.

### 30. Accessibility Gaps
- Cart items use `<div>` instead of semantic `<li>` or `<article>`
- Missing focus-visible styles on shipping method buttons
- Some color contrast issues with `text-foreground/60`
