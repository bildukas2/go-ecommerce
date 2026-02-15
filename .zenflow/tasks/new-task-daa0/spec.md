# Technical Specification — Go E‑commerce MVP

## 1) Technical Context
- Backend: Go (standard `net/http` first; add `chi` only if it becomes necessary for routing ergonomics)
- Data: PostgreSQL (Docker `postgres:16`), Redis (Docker `redis:7`)
- Migrations: prefer `goose` (simple CLI, SQL-first); if `atlas` is later introduced, keep one tool consistently
- SQL: start with `database/sql` and prepared statements; evaluate `sqlc` once schema stabilizes
- API: REST-ish HTTP JSON, consistent error shape
- Frontend: Next.js (App Router), TypeScript, Tailwind, shadcn/ui, JolyUI blocks, minimal Framer Motion
- Dev/Run: `docker compose up` using existing `docker-compose.yml` and `.env-example`

Assumptions:
- No router or ORM is present yet (no `chi`, no `sqlc` config found). Choose KISS path to keep initial footprint minimal.
- `internal/` contains app/platform/modules/storage layouts; these will be used to structure code by module.

## 2) Implementation Approach (by area)

### Foundation
- Config: load from environment with sane defaults; provide `.env-example` fields already present (DATABASE_URL, REDIS_URL, PORT, NEXT_PUBLIC_API_URL)
- Health: expose `GET /health` (liveness) and `GET /ready` (readiness) via `net/http` handlers
- Server: standard HTTP server with graceful shutdown, structured logging (stdlib `log/slog` if available on Go version; otherwise `log`)
- Database: create `internal/platform/db` to manage connection (open with max open/idle conns), migrations runner via `goose` on startup (dev-only) or via a `make/mage` task later
- Redis: `internal/platform/redis` for client init; optional rate-limit helper when needed

### Catalog Module (`internal/modules/catalog`)
- Data model: products, product_variants, categories, product_categories, images
- Storage: SQL queries in `internal/storage/catalog` (separate package) using `database/sql`
- HTTP: handlers under `/products`, `/categories`; paginate list endpoints with `page`/`limit`
- Slugs: unique product slug; variants fetched by product slug

### Cart Module (`internal/modules/cart`)
- Data model: carts, cart_items
- Cart identity: anonymous `cart_id` issued and stored in HttpOnly cookie; server trusts the `cart_id` and reads from DB
- HTTP: create/retrieve cart; add item, update qty, remove item; return computed totals on read endpoints

### Orders Module (`internal/modules/orders`)
- Data model: orders, order_items
- Checkout: `POST /checkout` validates cart, computes totals, creates order, initiates Stripe (test mode) and marks order paid upon return success parameter (no webhooks in MVP)

### Minimal Admin (`internal/modules/admin`)
- Auth: basic auth using env credentials (e.g., `ADMIN_USER`, `ADMIN_PASS`) for MVP
- Views: list orders and order detail (server-rendered pages in Next.js admin route or minimal Go HTML if admin is server-side only; prefer front-end page under `/admin` with API-backed data)

### Storefront (web)
- Pages: Home, Product Listing, Product Detail, Checkout, Order Success
- Cart: drawer state with optimistic updates; API bound to backend endpoints
- UI: Tailwind + shadcn/ui + JolyUI blocks; motion limited to transform/opacity

## 3) Source Code Structure
- `cmd/api/main.go`: entrypoint; wires config, logger, db, redis, HTTP routes
- `internal/app/router.go`: route registration using `net/http` mux; if `chi` added later, adapt here centrally
- `internal/platform/db/`: DB connection + migrations
- `internal/platform/redis/`: Redis client
- `internal/platform/http/`: common HTTP helpers (JSON response, error wrapper, pagination parsing)
- `internal/storage/<module>/`: SQL access per module (catalog, cart, orders)
- `internal/modules/<module>/`: HTTP handlers + business logic per module
- `migrations/`: SQL migration files managed by `goose`
- `web/`: Next.js app (App Router), components, pages

## 4) Data Model & API Changes

