# Supabase Setup

This project needs Supabase Auth, PostgreSQL, and a private Storage bucket for stored capture artifacts.

## 1. Create A Supabase Project

Create a Supabase project and keep these values available for `.env.local`:

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
STORAGE_PROVIDER=supabase
```

`NEXT_PUBLIC_*` values are browser-safe. `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and `CRON_SECRET` are server-only secrets and must not be committed or exposed to client code.

## 2. Enable Auth

Use Supabase Auth for email/password registration and login. Configure any redirect URLs required by your deployment host.

## 3. Run SQL Scripts In Order

Open the Supabase SQL editor and run:

1. `scripts/01-init-schema.sql`
2. `scripts/02-capture-pipeline-fields.sql`
3. `scripts/03-scheduled-captures.sql`
4. `scripts/04-final-hardening.sql`
5. `scripts/05-security-hardening.sql`
6. `scripts/06-manifest-artifact.sql`
7. `scripts/07-cases-and-workspaces.sql`
8. `scripts/08-change-detection.sql`
9. `scripts/09-notifications.sql`
10. `scripts/10-provider-and-timestamp-fields.sql`
11. `scripts/11-duplicate-case-names.sql`

The scripts create owner-scoped `monitors` and `captures` tables, Row Level Security policies, capture artifact metadata fields, scheduled capture fields, final MVP indexes/comments, security hardening for server-created capture records, and the stored manifest artifact path used for deterministic verification.

The later scripts add owner-scoped cases, bounded capture diffs, optional webhook/email endpoint configuration, and future provider/timestamp fields. They are additive and do not recreate production tables.

Script `11` adds a per-user unique index for case names after trimming, whitespace folding, and case folding. It does not modify existing rows. If an older project already contains duplicate normalized case names, resolve those duplicates manually before applying the index.

Do not skip scripts `07` through `10` when upgrading an existing project. Core capture records remain compatible while these optional features are absent, but cases, change records, notification endpoints, and provider/timestamp metadata are not enabled until their migrations are applied.

### Verify An Existing Project

Run `scripts/check-startup-upgrade-schema.sql` in the Supabase SQL editor. It is read-only and reports:

- whether the cases, capture diffs, and notification tables exist;
- whether `monitors.case_id` and the capture provider/timestamp columns exist;
- whether Row Level Security is enabled on the relevant tables.

If any result is missing, apply the numbered migration that owns it, preserving the order above, then run the diagnostic again. A healthy upgraded project reports all listed tables and columns as present and RLS enabled on every listed table.

## 4. Create Private Storage Bucket

Create a Storage bucket named `captures` and keep it private.

If using SQL, this bucket insert is a useful starting point:

```sql
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do update set public = false;
```

Captured screenshots and HTML files are written under a user/monitor/timestamp path. The bucket should not be public. The app uses server-side access for uploads, verification, PDF report generation, and short-lived signed preview URLs for authenticated owners after capture ownership has been verified.

## 5. RLS Purpose

PostgreSQL RLS keeps normal monitor and capture reads scoped to the authenticated user. The service role key bypasses RLS and is used only server-side after ownership or cron-secret authorization has already been checked.

Capture rows are server-created only. Direct authenticated inserts into `captures` are intentionally blocked so users cannot forge evidence rows through the Supabase browser client.

Direct authenticated monitor deletes are intentionally blocked. Monitors with evidence records should be preserved and paused instead of hard-deleted; the API only deletes monitors after confirming they have no captures.

## 6. Cron Secret

Set `CRON_SECRET` to a long random value. Scheduled capture runners call:

```bash
curl -X POST https://your-app.example.com/api/cron/capture-due \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 7. Smoke Test

After configuring real env vars:

1. Start the app.
2. Register or log in.
3. Create a monitor for `https://example.com`.
4. Click `Capture Now`.
5. Confirm `screenshot.png` and `page.html` exist in the private `captures` bucket.
6. Open the capture detail page.
7. Run integrity verification.
8. Export the PDF evidence preservation report.
