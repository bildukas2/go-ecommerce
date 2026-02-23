# Infrastructure & DevOps Analysis

> Analysis date: 2026-02-23

## Docker Configuration

### Production Build (`deploy/Dockerfile.api`)
```
Stage 1: golang:1.26 → build static binary (CGO_ENABLED=0)
Stage 2: gcr.io/distroless/static:nonroot → minimal runtime
```
- Multi-stage build (good)
- Distroless base image (security-hardened, minimal attack surface)
- Non-root user (good)
- Static binary (no CGO dependencies)
- **Note**: Dockerfile uses `golang:1.26` but `go.mod` specifies `1.24.0` - version mismatch

### Development Build (`deploy/Dockerfile.dev`)
```
golang:1.25 + air hot reload
```
- **Note**: Uses `golang:1.25`, different from both go.mod (`1.24.0`) and production Dockerfile (`1.26`)

### Docker Compose (`docker-compose.yml`)
```yaml
services:
  postgres:  # port 5435 → 5432
  redis:     # port 6379 → 6379
  web:       # port 3000 → 3000 (Next.js)
  # api:     # COMMENTED OUT (for local Go dev)
```
- PostgreSQL 16 with named volume `pgdata`
- Redis 7
- Web service builds from `./web`
- API service commented out (developers run Go locally with `air`)
- **Issue**: No network isolation between services
- **Issue**: No health checks defined in compose

---

## CI/CD Pipeline

**Status: NONE**

No CI/CD configuration found:
- No `.github/workflows/`
- No Jenkinsfile
- No `.gitlab-ci.yml`
- No Makefile

**Recommendation**: Add GitHub Actions with:
1. `go test ./...` on push
2. `npm run lint && npm run build` for frontend
3. Docker build verification
4. Migration validation

---

## Environment Configuration

### Files
| File | Purpose | In Git? |
|------|---------|---------|
| `.env` | Local dev config | Should NOT be (check history) |
| `.env.example` | Template for new devs | Yes |
| `web/.env.local` | Frontend local config | No (gitignored) |

### Key Variables
```
PORT=8080
DATABASE_URL=postgres://app:app@localhost:5435/ecommerce?sslmode=disable
REDIS_URL=redis://localhost:6379/0
NEXT_PUBLIC_API_URL=http://localhost:8080
ADMIN_USER=admin
ADMIN_PASS=admin
STRIPE_PUBLIC_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
CURRENCY=USD
CORS_ALLOWED_ORIGINS=...
UPLOADS_DIR=./tmp/uploads
ENABLED_MODULES=... (comma-separated)
```

### Issues
- Default admin credentials (`admin/admin`)
- SSL disabled for database
- Stripe test keys (fine for dev, dangerous if copy-pasted to prod)
- `web/.env.local` contains backend secrets (DB, Redis, Stripe) that frontend shouldn't need

---

## Database

### Setup
- PostgreSQL 16
- Driver: `jackc/pgx/v5` with stdlib compatibility
- Migrations: `pressly/goose/v3` (SQL-based)
- 21 migrations in `/migrations/`
- Module-specific migrations supported via `internal/modules/*/migrations/`

### Connection Pool
- Max open: 10 (configurable via `DB_MAX_OPEN`)
- Max idle: 5 (configurable via `DB_MAX_IDLE`)
- Max lifetime: 30 minutes
- No health check interval

### Migration CLI (`cmd/migrate/main.go`)
- Supports `up` and `status` commands
- Respects `ENABLED_MODULES` for selective migration
- Uses `database/sql` with pgx driver

---

## Git Configuration

### .gitignore (Root)
- Go binaries, test artifacts, workspace files
- Node: `node_modules/`, `.next/`, `dist/`, `build/`
- IDE: `.idea/`, `.vscode/`, `.zencoder/`, `.zenflow/`, `.kilocode/`
- `.env` explicitly excluded
- Logs: `*.log`

### .gitignore (Web)
- Standard Next.js patterns
- `.env*` properly excluded

### Hooks
- No custom git hooks configured (only `.sample` files)
- **Recommendation**: Add pre-commit hook for `go fmt`, `go vet`, `eslint`

---

## Build System

### Backend
- Build: `go build -o ./tmp/main.exe ./cmd/api`
- Hot reload: `air` with `.air.toml` config
- Watches `.go` files, excludes tests and web directory
- No Makefile

### Frontend
- Dev: `npm run dev` (next dev)
- Build: `npm run build` (next build)
- Lint: `npm run lint` (eslint)
- No Makefile

### Testing
- Backend: `go test ./...`
- Frontend: `npm run lint` + Playwright E2E
- E2E files in root: `test-admin-*.js`, `test-custom-options-e2e.js`
- **Issue**: E2E test files at root level, not in a `tests/` directory

---

## Security Posture

### Good
- Distroless production image
- Non-root container user
- HttpOnly cookies for sessions
- SameSite=Lax on cookies
- Rate limiting (Redis-backed, 120 req/min)
- IP blocking middleware
- Security headers for admin routes
- Parameterized SQL queries throughout

### Needs Improvement
- No CSRF protection
- Basic Auth for admin (no JWT/OAuth)
- No trusted proxy validation for X-Forwarded-For
- No SSL for database connections
- No secret management (just env vars)
- No network isolation in Docker Compose
- Default credentials in env files
- No audit logging for admin actions

---

## File Upload System

- Upload directory: configurable via `UPLOADS_DIR` (default: `./tmp/uploads`)
- Served at `/uploads/*` path
- Media management via admin module
- Supports URL import
- **Issue**: No file type validation visible in analysis
- **Issue**: No file size limits visible
- **Issue**: Upload directory not persisted in Docker (needs volume mount)

---

## Documentation Status

| File | Content | Quality |
|------|---------|---------|
| `readme.md` | MVP features, setup instructions | Basic |
| `repo.md` | Agent instructions, stack, code standards | Good |
| `AGENTS.md` | AI agent rules, KISS principles | Good |
| `PROJECT_CONTEXT.md` | TODO placeholder | Empty |
| `docs/` | Empty directory | None |
| `web/README.md` | Minimal | Basic |

**Missing**:
- API documentation (OpenAPI/Swagger)
- Architecture diagrams
- Deployment guide
- Contributing guide
- Database schema documentation

---

## Recommendations Priority

### Immediate
1. Add GitHub Actions CI/CD (test + lint + build)
2. Verify `.env` not in git history
3. Fix Go version mismatch across Dockerfiles and go.mod
4. Add Docker health checks

### Soon
1. Add pre-commit hooks (`go fmt`, `go vet`, `eslint`)
2. Create a Makefile for common commands
3. Move E2E tests to `tests/` directory
4. Add file upload validation (type, size)
5. Configure Docker network isolation

### Later
1. Add OpenAPI documentation
2. Implement secret management (Vault, SOPS, etc.)
3. Add database backup configuration
4. Set up monitoring (Prometheus + Grafana)
5. Configure database SSL for non-dev environments
