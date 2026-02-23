# Task List - Prioritized

> Generated from deep analysis on 2026-02-23

## Priority 1 - Critical (Security & Bugs)

### TASK-001: Add trusted proxy validation for X-Forwarded-For
- **Files**: `internal/platform/http/ratelimit.go`, `ip_block.go`, `modules/customers/action_logs.go`
- **Why**: Attackers can bypass rate limiting, IP blocking, and forge audit logs
- **How**: Add `TRUSTED_PROXIES` env var, only accept X-Forwarded-For from listed IPs
- **Effort**: Small

### TASK-002: Add brute-force protection to admin Basic Auth
- **Files**: `internal/modules/admin/http.go`
- **Why**: No lockout after failed attempts, trivially brute-forceable
- **How**: Add per-IP failed attempt counter with Redis, lockout after N failures
- **Effort**: Small

### TASK-003: Add CSRF protection
- **Files**: `internal/app/router.go`, all POST/PUT/DELETE handlers
- **Why**: Cookie-based sessions without CSRF tokens = vulnerable
- **How**: Double-submit cookie pattern or synchronizer token
- **Effort**: Medium

### TASK-004: Fix race condition in rate limiter fallback store
- **File**: `internal/platform/http/ratelimit.go:77-95`
- **Why**: `entry.count++` races under concurrent requests
- **How**: Use `atomic.Int64` for count field
- **Effort**: Small

### TASK-005: Fix checkout total calculation bug
- **File**: `web/hooks/use-checkout-state.ts:208`
- **Why**: Total shown ignores shipping price after cart sync
- **How**: Compute total as derived value: `subtotal + shippingPrice`
- **Effort**: Small

### TASK-006: Fix double fetch on cart update in checkout
- **File**: `web/app/checkout/page.tsx:113-129`
- **Why**: Calls `updateCart()` then `getCart()` - wasteful double request
- **How**: Use response from `updateCart` directly
- **Effort**: Small

---

## Priority 2 - High (Performance & Quality)

### TASK-007: Fix N+1 query in customer list
- **File**: `internal/storage/customers/store.go:949-960`
- **Why**: Separate query per customer group, slow with many customers
- **How**: Add `LEFT JOIN customer_groups` to main query
- **Effort**: Small

### TASK-008: Fix N+1 query in action logs
- **File**: `internal/storage/customers/store.go:1601-1607`
- **Why**: Extra query per log insert
- **How**: Pass email into insert or join
- **Effort**: Small

### TASK-009: Fix correlated subqueries in favorites
- **File**: `internal/storage/customers/store.go:391-422`
- **Why**: 3 subqueries per favorite item
- **How**: Refactor to LEFT JOIN or LATERAL JOIN
- **Effort**: Small-Medium

### TASK-010: Add structured logging (slog)
- **Files**: Entire backend
- **Why**: Only `log.Printf()` currently, impossible to debug production issues
- **How**: Replace with `slog` (stdlib), add JSON handler, add request logging middleware
- **Effort**: Medium

### TASK-011: Log module initialization errors
- **Files**: All module `module.go` files
- **Why**: Store creation errors silently ignored, modules partially initialized
- **How**: Log errors at minimum, or fail startup on critical store errors
- **Effort**: Small

### TASK-012: Add GitHub Actions CI/CD
- **Why**: All testing is manual, no automated checks on PRs
- **How**: Create `.github/workflows/ci.yml` with go test, lint, frontend build
- **Effort**: Medium

### TASK-013: Use timing-safe comparison for admin auth
- **File**: `internal/modules/admin/http.go:131-144`
- **Why**: String `==` comparison leaks password length via timing
- **How**: Use `subtle.ConstantTimeCompare()`
- **Effort**: Small

---

## Priority 3 - Medium (UX & Code Quality)

### TASK-014: Add debounce on checkout country input
- **File**: `web/app/checkout/page.tsx:158-161`
- **Why**: Typing triggers immediate API calls for shipping quotes
- **How**: Debounce 300-500ms before calling `fetchQuote()`
- **Effort**: Small

