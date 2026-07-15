# Docker Deployment

VeritasWeb can run as a Dockerized Next.js application. The container uses a Playwright-compatible base image so server-side webpage capture can launch Chromium without an external browser service.

## Required Environment Variables

Create `.env.docker` from `.env.docker.example` and fill in real values locally or in your cloud provider:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=captures
STORAGE_PROVIDER=supabase
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
```

Only `NEXT_PUBLIC_*` values are browser-exposed. Keep `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and `CRON_SECRET` server-only.

## Build

```bash
docker build -t veritasweb:local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="..." \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="..." \
  --build-arg NEXT_PUBLIC_SITE_URL="http://localhost:3000" \
  .
```

PowerShell:

```powershell
docker build -t veritasweb:local `
  --build-arg NEXT_PUBLIC_SUPABASE_URL="..." `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="..." `
  --build-arg NEXT_PUBLIC_SITE_URL="http://localhost:3000" `
  .
```

## Run

Command Prompt:

```bat
docker run --rm ^
  --env-file .env.docker ^
  -p 3000:3000 ^
  veritasweb:local
```

PowerShell:

```powershell
docker run --rm `
  --env-file .env.docker `
  -p 3000:3000 `
  veritasweb:local
```

## Docker Compose

```bash
docker compose up --build
```

This compose file runs only the VeritasWeb app. It does not start local Supabase containers; use your hosted Supabase project.

## Health And Smoke Checks

```bash
curl.exe http://localhost:3000/api/health
```

Open:

- http://localhost:3000
- http://localhost:3000/demo
- http://localhost:3000/login
- http://localhost:3000/dashboard

The Dockerfile also includes a healthcheck that calls `http://127.0.0.1:3000/api/health`.

## Playwright Check

The image includes the Playwright Chromium browser from `mcr.microsoft.com/playwright:v1.60.0-noble`, matching the locked `playwright@1.60.0` dependency.

Run this after building the image:

```bash
docker run --rm veritasweb:local node scripts/check-playwright.mjs
```

The check launches Chromium, opens `https://example.com`, reads the page title, closes the browser, and exits non-zero on failure. It does not require Supabase.

## Docker QA Checklist

1. Container starts.
2. `/api/health` returns OK.
3. Landing page loads.
4. Demo page loads.
5. Login works.
6. Dashboard loads after login.
7. Create monitor works.
8. Duplicate monitor returns 409.
9. Unsafe URL returns 400.
10. Run Capture works inside Docker.
11. Capture detail works.
12. Verify Integrity works.
13. Export PDF works.
14. Download Evidence Bundle works.
15. Cron wrong secret returns 401.
16. Cron correct secret works.
17. No secrets appear in browser bundle.
18. Container logs do not expose the service role key.

## Cloud Docker Notes

Use any Docker-capable host with enough memory and request timeout for Playwright captures. Good fits include Render Docker Web Service, Railway Docker deployment, Fly.io, DigitalOcean App Platform or Droplet, or a VPS with Docker.

Required settings:

- Expose port `3000`.
- Set `PORT=3000` and `HOSTNAME=0.0.0.0`.
- Configure every required environment variable.
- Keep `CRON_SECRET` strong and server-only.
- Configure an external scheduler to call `/api/cron/capture-due` with `Authorization: Bearer <CRON_SECRET>`.
- Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` to the HTTPS deployment URL.
- Persistent container disk is not required for evidence artifacts because captures are stored in private Supabase Storage.
- Do not make the Supabase `captures` bucket public.

## Rollback Notes

Keep the previous image tag available in your registry. If a deployment fails, roll back to the last known-good image and confirm `/api/health`, login, capture, verification, PDF export, and bundle download before resuming scheduled captures.
