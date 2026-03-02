# Production systemd setup (Go API + Next.js web)

This project can run as two services:
- `volm-api` -> Go binary (`go-ecommerce-api`)
- `volm-web` -> Next.js (`web`)

## 1) Install unit files

```bash
sudo cp deploy/systemd/volm-api.service /etc/systemd/system/volm-api.service
sudo cp deploy/systemd/volm-web.service /etc/systemd/system/volm-web.service
sudo systemctl daemon-reload
```

## 2) Create environment file

Create `/etc/volm/volm.env` and keep only production values there:

```bash
sudo mkdir -p /etc/volm
sudo nano /etc/volm/volm.env
```

Minimum variables:

```env
# Go API
PORT=8080
DATABASE_URL=postgres://...
REDIS_URL=redis://127.0.0.1:6379/0
TRUSTED_PROXIES=127.0.0.1/32,::1/128

# Next.js
NEXT_PUBLIC_API_URL=https://your-domain.example
API_INTERNAL_URL=http://127.0.0.1:8080
PUBLIC_URL=https://your-domain.example
```

Notes:
- `API_INTERNAL_URL` must point to local Go API for SSR (`http://127.0.0.1:8080`).
- Keep `NEXT_PUBLIC_API_URL` as your public domain.

## 3) Build artifacts

```bash
cd /opt/volm
go build -o go-ecommerce-api ./cmd/api

cd /opt/volm/web
npm ci
npm run build
```

## 4) Enable and start services

```bash
sudo systemctl enable volm-api volm-web
sudo systemctl restart volm-api
sudo systemctl restart volm-web
```

## 5) Fast debug commands

```bash
sudo systemctl status volm-api --no-pager -l
sudo systemctl status volm-web --no-pager -l
sudo journalctl -u volm-api -n 200 --no-pager
sudo journalctl -u volm-web -n 200 --no-pager
```

Health checks:

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
curl -I http://127.0.0.1:3000
```

## 6) Common failure cases

- `volm-web` restarts in loop:
  - `npm run build` was not executed after latest code update.
  - `WorkingDirectory` not set to `/opt/volm/web`.
- Admin pages fail in SSR:
  - missing or wrong `API_INTERNAL_URL`.
- API starts but DB-related endpoints fail:
  - invalid `DATABASE_URL` or DB not reachable from host.
