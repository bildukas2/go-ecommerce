# Go-Ecommerce Project Analysis

> Deep analysis performed 2026-02-23. No code was modified.

## Project Overview

Full-stack ecommerce platform. Modular monolith architecture.
- **Backend**: Go 1.24 | PostgreSQL 16 | Redis 7
- **Frontend**: Next.js 16.1.6 | React 19 | TypeScript 5.9 | Tailwind 4 | shadcn/ui + HeroUI + JolyUI
- **Architecture**: 7 feature modules, plugin-style registration, KISS principles
- **API**: 47+ REST endpoints (storefront + admin)
- **Database**: 21 SQL migrations via goose

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

## Detailed Analysis Files

- **[docs/analysis-bugs-and-issues.md](docs/analysis-bugs-and-issues.md)** - All bugs, security issues, and code problems
- **[docs/analysis-backend.md](docs/analysis-backend.md)** - Go backend deep analysis
- **[docs/analysis-frontend.md](docs/analysis-frontend.md)** - Frontend deep analysis
- **[docs/analysis-infrastructure.md](docs/analysis-infrastructure.md)** - DevOps, Docker, CI/CD analysis
- **[docs/analysis-tasks.md](docs/analysis-tasks.md)** - Prioritized task list

## Critical Issues Summary

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | X-Forwarded-For header trusted without proxy validation | CRITICAL | `platform/http/ratelimit.go`, `ip_block.go` |
| 2 | Admin uses Basic Auth only (no brute-force protection) | CRITICAL | `modules/admin/http.go:131-144` |
| 3 | No CSRF protection on state-changing endpoints | CRITICAL | All POST/PUT/DELETE handlers |
| 4 | Race condition in rate limiter fallback store | HIGH | `platform/http/ratelimit.go:77-95` |
| 5 | N+1 queries in customer list (group lookup per row) | HIGH | `storage/customers/store.go:949-960` |
| 6 | Checkout total ignores shipping price on cart sync | HIGH | `web/hooks/use-checkout-state.ts:208` |
| 7 | No CI/CD pipeline configured | HIGH | Missing `.github/workflows/` |
| 8 | Almost no structured logging | HIGH | Entire backend |
| 9 | No request timeout/abort on frontend fetch calls | MEDIUM | `web/lib/checkout-api.ts` |
| 10 | Module init errors silently swallowed | MEDIUM | All module files |

## Current State (Git)

**Branch**: `main`
**Uncommitted changes** in checkout flow:
- `web/app/checkout/page.tsx` - Added cart update/remove handlers, refactored shipping selector props
- `web/components/checkout/order-summary.tsx` - Added quantity controls (+/-), remove button, Framer Motion animation
- `web/components/checkout/shipping-method-selector.tsx` - Refactored to receive methods as props (presentational)

These changes move the checkout toward an interactive cart-editing experience during checkout.
