# Runtime audit repairs

## Confirmed remote state

A read-only anonymous REST check on 2026-10-11 found missing/unexposed API relations: saved_routes, location_links, location_links_safe (view), blocked_numbers, location_audit, place_cache and crowd_reports. The remaining sensitive tables returned empty arrays; that is not proof of RLS. Emergency contacts were publicly accessible as intended.

The audit's bucket_list entry is incorrect for this checkout: Explore persists its bucket list to saved_places. The named migration upgrades that table and creates saved_routes. There is no active bucket_list query or generated bucket_list type.

## Database setup still required

No service-role key, database password, database URL or Supabase management token is configured in the local environment. No remote migration or credential change has been performed.

Run backend/supabase/repairs/20261011_runtime_tables.sql in the intended project's SQL Editor. This combines the four requested migration files in one transaction, supports repeat execution, and refuses duplicate saved-place names instead of deleting user data. Existing required core tables must already exist. If duplicates are reported, reconcile them manually before retrying. No separate bucket_list table is created.

Then run backend/supabase/verify-runtime-rls.sql. Confirm RLS enabled on all listed tables, place_cache inaccessible to authenticated users, and own-row policies for saved_routes, location_links and crowd_reports. Check location_links_safe uses security_invoker. Test two authenticated users and crowd cooldown before launch.

Add the real SUPABASE_SERVICE_ROLE_KEY privately to frontend/.env and to production server environment settings, never with a VITE_ prefix. Restart the server. Vite now explicitly loads it and the existing notification-provider settings server-side, and the production entry point loads the local frontend/.env when present without overriding injected environment settings. The key is never written into browser defines or source.

npm run check:rls now covers 15 relations, uses read-only bounded requests, and distinguishes missing relations, exposed records, access rejection and inconclusive empty results. Exit 1 means failures/missing relations/exposure; exit 2 means authenticated/catalog verification is still needed. It no longer performs invalid dummy inserts or claims all tables are secured.

## Code fixes

- One production server implementation in frontend/server.mjs; backend/server.mjs is a compatibility import. Service worker static responses receive no-cache and Service-Worker-Allowed headers.
- Saved-route load failures show an error with Retry. Failed deletes no longer claim success.
- Explicit any annotations in the current warning locations were replaced with MapLibre event/source types, schema-validated saved route/waypoint JSON, and PlanStop. MapLibre cluster expansion now uses its Promise API.
- SafeTag returns a clear 503 when admin configuration is missing; this does not restore notifications without the real key/provider setup.
- Overpass failover shares a six-second total budget across at most two providers. Set optional OVERPASS_FALLBACK_URL when OVERPASS_URL is explicitly configured. With no configured primary, the default public instance can fall back to the mirror already used by this repository. A custom primary never silently sends queries to a public mirror.

## Bundle size

MapLibre remains dynamically loaded. Its large vendor/worker chunks are inherent to the current renderer. Splitting a required React/TanStack startup bundle into more files does not itself reduce transferred JavaScript. No threshold increase or arbitrary vendor split was used to suppress warnings. Further payload reduction needs a measured dependency/feature change and runtime performance verification.

## Validation

Typecheck, lint and production build pass; all 89 tests pass. Lint retains two existing Fast Refresh warnings and no explicit-any warnings. Tests use mocked fetch; live database checks were run separately. No live notifications were sent. Database deployment, two-user RLS verification, real-device map interaction and production notification delivery remain unverified until credentials/setup are available.
