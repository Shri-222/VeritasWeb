# QA Checklist

Use this checklist before presenting the project or deploying a demo environment.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in real Supabase values.
3. Run Supabase SQL scripts `01` through `11` in numeric order.
4. Create a private Supabase Storage bucket named `captures`.
5. Install Playwright Chromium with `npm run postinstall:playwright`.
6. Start the dev server with `npm run dev`.
7. Register or log in.
8. Create a monitor for `https://example.com`.
9. Click `Capture Now`.
10. Confirm screenshot and HTML artifacts exist in the private Storage bucket.
11. Confirm the capture row includes URL metadata, artifact paths, hashes, status code, and trigger type.
12. Open the capture detail page.
13. Click `Verify Integrity` and confirm the verification result.
14. Click `Export PDF Report` and confirm the PDF downloads.
15. Confirm the PDF includes metadata, URLs, hashes, artifact paths, verification result, limitations, and screenshot preview if embedding worked.
16. Pause the monitor and confirm `next_capture_at` is cleared.
17. Resume the monitor and confirm it is active and scheduled.
18. Change monitor frequency and confirm the dashboard refreshes.
19. Delete a monitor that has no captures.
20. Confirm a monitor with captures cannot be deleted.
21. Confirm direct authenticated Supabase inserts into `captures` are rejected.
22. Confirm direct authenticated Supabase deletes of monitors are rejected.
23. Call cron with a wrong secret and confirm a `401` JSON error.
24. Call cron with the correct secret and confirm due scheduled captures run.
25. Confirm another authenticated user cannot access another user's monitor, capture detail, verification route, or PDF report.
26. Confirm unauthenticated capture/report/verify/monitor-management requests return `401`.
27. Run `npm run validate`.
28. Run `npm audit --omit=dev` and review any remaining production advisories.
