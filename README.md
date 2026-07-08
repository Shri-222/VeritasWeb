# VeritasWeb

VeritasWeb is a forensic-style web capture MVP and LegalTech prototype. It helps authenticated users preserve web pages as stored evidence records with screenshots, HTML artifacts, metadata, cryptographic hashes, integrity verification, scheduled captures, and PDF evidence preservation reports.

It is not a replacement for legal advice, formal chain-of-custody procedures, notarization, or jurisdiction-specific evidence rules. The project is designed to present a strong, honest MVP for evidence preservation workflows.

## Key Features

- Supabase Auth backed registration/login.
- Owner-scoped monitors with hourly, daily, or weekly frequency.
- Manual `Capture Now` and protected scheduled capture endpoint.
- Playwright server-side capture of screenshot and raw HTML.
- Private Supabase Storage artifacts under the `captures` bucket.
- Capture metadata including original URL, final URL, page title, HTTP status, headers, artifact paths, and trigger type.
- SHA-256 hashes for screenshot, HTML, and deterministic capture manifest.
- Integrity verification that recomputes stored artifact hashes.
- PDF evidence preservation report generated from stored capture data.
- Monitor pause/resume, frequency update, and safe delete behavior.
- Lightweight in-memory rate limits for expensive capture/report/verify routes.
- Basic SSRF protections, including DNS resolution checks before capture.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS and shadcn-style UI components
- Supabase Auth, PostgreSQL, RLS, and Storage
- Playwright Chromium
- jsPDF
- Zod

## Architecture Workflow

1. A user creates a monitor for a public HTTP/HTTPS URL.
2. The server validates URL safety and stores the monitor under the authenticated user.
3. Manual capture or the protected cron endpoint triggers the shared capture service.
4. Playwright opens the stored monitor URL and captures screenshot, HTML, status, headers, and page metadata.
5. The server computes screenshot, HTML, and manifest SHA-256 hashes.
6. Screenshot and HTML artifacts are uploaded to the private Supabase `captures` bucket.
7. Capture metadata is inserted into PostgreSQL.
8. Users can verify stored artifacts and export a PDF report from the capture detail page.

## Installation

```bash
npm install
npm run postinstall:playwright
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if needed.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
CRON_SECRET=
SUPABASE_STORAGE_BUCKET=captures
```

`NEXT_PUBLIC_*` values are browser-safe Supabase settings. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and `CRON_SECRET` are server-only secrets and must not be committed or exposed to client code.

## Supabase Setup

See [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

Run SQL scripts in order:

1. `scripts/01-init-schema.sql`
2. `scripts/02-capture-pipeline-fields.sql`
3. `scripts/03-scheduled-captures.sql`
4. `scripts/04-final-hardening.sql`
5. `scripts/05-security-hardening.sql`

Create a private Storage bucket named `captures`. Stored screenshots and HTML files should not be public by default.
Capture rows are server-created only; direct authenticated inserts into `captures` are intentionally blocked so evidence records cannot be forged through the browser client.

## Playwright Setup

The capture pipeline requires Chromium:

```bash
npm run postinstall:playwright
```

Production hosts must support server-side Playwright execution. Static hosting is not sufficient.

## Scheduled Captures

Scheduled captures are triggered by an external scheduler calling:

```bash
curl -X POST https://your-app.example.com/api/cron/capture-due \
  -H "Authorization: Bearer <CRON_SECRET>"
```

The app does not run an internal scheduler. The cron endpoint is protected by `CRON_SECRET`, selects due active monitors, applies a short lock to reduce duplicate work, and uses the same capture service as manual capture.

## Verification Workflow

Capture detail pages include `Verify Integrity`. Verification downloads the stored private screenshot and HTML artifacts server-side, recomputes hashes, rebuilds the deterministic manifest, and compares those values with the database record.

Verification confirms stored artifacts match their recorded hashes. It does not independently prove legal admissibility.

## PDF Report Workflow

Capture detail pages include `Export PDF Report`. The PDF is generated from stored capture data and stored artifacts; export does not recapture the website.

Reports include:

- report metadata
- capture summary
- artifact paths
- screenshot/HTML/manifest hashes
- previous capture hash when present
- verification result
- HTTP response metadata
- limitations and disclaimer
- screenshot preview when server-side embedding succeeds

## Monitor Management

Users can:

- create monitors
- manually capture a monitor
- pause active monitors
- resume paused monitors
- update frequency
- delete monitors only when they do not already have captures

Monitors with evidence records are not hard-deleted from the dashboard/API; pause them instead.
The database is also hardened so direct authenticated monitor deletes cannot cascade-delete stored capture records.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

The repository includes a simple Dockerfile that installs Playwright Chromium and builds the Next.js app:

```bash
docker build -t veritasweb .
docker run --env-file .env.local -p 3000:3000 veritasweb
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Validation

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run validate
npm audit --omit=dev
```

`npm run validate` runs typecheck, lint, build, and test.

## QA

See [QA_CHECKLIST.md](QA_CHECKLIST.md) for manual test steps covering setup, capture, artifact storage, verification, PDF export, monitor actions, cron authorization, and cross-user access checks.

## Limitations

- Not guaranteed court-admissible by itself.
- No RFC3161 trusted timestamping yet.
- No notarized chain-of-custody yet.
- No enterprise audit trail yet.
- In-memory rate limits are MVP safeguards only; production should use platform-level or Redis-backed rate limiting.
- Capture results can vary due to cookies, geography, authentication state, scripts, A/B tests, bot detection, or dynamic content.
- Playwright needs a server or container environment with Chromium support.
- Stored artifacts are private by default and accessed through server-side checks or short-lived signed URLs for owners.
- Capture artifacts are accessed from the configured `SUPABASE_STORAGE_BUCKET`, defaulting to `captures`.

## Roadmap

- Stronger audit trail for monitor and capture actions.
- Production-grade distributed rate limiting.
- Optional trusted timestamping.
- Evidence packet export formats beyond PDF.
- More robust capture configuration for authenticated or region-specific pages.
- Admin/operational observability for scheduled capture queues.

## Screenshots

Screenshots are not committed yet. Suggested placeholders for a final presentation:

- dashboard monitor list
- capture detail page
- integrity verification result
- PDF report preview
