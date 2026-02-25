# Go-Ecommerce Repository Overview

This repository is a full-stack ecommerce platform built with **Go** and **Next.js**. It follows a modular monolith architecture with a focus on simplicity (**KISS**), ease of setup, and modern UI.

## Tech Stack

- **Backend**: 
  - Language: **Go 1.24**
  - Database: **PostgreSQL 16** (via `pgx/v5`)
  - Cache/Session: **Redis 7**
  - Migrations: **Goose**
  - Routing: Standard Library (`net/http`) with modular registry
- **Frontend**:
  - Framework: **Next.js 16.1.6** (App Router)
  - UI: **React 19**, **TypeScript 5.9**, **Tailwind CSS 4**
  - Components: **shadcn/ui**, **HeroUI**, **JolyUI**
  - Animations: **Framer Motion**
- **Infrastructure**:
  - Containerization: **Docker** & **Docker Compose**
  - Proxy/Server: **Caddy** (support for HTTP/3 at edge)

## Directory Structure

```text
go-ecommerce/
├── cmd/
│   ├── api/              # API server entrypoint (Go)
│   ├── migrate/          # Migration CLI (Goose)
│   └── adminseed/        # Admin user bootstrap script
├── internal/
│   ├── app/              # Router & Module registry logic
│   ├── modules/          # Feature modules (10 total)
│   │   ├── admin/        # Backoffice management
│   │   ├── adminauth/    # Admin session/auth & security
│   │   ├── cart/         # Shopping cart (cookie-based)
│   │   ├── catalog/      # Products, categories, attributes
│   │   ├── checkout/     # Checkout flow orchestration
│   │   ├── cms/          # Pages and navigation management
│   │   ├── customers/    # Customer auth, accounts, favorites
│   │   ├── orders/       # Order processing
│   │   ├── payments/     # Payment method integrations (Stripe, Bank Transfer)
│   │   └── shipping/     # Shipping zones & Omniva integration
│   ├── platform/         # Infrastructure (DB, Redis, Middleware)
│   └── storage/          # Data access layer (Raw SQL)
├── migrations/           # 27 SQL migration files
├── web/                  # Next.js frontend application
│   ├── app/              # App Router pages (storefront + admin)
│   ├── components/       # Reusable React components
│   ├── hooks/            # Custom React hooks (checkout, geolocation)
│   └── lib/              # API client and state management
├── deploy/               # Dockerfiles (dev + prod)
└── docker-compose.yml    # Full stack orchestration
```

## Implemented Modules

1.  **Catalog**: Manages products, categories, and custom product options.
2.  **Cart**: Cookie-based shopping cart with persistent `cart_id`.
3.  **Customers**: Handles customer authentication, account management, and favorites.
4.  **Orders**: Core order processing and status management.
5.  **Shipping**: Multi-provider shipping (Omniva), shipping methods, and price calculation.
6.  **Payments**: Support for Stripe and manual Bank Transfer payments.
7.  **Checkout**: Orchestrates the checkout flow from cart to order placement.
8.  **CMS**: Dynamic pages and navigation menus for the storefront.
9.  **AdminAuth**: Secure admin authentication with session management and captcha protection.
10. **Admin**: Backoffice dashboard and CRUD operations for all modules.

## Database Migrations (Goose)

The database schema is managed via **27 migrations** located in `./migrations`:
- `001_baseline.sql` to `005_orders_schema.sql` (Core tables)
- `006_fix_images.sql` to `011_products_status_tags.sql` (Catalog enhancements)
- `012_customizable_options.sql` to `018_custom_options_display_mode.sql` (Custom options)
- `019_shipping_schema.sql` to `025_order_items_snapshot_data.sql` (Shipping, Payments, Orders)
- `026_admin_users_roles_auth.sql` (RBAC & Auth)
- `027_cms_schema.sql` (CMS tables)

---

# AI Agent Instructions (READ THIS FIRST)

This is a public, open-source Go ecommerce project. Your job is to help implement features **without over-engineering**. If anything is unclear, **choose the simplest correct approach** and explain assumptions in the PR/commit message.

## Project Goals (Non-negotiable)

1) **Super easy setup** (new dev runs it quickly)
2) **Super easy to add features** (module/plugin style)
3) **Fast UX** (storefront feels instant)
4) **Modern 2026 UI** (JolyUI-style blocks, tasteful motion)

## Agent Rules & Behavior

### KISS First (Keep It Simple, Stupid)
- Prefer **simple and boring** solutions.
- Do **not** introduce microservices, CQRS, event sourcing, DDD layers, or fancy patterns.

### Small PRs
- Keep changes focused: **1 feature or fix per PR**.
- Avoid large refactors “while you’re here”.

### No “Agent Creep”
- Do not add new dependencies unless clearly necessary.
- If adding a dependency, justify it in the PR description.

### Don’t Break the Setup
- `docker compose up` must always work.
- Never make setup harder for newcomers.

### Security Basics
- Never log secrets or tokens.
- Validate and sanitize all user input.
- Use **parameterized SQL** only.

### Performance Basics
- Add indexes only when needed.
- Use pagination for list endpoints.
- Cache only obvious hot paths.

### UI/UX Principles
- Animations: prefer **transform + opacity**. Avoid layout thrashing.
- Keep checkout/cart clean and fast. Mobile-first responsiveness is a must.

## Code Standards

### Backend (Go)
- Use `go fmt`.
- Prefer standard library or established project patterns.
- Keep packages clean: `internal/modules/` for features, `internal/platform/` for infra.

### Frontend (Next.js)
- TypeScript strict.
- Server components by default; client components only when needed.
- Use **shadcn** + **JolyUI** patterns.

## Testing & Verification
Minimum checks before marking work done:
- **Backend**: `go test ./...` passes. Migrations apply cleanly.
- **Frontend**: `npm run lint` and `npm run build` pass.
- **Manual Sanity**: Check home page, product pages, and cart flow.

## PR / Commit Message Format
- **Summary**: what changed (1–2 lines)
- **Why**: reason / goal
- **How to test**: exact commands + manual steps
- **Notes**: assumptions, tradeoffs, follow-ups
