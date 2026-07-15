# Deployment

VeritasWeb is not a static-only app. The capture pipeline runs Playwright Chromium server-side, stores private artifacts in Supabase Storage, and writes capture metadata to PostgreSQL. Use a Node/Docker-capable host.

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=captures
CRON_SECRET=
BETA_MAX_MONITORS_PER_USER=5
BETA_MAX_CAPTURES_PER_DAY=20
BETA_MAX_BUNDLE_CAPTURES=25
NEXT_PUBLIC_APP_URL=
STORAGE_PROVIDER=supabase
WEBHOOK_SIGNING_SECRET=
EMAIL_PROVIDER=
RESEND_API_KEY=
EMAIL_FROM=
```

Keep server-only secrets out of browser-exposed config and source control.

## Before Deploying

1. Run Supabase SQL scripts `scripts/01-init-schema.sql` through `scripts/11-duplicate-case-names.sql` in numeric order. See `SUPABASE_SETUP.md`.
2. Create the private `captures` Storage bucket.
3. Confirm Playwright Chromium can run in the target environment.
4. Confirm `/api/health` returns `{ "success": true, "status": "ok" }`.

## Docker

Build locally:

```bash
docker build -t veritasweb:local .
```

Run locally:

```bash
docker run --rm --env-file .env.docker -p 3000:3000 veritasweb:local
```

The Dockerfile uses the Playwright `v1.60.0` base image, builds Next.js standalone output, runs as a non-root user, and includes a healthcheck for `/api/health`. See `DOCKER_DEPLOYMENT.md` for Docker Compose, PowerShell commands, Playwright smoke testing, cloud Docker notes, and the Docker QA checklist.

## Scheduled Captures

Configure an external scheduler to call:

```bash
curl -X POST https://your-app.example.com/api/cron/capture-due \
  -H "Authorization: Bearer <CRON_SECRET>"
```

The app does not add an internal cron daemon. The endpoint is protected by `CRON_SECRET`, has a lightweight in-memory rate limit, and processes due active monitors with the same capture service used by manual `Capture Now`.

## Hosting Notes

- Static hosting is not sufficient because Playwright runs server-side.
- Serverless platforms may need custom Playwright/Chromium support and enough memory/time for full-page captures.
- Docker-capable hosts are the most straightforward path for this MVP.
- No external browser service is required or configured in this phase.
- Store artifacts in the private Supabase bucket; do not make evidence artifacts public by default.
- Capture rows are created by the server pipeline only, and private artifact signed URLs are generated server-side after ownership checks.
- The public landing page and `/demo` are static/read-only and do not require Supabase data access.
- R2, AI summaries, email delivery, and trusted timestamping are not enabled by the default Supabase provider configuration.
