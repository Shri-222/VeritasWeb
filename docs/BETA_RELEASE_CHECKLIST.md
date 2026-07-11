# VeritasWeb v0.1 Beta Release Checklist

Use this checklist before deploying or demonstrating VeritasWeb. Test with non-sensitive public pages and disposable QA accounts, not real client evidence.

## Required Environment Variables

Required for the core beta:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `CRON_SECRET`
- `SUPABASE_STORAGE_BUCKET` (defaults to `captures`)
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_PROVIDER=supabase`

Optional beta limits:

- `BETA_MAX_MONITORS_PER_USER`
- `BETA_MAX_CAPTURES_PER_DAY`
- `BETA_MAX_BUNDLE_CAPTURES`

Optional integrations remain disabled unless fully configured:

- `WEBHOOK_SIGNING_SECRET`
- `EMAIL_PROVIDER`, `RESEND_API_KEY`, and `EMAIL_FROM`
- R2, Gemini, and trusted timestamp provider variables

Only `NEXT_PUBLIC_*` variables may be exposed to browser bundles. Keep service-role, JWT, cron, webhook, and provider secrets server-only.

## Required Supabase Setup

- Run `scripts/01-init-schema.sql` through `scripts/11-duplicate-case-names.sql` in numeric order.
- Run `scripts/check-startup-upgrade-schema.sql` and review every reported table, column, index, and RLS state.
- Create the `captures` Storage bucket and keep it private.
- Confirm direct authenticated inserts into `captures` are rejected.
- Confirm direct authenticated deletes of monitors are rejected.
- Confirm the service-role key is configured only on the server.

## Automated Validation

- [ ] `npm install` completes.
- [ ] `npm run postinstall:playwright` installs Chromium.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` has no errors; review warnings.
- [ ] `npm run build` passes.
- [ ] `npm test` passes.
- [ ] `npm run validate` passes.
- [ ] `npm audit --omit=dev` has no unaccepted production blocker.
- [ ] `docker build -t veritasweb .` passes on the target release machine when Docker is used.

## Manual QA

Authentication and access:

- [ ] Register, login, logout, and dashboard redirect behavior work.
- [ ] Unauthenticated monitor, capture, verification, report, bundle, case, and notification calls are blocked.
- [ ] A second user cannot read or modify the first user's monitors, captures, cases, reports, or bundles.

Monitor and capture workflow:

- [ ] Create a monitor for a public HTTP/HTTPS URL.
- [ ] Duplicate URL/frequency returns `409 MONITOR_ALREADY_EXISTS` inline.
- [ ] Localhost, private IPs, metadata IPs, and non-HTTP schemes are blocked.
- [ ] Pause, resume, frequency update, and safe-delete behavior work.
- [ ] Manual capture stores screenshot, HTML, manifest, hashes, and metadata.
- [ ] Wrong or missing `CRON_SECRET` returns `401`.
- [ ] Correct cron authorization processes only due active monitors.

Evidence workflow:

- [ ] Capture detail displays URLs, status, headers, paths, timestamps, and hashes without overflow.
- [ ] Screenshot preview uses a short-lived owner-scoped URL.
- [ ] Integrity verification succeeds for an unchanged complete capture.
- [ ] Missing artifacts and mismatches show clear non-success states.
- [ ] PDF export returns `application/pdf`, paginates long content, and includes limitations.
- [ ] Capture bundle returns `application/zip` and contains the expected available artifacts.
- [ ] An incomplete legacy capture returns a clear 409 rather than a corrupt bundle.

Cases and notifications:

- [ ] Create, rename, archive/delete, and empty-case states work.
- [ ] Normalized duplicate case names return `409 CASE_ALREADY_EXISTS`.
- [ ] Assigning a monitor to an owned case works.
- [ ] No-config notifications return an empty/disabled state without a 500.
- [ ] Missing email or webhook provider configuration does not crash the dashboard.

Public and responsive UI:

- [ ] `/`, `/demo`, `/login`, and `/register` load on desktop and mobile widths.
- [ ] Demo assets and sample PDF load without private API calls.
- [ ] Reduced-motion mode removes continuous or translation-heavy animation.
- [ ] No horizontal overflow, overlapping controls, dead buttons, or development overlays are present.

## Demo Flow

1. Open the public landing page and explain the stored-artifact workflow without making legal guarantees.
2. Open `/demo` and identify it as bundled, read-only sample data.
3. Login to a disposable QA account.
4. Create or open a monitor for a public test page.
5. Run capture, open the evidence record, and verify integrity.
6. Export the PDF and evidence bundle.
7. Explain that integrity verification does not independently establish legal admissibility.

## Deployment Notes

- Use a Node/Docker-capable host; static hosting is insufficient.
- Ensure Playwright Chromium and required OS libraries are installed.
- Give captures enough memory and request time for full-page rendering.
- Configure an external scheduler for the protected cron endpoint.
- Keep the Storage bucket private and configure production logging/alerting without logging secrets.
- In-memory rate limits are single-instance beta safeguards, not distributed production controls.

## Known Limitations

- VeritasWeb does not independently establish legal admissibility.
- It does not replace formal chain-of-custody, notarization, expert review, or jurisdiction-specific procedures.
- No RFC3161 trusted timestamp provider is enabled by default.
- Email, AI summaries, R2 storage, and visual pixel diffs are unavailable or disabled without completed provider integrations.
- Captures may vary with geography, cookies, authentication state, scripts, bot defenses, and time.
- Legacy records created before the artifact pipeline may not support verification or complete bundles.
- Rate limiting is in-memory and should be replaced for multi-instance production deployments.

## Rollback Notes

- Keep the previously deployed application image available before rollout.
- Do not roll back or delete evidence rows, stored artifacts, or applied additive migrations.
- If application deployment fails, route traffic back to the previous image while retaining the current database and private bucket.
- Disable the external scheduler during an incident to prevent new scheduled captures; do not expose or remove existing evidence.
- Rotate any secret suspected of exposure and restart affected instances.
- Preserve server logs needed to diagnose the release without recording credentials or private artifact contents.

