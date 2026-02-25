# Go-Ecommerce Project Instructions

## Project Goals (Non-negotiable)

1. **Super easy setup** (new dev runs it quickly)
2. **Super easy to add features** (module/plugin style)
3. **Fast UX** (storefront feels instant)
4. **Modern 2026 UI** (JolyUI-style blocks, tasteful motion)

---

## Stack

- **Backend**: Go 1.24 | PostgreSQL 16 | Redis 7 | chi router | goose migrations | raw `database/sql`
- **Frontend**: Next.js 16.1.6 (App Router) | React 19 | TypeScript 5.9 | Tailwind 4 | shadcn/ui + HeroUI + JolyUI | Framer Motion
- **Architecture**: Modular monolith, 7 feature modules, plugin-style registration, KISS principles
- **API**: 47+ REST endpoints (storefront + admin)
- **Database**: 21 SQL migrations via goose

---

## Project Structure

```
go-ecommerce/
├── cmd/api/              # API server entrypoint
├── cmd/migrate/          # Migration CLI (goose)
├── internal/
│   ├── app/              # Router + module registry
│   ├── modules/          # Feature modules (7)
│   │   ├── admin/        # Admin CRUD (961+ lines)
│   │   ├── cart/         # Shopping cart (cookie-based)
│   │   ├── catalog/      # Products, categories, variants
│   │   ├── checkout/     # Checkout flow orchestration
│   │   ├── customers/    # Auth, accounts, favorites
│   │   ├── orders/       # Order management
│   │   └── shipping/     # Zones, methods, providers (Omniva)
│   ├── platform/         # Infrastructure layer
│   │   ├── db/           # PostgreSQL pool
│   │   ├── http/         # Middleware (CORS, rate limit, IP block, security)
│   │   ├── payments/     # Stripe integration
│   │   ├── redis/        # Redis client
│   │   └── shipping/     # Provider registry + Omniva client
│   └── storage/          # Data access layer (raw SQL, no ORM)
├── migrations/           # 21 SQL migration files
├── web/                  # Next.js frontend
│   ├── app/              # App Router pages (storefront + admin + account)
│   ├── components/       # 62 React components
│   ├── hooks/            # Custom hooks (checkout, terminals, geolocation)
│   └── lib/              # API client (2400+ lines), state management
├── deploy/               # Dockerfiles (dev + prod)
└── docker-compose.yml    # PostgreSQL + Redis + Web
```

---

## Agent Behavior

**Mode**: Implementation. Build working features. Prefer code over explanation.

### Communication
- Be concise. No introductions, no closing remarks, no educational prose.
- Ask a short clarification question when uncertain — do not speculate or write long reasoning.

### KISS First
- Prefer simple and boring solutions.
- Do **not** introduce microservices, CQRS, event sourcing, DDD layers, or fancy patterns unless the repo already uses them.

### Small, Focused Changes
- 1 feature or fix per PR. Avoid large refactors "while you're here".
- Do not add new dependencies unless clearly necessary.

### Don't Break Setup
- `docker compose up` must keep working. Never make setup harder.

### Security Basics
- Never log secrets or tokens.
- Validate and sanitize user input.
- Use parameterized SQL only.
- Do not expose internal stack traces to clients.

### Performance Basics
- Add indexes only when needed.
- Use pagination for list endpoints.
- Cache only obvious hot paths (if Redis patterns already exist).

### UI/UX
- Animations: prefer `transform + opacity`. Avoid layout thrashing.
- Keep checkout/cart clean and fast. No distracting motion.
- Mobile-first responsiveness.

---

## Code Standards

### Backend (Go)
- `go fmt` always.
- `internal/` for app code, `cmd/` for entrypoints.
- Return consistent JSON error shape (use existing project standard).
- Prefer standard library + chi routing.

### Frontend (Next.js)
- TypeScript strict.
- Server components by default; client components only when needed.
- Keep components small; prefer reuse via `components/`.
- Use shadcn + JolyUI patterns for UI consistency.

---

## Module / Plugin Structure

Features implemented as **modules** (routes + migrations + optional event handlers).
Enable/disable via config/env if supported. Do NOT use Go's `plugin` package.

---

## Testing (Required Before Done)

- Backend: `go test ./...` passes, migrations apply cleanly
- Frontend: `pnpm lint` + `pnpm build` pass
- Manual: home page loads, product list loads, product page renders, add-to-cart works

If tests don't exist, add at least one basic test for new logic (unless pure UI).

---

## PR / Commit Format

```
feat(scope): short summary

Why:
- reason / goal

How to test:
- exact commands + manual steps

Notes:
- assumptions, tradeoffs, follow-ups
```

---

## What NOT to Do

- Do not rewrite the architecture.
- Do not introduce new frameworks.
- Do not change formatting/tools across the whole repo.
- Do not invent endpoints, env vars, or secrets — use existing conventions.

---

## Analysis Docs

- [docs/analysis-bugs-and-issues.md](docs/analysis-bugs-and-issues.md) — bugs, security issues
- [docs/analysis-backend.md](docs/analysis-backend.md) — Go backend deep analysis
- [docs/analysis-frontend.md](docs/analysis-frontend.md) — frontend deep analysis
- [docs/analysis-infrastructure.md](docs/analysis-infrastructure.md) — DevOps, Docker, CI/CD
- [docs/analysis-tasks.md](docs/analysis-tasks.md) — prioritized task list

## Critical Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | X-Forwarded-For trusted without proxy validation | CRITICAL | `platform/http/ratelimit.go`, `ip_block.go` |
| 2 | Admin Basic Auth only (no brute-force protection) | CRITICAL | `modules/admin/http.go:131-144` |
| 3 | No CSRF protection on state-changing endpoints | CRITICAL | All POST/PUT/DELETE handlers |
| 4 | Race condition in rate limiter fallback store | HIGH | `platform/http/ratelimit.go:77-95` |
| 5 | N+1 queries in customer list | HIGH | `storage/customers/store.go:949-960` |
| 6 | Checkout total ignores shipping price on cart sync | HIGH | `web/hooks/use-checkout-state.ts:208` |
| 7 | No CI/CD pipeline | HIGH | Missing `.github/workflows/` |
| 8 | Almost no structured logging | HIGH | Entire backend |
| 9 | No request timeout/abort on frontend fetch | MEDIUM | `web/lib/checkout-api.ts` |
| 10 | Module init errors silently swallowed | MEDIUM | All module files |
