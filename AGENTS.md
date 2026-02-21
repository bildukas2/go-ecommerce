# AI Agent Instructions (READ THIS FIRST)

This is a public, open-source Go ecommerce project.
Your job is to help implement features **without over-engineering**.

If anything is unclear, **choose the simplest correct approach**


---

## Project Goals (Non-negotiable)

1) **Super easy setup** (new dev runs it quickly)
2) **Super easy to add features** (module/plugin style)
3) **Fast UX** (storefront feels instant)
4) **Modern 2026 UI** (JolyUI-style blocks, tasteful motion)

---

## Stack

### Backend
- Language: **Go**
- API: HTTP JSON (REST-ish)
- Database: **PostgreSQL**
- Cache/session/rate limit: **Redis**
- Migrations: `goose` or `atlas` (whichever is already in the repo)
- SQL: prefer **sqlc** if present; otherwise use clean `database/sql`
- Events (optional): **NATS** or Redis Streams (only if repo already uses it)

### Edge / Transport
- Prefer enabling **HTTP/3 (QUIC) at the edge** (e.g. Caddy/CDN).
- The Go app should remain standard HTTP behind the proxy unless the repo already implements HTTP/3.

### Frontend
- **Next.js (App Router)**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **JolyUI** components/blocks
- Animations: **Framer Motion** (use sparingly, focus on perceived speed)

---

## Documentation & References (use these first)

### Go
- Go docs: https://go.dev/doc/
- Standard library: https://pkg.go.dev/std

### Postgres
- Docs: https://www.postgresql.org/docs/

### Redis
- Docs: https://redis.io/docs/latest/

### Next.js
- App Router docs: https://nextjs.org/docs/app

### Tailwind
- Docs: https://tailwindcss.com/docs

### shadcn/ui
- Docs: https://ui.shadcn.com/docs

### JolyUI
- Components/blocks: https://www.jolyui.dev/

### Framer Motion
- Docs: https://www.framer.com/motion/

### Caddy (HTTP/3 at edge)
- Docs: https://caddyserver.com/docs/

---

## How You Must Behave (Agent Rules)


## Agent Execution Mode (Default)

You are in IMPLEMENTATION MODE.

Your job is to build working features, not to teach or discuss.

Default behavior:
- Implement the task
- Output minimal required result
- Prefer code over text
- Do not explain unless explicitly requested

---


## Communication Rules

- Be concise
- No introductions
- No closing remarks
- No educational explanations
- No architectural discussion unless requested


## Output Rules
- Default: code only
- No introductions
- No closing remarks
- Never output long prose.


## Development Mode
- Implement, do not teach
- Prefer minimal responses
- Follow command-style prompts


## Token Efficiency
- Avoid verbosity
- Avoid architectural discussion unless requested
- Avoid repetition
- Avoid restating the task
- Avoid summarizing what was already known

## When unsure
Ask a short clarification question instead of writing long explanation
- Do not speculate.
- Do not write long reasoning.

### KISS first
- Prefer **simple and boring** solutions.
- Do **not** introduce microservices, CQRS, event sourcing, DDD layers, or fancy patterns unless the repo already uses them and the task requires it.

### Small PRs
- Keep changes focused: **1 feature or fix per PR**.
- Avoid large refactors "while you're here".

### No "agent creep"
- Do not add new dependencies unless clearly necessary.
- If adding a dependency, justify it in the PR description and keep it minimal.

### Don't break the setup
- `docker compose up` (or the documented dev command) must keep working.
- Never make setup harder.

### Security basics
- Never log secrets or tokens.
- Validate and sanitize user input.
- Use parameterized SQL only.
- Do not expose internal stack traces to clients.

### Performance basics (without premature optimization)
- Add indexes only when needed.
- Use pagination for list endpoints.
- Cache only obvious hot paths (if repo already has Redis patterns).

### UI/UX principles
- Animations: prefer **transform + opacity**. Avoid heavy layout thrashing.
- Keep checkout/cart clean and fast. No distracting motion.
- Ensure mobile-first responsiveness.

---

## Code Standards

### Backend (Go)
- Use `go fmt`.
- Prefer standard library, `chi` routing if present.
- Clear package boundaries:
  - `internal/` for app code
  - `cmd/` for entrypoints
- Errors:
  - Return consistent JSON error shape (use existing project standard).

### Frontend (Next.js)
- TypeScript strict (if enabled).
- Use server components by default; client components only when needed.
- Keep components small; prefer reuse via `components/`.
- Use shadcn + JolyUI patterns for UI consistency.

---

## "Plugin / Module" Structure (KISS version)

Features should be implemented as **modules** rather than hard-coding everything into one giant file.

A module typically provides:
- routes (API endpoints)
- database migrations
- optional event handlers (only if event bus exists)

Enable/disable modules via config/env if the repo supports it.

Do NOT use Go's `plugin` package.

---

## Testing & Verification (must do before finishing)

Minimum checks before marking work done:
- Backend:
  - build passes: `go test ./...` (or repo equivalent)
  - migrations apply cleanly in dev
- Frontend:
  - `npm run lint` / `pnpm lint` (whatever repo uses)
  - `npm run build` (or repo equivalent)
- Manual sanity:
  - load home page
  - product list loads
  - product page renders
  - add-to-cart works (if implemented)

If tests don't exist yet, add at least **one** basic test for new logic (unless task is pure UI).

---

## PR / Commit Message Format

Use this format:

- Summary: what changed (1-2 lines)
- Why: reason / goal
- How to test: exact commands + manual steps
- Notes: assumptions, tradeoffs, follow-ups

Example:

feat(cart): add bundle drawer UI

Why:
- Improve AOV with bundles, keep UX fast

How to test:
- pnpm dev
- Open /product/xyz
- Click "Build a bundle", add/remove items, confirm cart updates

Notes:
- Uses Framer Motion for transform/opacity only
- No backend changes

---

## What NOT to do (hard rules)

- Do not rewrite the architecture.
- Do not introduce a new framework (no Nest, no Angular, no micro-frontends).
- Do not change formatting/tools across the whole repo.
- Do not invent endpoints, env vars, or secrets - use existing conventions.

---

## When uncertain

Choose the simplest approach, document assumptions, and keep changes minimal.
If the repo has an established pattern, follow it exactly.

