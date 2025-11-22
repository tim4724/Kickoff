# Docker Deployment Guide

# Docker Guide

Keep it simple: build locally with the multi-pod compose file. The GHCR-only compose file was removed; use the workflow-published images directly if you need prebuilt artifacts.

## Quick Start (local build)

```bash
# Build and start client + server
docker-compose -f docker-compose.multi-pod.yml up --build

# Custom ports
CLIENT_PORT=8080 SERVER_PORT=3001 docker-compose -f docker-compose.multi-pod.yml up --build

# Stop
docker-compose -f docker-compose.multi-pod.yml down
```

## Images
- Local builds use `Dockerfile.client` (nginx static) and `Dockerfile.server` (Node/Colyseus).
- GitHub Actions can publish images to GHCR (see `.github/workflows/README.md`); pull those directly in your own compose file if desired.

## Environment
- Client: `SERVER_URL` (ws URL, defaults to `http://localhost:3000`), `CLIENT_PORT` (host, default 80).
- Server: `PORT` (internal, default 3000), `SERVER_PORT` (host, default 3000), `CORS_ORIGIN` (CSV, default `*`).

## Runtime config
`docker/client-entrypoint.sh` injects `SERVER_URL` at startup so the same client image works across environments.

## Health
- Client: `curl http://localhost:8080/health` → `healthy`
- Server: `curl http://localhost:3001/health` → `{"status":"ok",...}`

## Notes
- Dev flow prefers `npm run dev` (ports 5173/3000) with no Docker.
- Test flow auto-starts its own servers (ports 5174/3001) and does not require Docker.
