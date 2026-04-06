

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
- Admin: session auth + CSRF + captcha protected endpoints + dashboard + orders views
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

## Admin setup
### Admin bootstrap seed (used by: go run ./cmd/adminseed)
```bash
inside .env  config params then you can remove it 
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
ADMIN_SEED_DISPLAY_NAME=
```

Install goose CLI (once):
``` 
go install github.com/pressly/goose/v3/cmd/goose@latest
```
for migration

```
go run ./cmd/migrate up
```

Seed the backoffice admin user (idempotent):
```bash
ADMIN_SEED_EMAIL=admin@example.com ADMIN_SEED_PASSWORD='ChangeMe#2026' go run ./cmd/admin-seed
```

---

## Local Development (with hot reload)

### 1. Start infrastructure (Postgres, Redis, Mailpit)
```bash
docker compose up -d
```

### 2. Run migrations
```bash
go run ./cmd/migrate up
```

### 3. Run Go API with auto-reload

Install [Air](https://github.com/air-verse/air) (once):
```bash
go install github.com/air-verse/air@latest
```

Then start the API — Air watches for `.go` file changes and automatically rebuilds + restarts:
```bash
air
```

The server runs on `http://localhost:8080` (or whatever `PORT` is set in `.env`).

### 4. Run the Next.js frontend (separate terminal)
```bash
cd web
pnpm install
pnpm dev
```

Frontend runs on `http://localhost:3000`.

### Without Air (manual restart)

If you prefer not to use Air, you can run the API directly:
```bash
go run ./cmd/api
```
You'll need to stop and restart manually after each code change.

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


## 
## 1) Add a “Safe Zone” that you never overwrite

Create these folders:
````
web/
core/                 # you own (upstream changes)
theme/                # user owns (safe zone)
brand.ts
globals.css         # (optional) theme-only css
overrides/
components/
app/
plugins/              # optional add-ons
enabled.ts
registry.ts
slots.ts
_examples/

````
Rule for forks (simple):

If you want to customize look/layout → edit web/theme/**

If you want features → add plugin in web/plugins/**

Avoid editing web/core/**

This alone reduces merge pain massively.


````
$env:GOOS="linux"
$env:GOARCH="amd64"
$env:CGO_ENABLED="0"
go build -o go-ecommerce-migrate ./cmd/migrate
````

````
$env:GOOS="linux"
$env:GOARCH="arm64"
$env:CGO_ENABLED="0"
go build -o go-ecommerce-api ./cmd/api

go build -o go-ecommerce-migrate ./cmd/migrate
go build -o go-ecommerce-import-terminals ./cmd/import-terminals
````
````
Remove-Item Env:GOOS
Remove-Item Env:GOARCH
Remove-Item Env:CGO_ENABLED
````
git restore go-ecommerce-api
git pull
chmod +x go-ecommerce-api
sudo systemctl restart volm-api


sudo systemctl restart volm-web