Tables (SQL-first; exact types adjusted in migrations):
- products(id UUID PK, slug TEXT UNIQUE, title TEXT, description TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
- product_variants(id UUID PK, product_id UUID FK, sku TEXT UNIQUE, price_cents INT, currency TEXT, stock INT, attributes_json JSONB)
- categories(id UUID PK, slug TEXT UNIQUE, name TEXT, parent_id UUID NULL)
- product_categories(product_id UUID FK, category_id UUID FK)
- images(id UUID PK, product_id UUID FK, url TEXT, alt TEXT, sort INT)
- carts(id UUID PK, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
- cart_items(id UUID PK, cart_id UUID FK, variant_id UUID FK, quantity INT CHECK(quantity>0), unit_price_cents INT)
- orders(id UUID PK, cart_id UUID FK, number TEXT UNIQUE, status TEXT, email TEXT, total_cents INT, currency TEXT, created_at TIMESTAMPTZ)
- order_items(id UUID PK, order_id UUID FK, variant_id UUID FK, quantity INT, unit_price_cents INT)

API (JSON):
- `GET /health` → `{status:"ok"}`
- `GET /ready` → `{db:"ok|down", redis:"ok|down"}`
- `GET /products?page&limit&category` → list with pagination meta
- `GET /products/:slug` → product + variants + images
- `GET /categories` → list/tree
- `POST /cart` → create or fetch current; sets `cart_id` cookie if new
- `GET /cart` → get cart with items and totals
- `POST /cart/items` → add item `{variant_id, quantity}`
- `PATCH /cart/items/:id` → update qty
- `DELETE /cart/items/:id` → remove
- `POST /checkout` → creates order from cart; returns `{order_id, payment_status}`
- Admin: `GET /admin/orders`, `GET /admin/orders/:id` (protected by Basic Auth)

Error shape (consistent):
- `{error: {code: string, message: string, details?: any}}`

## 5) Delivery Phases (Incremental)
1. Foundation
   - Wire HTTP server, config, logging, health/ready endpoints
   - DB/Redis clients + migrations tooling (`goose`), empty baseline migration
2. Catalog
   - Schema for products/categories/variants/images; seed demo data
   - Implement `GET /products`, `GET /products/:slug`, `GET /categories`
3. Cart
   - Schema for carts/cart_items; cookie-based cart id; full cart CRUD endpoints
4. Orders/Checkout
   - Schema for orders/order_items; `POST /checkout`; Stripe test-mode happy path
5. Storefront (MVP pages)
   - Home, PLP, PDP with add-to-cart, Cart drawer, Checkout + Success
6. Minimal Admin
   - Basic auth + orders list/detail page

Each phase is shippable and testable end-to-end.

## 6) Verification Approach
- Backend build/tests: `go test ./...` (once packages exist)
- Migrations: run `goose postgres "$DATABASE_URL" up` locally or via startup hook; confirm schema applies cleanly
- Dev run: `docker compose up` should bring up Postgres, Redis, API, and web
- Frontend: `npm run lint` and `npm run build` in `web/` (after scaffolding)
- Manual sanity per AGENTS.md: load home, product list/page, cart drawer, checkout creates order

Notes:
- Keep dependencies minimal at start; add `chi` or `sqlc` later only when it clearly improves ergonomics or safety
- Maintain module boundaries: routes + storage + migrations per module

## 7) MVP Policies & Conventions

### Cart Cookie
- Name: `cart_id`
- Attributes: `HttpOnly=true`, `SameSite=Lax`, `Path=/`, `Max-Age=30 days`
- `Secure=true` in production (HTTPS); may be `false` in local dev
- Behavior: if cookie is missing/invalid/not found → create new cart and set/overwrite cookie

### Cart ID Format
- UUID v4 string
- Validate UUID format server-side before DB lookup; reject/replace invalid values

### Pricing & Totals
- On add-to-cart: copy `product_variants.price_cents` into `cart_items.unit_price_cents`
- On checkout: compute totals from `cart_items` snapshot, not live product pricing
- Promotions/price refresh: out-of-scope for MVP; consider in Phase 2
- Money: always integers in cents; currency from `CURRENCY` env (default `EUR`)

### Order Numbering
- Format example: `ORD-YYYYMMDD-XXXX` where `XXXX` is zero-padded base10 sequence or short id
- Enforce uniqueness with a unique index on `orders.number`; on conflict, regenerate and retry

### Categories Response
- MVP returns a flat list of categories (no tree). Parent/child tree is Phase 2

### Stripe MVP Note
- Redirect-based “paid” marking is MVP-only; Phase 2 adds webhooks for reliability

### Admin Scope (MVP)
- Admin includes orders list and order detail only. Product/inventory editing is deferred to Phase 2

### API Conventions
- Pagination: `page` (default `1`, min `1`) and `limit` (default `20`, max `100`)
- Error JSON shape: `{ "error": { "code": string, "message": string, "details"?: any } }`
- All monetary fields are integers in cents; currency code upper-case ISO-4217

### Module Enablement
- Future hook: `ENABLED_MODULES` env to selectively enable optional modules
- No dynamic plugin loading; modules are compiled in
