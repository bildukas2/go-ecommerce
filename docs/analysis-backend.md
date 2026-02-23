# Backend Deep Analysis

> Analysis date: 2026-02-23

## Architecture Overview

The Go backend follows a **modular monolith** pattern:
- `cmd/api/main.go` - Entry point (~93 lines)
- `internal/app/` - Router + module registry
- `internal/modules/` - 7 feature modules
- `internal/platform/` - Infrastructure (DB, Redis, HTTP middleware, payments, shipping)
- `internal/storage/` - Data access layer (raw SQL with prepared statements)

**Strengths**: Clean separation, minimal dependencies, plugin-style modules, standard library HTTP
**Weaknesses**: Silent error swallowing, limited logging, some race conditions

---

## Module Breakdown

### 1. Admin Module (`internal/modules/admin/`)
- **Size**: 961+ lines in `http.go`, 396 in custom options, 229 in customers, 373 in media
- **Endpoints**: ~25 (dashboard, catalog CRUD, customer management, orders, media, security)
- **Auth**: Basic Auth via env vars
- **Tests**: 4 test files (catalog, customers, media, custom options) - good coverage
- **Issues**:
  - Basic Auth without brute-force protection
  - Large `http.go` file - could be split further
  - No audit logging for admin actions

### 2. Cart Module (`internal/modules/cart/`)
- **Size**: 345 lines
- **Endpoints**: ~6 (get cart, manage items)
- **Mechanism**: Cookie-based `cart_id` with HttpOnly flag
- **Tests**: Present
- **Issues**: Cart merging on login could have race conditions

### 3. Catalog Module (`internal/modules/catalog/`)
- **Size**: 344 lines
- **Endpoints**: ~3 (products list, product detail, categories)
- **Tests**: Present
- **Issues**: None critical

### 4. Checkout Module (`internal/modules/checkout/`)
- **Size**: 445 lines in `http.go`, 244 in `module.go`
- **Flow**: quote -> address -> shipping -> payment -> place order
- **Endpoints**: 5 (quote, address, select-shipping, select-payment, place-order)
- **Issues**:
  - TODO: "Use the full pricing logic from http_storefront.calculateMethodPrice" - code duplication
  - `context.Background()` in init without timeout
  - Complex orchestration without proper error recovery

### 5. Customers Module (`internal/modules/customers/`)
- **Size**: 477 lines in `http.go`, separate auth, blocked report, action logs
- **Endpoints**: ~8 (register, login, logout, me, favorites, orders, change-password, blocked-report)
- **Auth**: Session-based with token hash in cookie
- **Tests**: 2 test files (auth, account) - good coverage
- **Issues**:
  - No session rotation on privilege change
  - No email verification
  - `normalizeEmail()` only lowercases, no format validation

### 6. Orders Module (`internal/modules/orders/`)
- **Size**: Smaller module
- **Endpoints**: `GET /checkout` for order details
- **Issues**: Minimal functionality so far

### 7. Shipping Module (`internal/modules/shipping/`)
- **Size**: Largest module - 1021 (admin), 405 (storefront), plus debug
- **Endpoints**: ~12 (admin CRUD, storefront options, debug)
- **Provider Registry**: Extensible pattern for shipping providers
- **Implemented Provider**: Omniva (with API client, terminal management)
- **Tests**: Comprehensive test files (843+ lines)
- **Issues**:
  - Hardcoded pricing in Omniva provider
  - Complex zone/method/pricing logic
  - Debug endpoints should be behind feature flag

---

## Platform Layer Issues

### HTTP Middleware (`internal/platform/http/`)

| File | Purpose | Issues |
|------|---------|--------|
| `httpx.go` | JSON response helpers | Ignores `json.Encode()` errors |
| `cors.go` | CORS middleware | Uses env var, needs validation |
| `security.go` | Security headers | Applied to admin only, should apply to all |
| `ratelimit.go` | Redis-backed rate limiting | Race condition in fallback store |
| `ip_block.go` | IP blocking | Trusts X-Forwarded-For without proxy validation |

### Database (`internal/platform/db/`)
- Pool defaults: 10 max open, 5 idle, 30min lifetime
- Configurable via env vars
- No health check interval configured

### Payments (`internal/platform/payments/`)
- Stripe integration
- Test keys in env

### Shipping Registry (`internal/platform/shipping/`)
- Clean provider interface pattern
- Registry for dynamic provider registration
- Only Omniva implemented so far

---

## Storage Layer Issues

### Common Patterns
- All stores use prepared statements (good)
- Parameterized queries (good - prevents SQL injection)
- `context.Context` propagation (good)

### Specific Issues

**`storage/customers/store.go`** (largest store):
- N+1 query in customer list (group lookup per row) - lines 949-960
- N+1 query in action log insert (email lookup) - lines 1601-1607
- Correlated subqueries in favorites query - lines 391-422
- Transaction rollback errors ignored - line 534

**`storage/media/store.go`**:
- Prepared statement cleanup incomplete on partial init failure - lines 54-76

**`storage/cart/store.go`**:
- Hardcoded `/images/noImage.png` fallback - line 103

---

## Test Coverage Summary

| Module | Test Files | Coverage Level |
|--------|-----------|----------------|
| Admin | 4 files | Good (catalog, customers, media, custom options) |
| Cart | 1 file | Basic |
| Catalog | 1 file | Basic |
| Checkout | 0 files | **None** |
| Customers | 2 files | Good (auth, account) |
| Orders | 1 file | Basic |
| Shipping | 3+ files | Good (admin, storefront, provider) |
| Platform/HTTP | 0 files | **None** |
| Storage | Multiple | Good |

**Missing test areas**:
- Checkout flow (most complex logic)
- HTTP middleware (rate limiting, CORS, IP blocking)
- Error handling paths
- Concurrent access patterns

---

## Dependency Graph

```
cmd/api/main.go
  └── internal/app/
       ├── modules.go (registry)
       └── router.go
            ├── platform/http/ (middleware)
            ├── platform/db/ (PostgreSQL)
            ├── platform/redis/ (Redis)
            └── modules/*/
                 ├── platform/payments/
                 ├── platform/shipping/
                 └── storage/*/
```

No circular dependencies detected. Clean layering.

---

## Performance Hotspots

1. **Customer list with groups** - N+1 query, slow with many customers
2. **Favorites query** - 3 correlated subqueries per item
3. **Action log insert** - Extra query per log entry
4. **Rate limiter fallback** - Memory growth without cleanup timer (uses `sync.Map`)
5. **Prepared statement creation** - Done at startup per store, blocks server start
