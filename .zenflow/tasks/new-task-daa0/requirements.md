# Product Requirements Document (PRD) — Go E‑commerce MVP

## 1. Overview
A minimal, modern e‑commerce platform that enables browsing products, adding to cart, and completing checkout to create an order visible in a basic admin. Optimized for fast setup, straightforward feature development, and a fast storefront UX.

## 2. Goals
- Super easy local setup using Docker (PostgreSQL + Redis) and one‑command dev
- Modular feature development (catalog, cart, orders) without over‑engineering
- Fast, modern storefront UI (Next.js + Tailwind + shadcn/ui + JolyUI)
- Reliable, simple backend (Go, REST JSON, Postgres, Redis)
- MVP completion criteria: browse products → add to cart → checkout → order created and visible in admin

## 3. Non‑Goals (MVP)
- Complex promotions/discount engines
- Advanced search (facets/full‑text across many fields)
- Complex shipping integrations or rate shopping
- Multi‑currency or multi‑tenant support
- Full CMS or complex admin workflows

## 4. Users & Personas
- Shopper: discovers products, browses catalog, views PDP, manages cart, checks out
- Store Admin: seeds demo data, views orders, manages basic product data and inventory

## 5. User Stories (MVP)
- As a Shopper, I can load the homepage and see featured content quickly
- As a Shopper, I can browse a product list with basic filters and fast perceived performance
- As a Shopper, I can open a product page, choose a variant, and add it to my cart
- As a Shopper, I can open a cart drawer to review, update quantities, and remove items
- As a Shopper, I can proceed to checkout and place an order with a simple payment flow
- As an Admin, I can log into a minimal admin to view newly created orders
- As a Developer, I can run the app with one command, with migrations and demo seed data applied

## 6. Functional Requirements
### 6.1 Foundation
- `.env.example` and `docker-compose.yml` including Postgres and Redis
- Health endpoints: `GET /health` (liveness) and `GET /ready` (readiness)
- Project structure: `cmd/`, `internal/`, `migrations/`, `web/`, `deploy/`, `docs/`

### 6.2 Catalog
- Data: products, variants, categories, images
- Endpoints:
  - `GET /products` with basic pagination and category filter
  - `GET /products/:slug` returns product with variants and images
  - `GET /categories` returns list/tree of categories

### 6.3 Cart
- Data: carts, cart_items
- Endpoints:
  - Create/retrieve cart (anonymous; link via HttpOnly cookie `cart_id`)
  - Add item, update quantity, remove item
  - Get cart details with computed totals

### 6.4 Orders / Checkout
- Data: orders, order_items
- Endpoint: `POST /checkout` to create an order from a cart
- Payment: simple Stripe integration (test mode), minimal happy‑path flow; mark order paid after Stripe redirect confirmation (no webhooks in MVP)

### 6.5 Minimal Admin
- Basic auth (single user or simple credential gate) for admin routes
- Views to list orders and see order detail (MVP scope: orders view only; product editing deferred to Phase 2)

## 7. Non‑Functional Requirements
- Performance: snappy UX; list endpoints paginated; image sizes appropriate for client
- Reliability: graceful errors with consistent JSON error shape; health/readiness endpoints
- Security: parameterized SQL; do not log secrets; validate inputs; basic rate limiting if trivial to add with Redis patterns already present
- Observability: minimal structured logging; optional request id propagation if lightweight

## 8. Data Model (High‑Level)
- products(id, slug, title, description, created_at, updated_at)
- product_variants(id, product_id, sku, price_cents, currency, stock, attributes_json)
- categories(id, slug, name, parent_id)
- product_categories(product_id, category_id)
- images(id, product_id, url, alt, sort)
- carts(id, session_id, created_at, updated_at)
- cart_items(id, cart_id, variant_id, quantity, unit_price_cents)
- orders(id, cart_id, number, status, email, total_cents, currency, created_at)
- order_items(id, order_id, variant_id, quantity, unit_price_cents)

Note: exact columns subject to sqlc/database/sql patterns already in repo and migration tooling (goose/atlas) present.

## 9. API Shape & Conventions
- Transport: HTTP JSON (REST‑ish)
- Auth: none for storefront; basic auth for admin
- Errors: consistent JSON error schema used across handlers
- Pagination: `page`, `limit` query params with sensible defaults and caps
- IDs: server‑generated; product/variant lookup by `slug` or `sku` where applicable

## 10. Storefront Requirements (Next.js)
- Pages: Home, Product Listing (with filters), Product Detail (variants + add to cart), Checkout, Order Success
- Cart: drawer UI; optimistic updates where possible
- Design: Tailwind + shadcn/ui + JolyUI blocks; tasteful motion (transform + opacity only)
- Mobile‑first responsive layout

## 11. Assumptions
- Postgres + Redis available via Docker; migrations applied at startup or via a simple dev command
- sqlc preferred if configuration exists; otherwise use clean database/sql with prepared statements
- Payments limited to Stripe test mode; no webhooks in MVP (manual success confirmation on return)
- Single currency in MVP

## 12. Open Questions
- Should carts persist across devices via email link or remain session‑scoped only in MVP?
- What minimal admin auth mechanism is acceptable (env credentials vs. seeded user)?
- Do we require inventory reservation at add‑to‑cart or only at checkout?

## 13. Acceptance Criteria
- One‑command dev brings up DB/cache and app, and seeds demo data
- Product list, product page, cart drawer, and checkout operate without errors
- `POST /checkout` creates an order; order is visible in admin list/detail
- Lint/build/tests pass for backend and frontend per repo scripts
