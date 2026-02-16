

# Go Ecommerce (Community)

Simple, fast ecommerce starter:
- Go API + Postgres + Redis
- Next.js storefront (Tailwind + shadcn/ui + JolyUI)

This project is intentionally KISS: clean structure, easy setup, easy to extend with modules.

---

## Features (MVP)
- Catalog: products, categories
- Cart: cookie-based `cart_id` (HttpOnly)
- Orders: checkout creates order (`pending_payment`)
- Admin: Basic Auth protected endpoints + dashboard + orders views
- Health:
    - `GET /health`
    - `GET /ready` (db/redis)

---

## Requirements
- Go 1.26+
- Node.js (recommended LTS)
- pnpm (recommended) or npm
- Docker Desktop (recommended for easiest setup)

---

## Environment
Copy example env:
```bash
cp .env.example .env
```


Install goose CLI (once):
``` 
go install github.com/pressly/goose/v3/cmd/goose@latest
```
for migration

```
go run ./cmd/migrate up
```

---

# Contributing
Small PRs, one feature per PR. Avoid big refactors.
See README_AI.md and CONTRIBUTING.md.

---

# License

MIT for the core.

## Trademark note:
- Project name/logo trademarks of the owner. 
- Forks are allowed under MIT, but do not use the official brand assets without permission.