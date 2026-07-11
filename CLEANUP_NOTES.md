# VeritasWeb Cleanup Notes

This audit records duplication observed during the monitor/case conflict fix. It is intentionally conservative around evidence and security code.

| Area | Duplicate files/functions | Risk | Safe to refactor now? | Recommendation |
| --- | --- | --- | --- | --- |
| Auth/session helpers | Dashboard, capture detail, and case detail each read the client session | Medium | No | Consider one client-only access-token helper after auth regression coverage exists. |
| Supabase client creation | `lib/supabase/client.ts`, `server.ts`, and `admin.ts` | High | No | Keep separate; they intentionally represent browser, SSR-cookie, and service-role trust boundaries. |
| Owned capture fetch | Capture detail, verify, report, bundle, diff, and affidavit use `fetchOwnedCaptureById` | Low | Already centralized | Keep the stable two-query ownership helper. |
| Owned monitor fetch | Monitor item route and capture-now perform similar owner checks | Medium | No | Extract only with route-level ownership tests; capture-now is security-sensitive. |
| Case ownership fetch | Case detail and case bundle query owner-scoped cases separately | Medium | No | Consolidate after migrations 07-10 are applied and case route tests exist. |
| Storage provider resolution | `lib/storage.ts` facade and `lib/storage/index.ts` implementation | Low | Already centralized | Preserve the facade because existing imports resolve through it. |
| Hash comparison | `normalizeHash` and `compareHashes` in `lib/forensic.ts` | High | Already centralized | Do not change; verification semantics depend on it. |
| URL/SSRF validation | URL parsing, synchronous screening, and DNS-backed validation in `lib/schemas.ts` | High | Partly | Keep SSRF logic unchanged; use the new display/duplicate normalization helper separately. |
| API response shapes | `apiErrorResponse` in `lib/auth.ts` is used across routes | Medium | No | A future rename to `lib/api-response.ts` would cause broad churn without fixing this bug. |
| Duplicate conflict mapping | Monitor and case routes previously interpreted database errors independently | Low | Yes, completed | Keep `lib/duplicate-conflicts.ts` as the pure `23505` mapper. |
| Duplicate lookups | Monitor create/update and case create/update need the same conflict checks | Low | Yes, completed | Keep lookup helpers in `lib/monitor-duplicates.ts` and `lib/case-duplicates.ts`. |
| Frontend blob downloads | PDF, capture ZIP, and case ZIP repeated object-URL/anchor cleanup | Low | Yes, completed | Keep response parsing and browser download triggering in `lib/download-response.ts`. |
| Inline alerts/status badges | Dashboard, auth pages, and evidence pages use shared UI components | Low | Already centralized | Continue using `InlineAlert`, `StatusBadge`, and `CopyButton`. |
| PDF/report metadata | PDF report builds metadata in its pagination/layout engine | High | No | Leave intact; refactoring could affect pagination and evidence presentation. |
| Bundle artifact paths | Capture and case bundles build related but differently scoped archive paths | Medium | No | Keep separate until bundle-content contract tests cover both archive formats. |

