# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 7994dd8e-d48e-443a-85de-15621f28147e -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: ccc5da27-e736-48c3-810d-28ade71fe589 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: d1844797-1d2e-44a0-aadc-44183b452832 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint). Avoid steps that are too granular (single function) or too broad (entire feature).

Important: unit tests must be part of each implementation task, not separate tasks. Each task should implement the code and its tests together, if relevant.

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

### [x] Step: Dev Environment Baseline
<!-- chat-id: fdc4f1ec-7bb5-4cfe-850a-c20aae9fce1a -->
- Ensure `.env.example` includes: `DATABASE_URL`, `REDIS_URL`, `PORT`, `NEXT_PUBLIC_API_URL`, `ADMIN_USER`, `ADMIN_PASS`, `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `CURRENCY`
- Ensure `docker-compose.yml` provides Postgres 16 and Redis 7 with volumes and default ports; confirm service names match app envs
- Contracts: one-command dev via `docker compose up`
- Verification: `docker compose up` starts Postgres/Redis healthy; `docker compose exec postgres psql -U <compose_user> -c "\\l"` works; `docker compose exec redis redis-cli PING` returns PONG

### [ ] Step: Bootstrap API (Server, Router, Health/Ready)
- Add `cmd/api/main.go` wiring config, logger, graceful shutdown; create `internal/app/router.go` and `internal/platform/http` helpers
- Implement `GET /health` and `GET /ready` handlers with JSON responses
- Contracts: `GET /health` → `{status:"ok"}`, `GET /ready` → `{db:"down", redis:"down"}` before clients are wired
- Verification: `go build ./...`; run API locally; curl `/health` and `/ready` return expected JSON

### [ ] Step: Module Registry Skeleton
- Create `internal/app/modules.go` to register modules and parse `ENABLED_MODULES` env (comma-separated)
- Ensure router registers routes only for enabled modules; default enables core modules
- Verification: toggling `ENABLED_MODULES` excludes module routes; 404 for disabled module paths

### [ ] Step: Database & Redis Platform + Migrations Baseline
- Create `internal/platform/db` (connection pool, max open/idle), `internal/platform/redis` (client init)
- Add `migrations/`; document `goose` CLI usage only (no in-app runner yet); add empty baseline migration
- Wire `ready` handler to check DB/Redis connectivity
- Contracts: Postgres at `DATABASE_URL`; Redis at `REDIS_URL`; goose migrations live in `migrations/`
- Verification: `goose postgres "$DATABASE_URL" up` applies baseline; `/ready` returns `{db:"ok", redis:"ok"}`

### [ ] Step: Catalog — Migrations + Seed Data
- Write SQL for tables: `products`, `product_variants`, `categories`, `product_categories`, `images`
- Add simple SQL seed migration for demo products, variants, categories, images
- Contracts: schemas per spec; slugs unique; basic sample data present
- Verification: apply migrations; query counts > 0 for products/variants/categories/images

### [ ] Step: Catalog — Storage Layer
- Implement `internal/storage/catalog` with prepared statements for list products (with pagination/category), get by slug, list categories
- Add 1 storage wiring test (DB connect + simple query)
- Contracts: functions expose pagination inputs/outputs; errors follow shared error shape
- Verification: `go test ./internal/storage/catalog` passes

### [ ] Step: Catalog — HTTP Endpoints
- Implement handlers in `internal/modules/catalog`: `GET /products`, `GET /products/:slug`, `GET /categories`; parse `page`/`limit`
- Use `internal/platform/http` for JSON, errors, pagination meta

- Contracts: response shapes per spec, including pagination meta on list
- Verification: curl endpoints return expected data from seed

### [ ] Step: Cart — Migrations
- Write SQL for `carts` and `cart_items` with constraints; add indexes as obvious (FKs, lookups)
- Contracts: quantity check > 0; FK integrity
- Verification: migrations apply cleanly; constraints enforced by DB

### [ ] Step: Cart — Storage + Business Logic
- Implement `internal/storage/cart` for create/retrieve cart, add item, update qty, remove item, compute totals
- Business rules: copy `unit_price_cents` from variant at add time; totals from snapshot
- Skip detailed unit tests in MVP (covered by Checkout business test)
- Contracts: cart identity by UUID; totals consistent with items
- Verification: storage implementation compiles; logic used by checkout flow (no separate storage test here to keep MVP minimal)

### [ ] Step: Cart — HTTP Endpoints
- Handlers: `POST /cart` (issue/read `cart_id` cookie), `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=30d` (Secure in prod)
- POST /cart is idempotent: ensure cart exists; returns current cart

- Contracts: JSON error shape on invalid input; cookie behavior per spec
- Verification: curl flow creates cart, adds/updates/removes items, returns totals

### [ ] Step: Orders — Migrations
- Write SQL for `orders` and `order_items`; unique `orders.number`; supporting indexes
- Contracts: enforce uniqueness; referential integrity; use Postgres ENUM type `order_status` with values: `pending_payment`, `paid`, `cancelled`
- Verification: migrations apply; uniqueness enforced

### [ ] Step: Checkout + Orders Implementation
- Implement `internal/storage/orders`; generate order number; create order from cart; set initial status `pending_payment`
- Implement `POST /checkout` handler: validate cart, compute totals, create order, integrate Stripe (test mode) behind an interface; return `checkout_url` to redirect; do not mark paid in MVP
- MVP stock handling: check stock at checkout only (no reservation on add-to-cart)
- Add 1 business test: checkout creates order with correct totals and initial status
- Contracts: `POST /checkout` returns `{order_id, checkout_url, status:"pending_payment"}`; no webhooks in MVP
- Verification: curl checkout on a cart returns order; DB shows created order/items

### [ ] Step: Web — Scaffold
- Create `web/` Next.js (App Router) with TypeScript, Tailwind, shadcn/ui; configure `NEXT_PUBLIC_API_URL`
- Basic layout and provider wiring; install minimal deps only
- Contracts: scripts `npm run lint` and `npm run build` work
- Verification: run lint/build successfully; dev server renders home page

### [ ] Step: Storefront — Catalog Pages
- Implement Home (JolyUI blocks), Product Listing with filters + skeletons, Product Detail with variants + add to cart
- Bind to backend APIs; handle loading/error states; mobile-first responsiveness
- Contracts: uses endpoints `GET /products`, `GET /products/:slug`, `POST /cart`
- Verification: navigate pages; add-to-cart updates cart drawer state

### [ ] Step: Storefront — Cart Drawer, Checkout, Success
- Implement cart drawer with optimistic updates; Checkout page and Order Success page
- Contracts: uses endpoints `GET/POST/PATCH/DELETE /cart*`, `POST /checkout`
- Verification: complete end-to-end flow from PLP/PDP to success page

### [ ] Step: Admin — Basic Auth + Orders Views
- Protect admin routes with Basic Auth using `ADMIN_USER`/`ADMIN_PASS`
- Implement Orders list and Order detail (Next.js pages consuming Go API JSON)
- Contracts: endpoints `GET /admin/orders`, `GET /admin/orders/:id` served by Go API as JSON; Next.js admin pages call these APIs
- Verification: admin pages load with credentials; list and detail render

### [ ] Step: Final Verification & Polish
- Backend: `go test ./...`; run API; `goose up` on fresh DB works
- Frontend: `npm run lint` and `npm run build` in `web/`
- Manual sanity: home, list, detail, cart drawer, checkout creates order visible in admin
- Contracts: acceptance criteria in PRD met; no leaking secrets; consistent error JSON