### TASK-015: Add fetch timeout/abort on frontend API calls
- **File**: `web/lib/checkout-api.ts`
- **Why**: No timeout means slow network hangs indefinitely
- **How**: Wrap fetch with `AbortController` and 15s timeout
- **Effort**: Small

### TASK-016: Consolidate AddressSection state sync
- **File**: `web/components/checkout/address-section.tsx:55-83`
- **Why**: 3 separate useEffects syncing props to state, causes re-renders
- **How**: Merge into single effect or use controlled component pattern
- **Effort**: Small

### TASK-017: Add debounce to quantity update buttons
- **File**: `web/components/checkout/order-summary.tsx:134-146`
- **Why**: Rapid clicks can fire duplicate update requests
- **How**: Disable button while request pending (already tracked), add small debounce
- **Effort**: Small

### TASK-018: Cache terminal fetch results
- **File**: `web/hooks/use-terminals.ts:33-68`
- **Why**: `cache: "no-store"` means every render fetches fresh
- **How**: Use browser cache or `stale-while-revalidate`
- **Effort**: Small

### TASK-019: Fix Go version mismatch in Dockerfiles
- **Files**: `deploy/Dockerfile.api` (1.26), `deploy/Dockerfile.dev` (1.25), `go.mod` (1.24.0)
- **Why**: Inconsistent Go versions across environments
- **How**: Align all to same version (go.mod should be source of truth)
- **Effort**: Small

### TASK-020: Add Docker health checks
- **File**: `docker-compose.yml`
- **Why**: No health checks for PostgreSQL or Redis services
- **How**: Add healthcheck blocks for pg_isready and redis-cli ping
- **Effort**: Small

### TASK-021: Standardize CSS border radius values
- **Files**: Multiple frontend components
- **Why**: Hardcoded `[18px]`, `[28px]`, `[36px]` not in design system
- **How**: Define named sizes in Tailwind config
- **Effort**: Small

---

## Priority 4 - Low (Nice to Have)

### TASK-022: Add checkout flow tests (backend)
- **Files**: `internal/modules/checkout/`
- **Why**: Most complex module has zero test coverage
- **Effort**: Medium-Large

### TASK-023: Add frontend component tests
- **Files**: `web/components/checkout/`
- **Why**: Only 1 test file exists for entire frontend
- **How**: Add Vitest + React Testing Library
- **Effort**: Large

### TASK-024: Add middleware tests
- **Files**: `internal/platform/http/`
- **Why**: Rate limiter, CORS, IP blocking untested
- **Effort**: Medium

### TASK-025: Add React error boundaries
- **Files**: `web/app/layout.tsx` or per-route
- **Why**: Component errors crash entire page
- **Effort**: Small

### TASK-026: Improve accessibility
- **Files**: Multiple frontend components
- **Why**: Missing semantic HTML, focus styles, some contrast issues
- **Effort**: Medium

### TASK-027: Add API documentation (OpenAPI)
- **Why**: No endpoint documentation, `docs/` directory empty
- **Effort**: Large

### TASK-028: Add request tracing / correlation IDs
- **Files**: `internal/platform/http/`, all handlers
- **Why**: No way to trace a request across logs
- **How**: Add request ID middleware, propagate through context
- **Effort**: Medium

### TASK-029: Add pre-commit git hooks
- **Why**: No automated formatting or linting before commit
- **How**: Add hooks for `go fmt`, `go vet`, `eslint`
- **Effort**: Small

### TASK-030: Move E2E tests to tests/ directory
- **Files**: Root-level `test-admin-*.js` files
- **Why**: Test files cluttering root directory
- **Effort**: Small

---

## Summary

| Priority | Count | Focus |
|----------|-------|-------|
| P1 Critical | 6 | Security fixes, data bugs |
| P2 High | 7 | Performance, logging, CI/CD |
| P3 Medium | 8 | UX, code quality, consistency |
| P4 Low | 9 | Tests, docs, nice-to-have |
| **Total** | **30** | |
