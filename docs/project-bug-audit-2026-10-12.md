# Project bug audit — 12 October 2026

Branch: `codex/project-bug-audit`.

Reviewed the main authentication, trip setup, dashboard/weather, Explore/saved places, map/routing, itinerary, SafeTag/notification, server/cache and database flows. This is a source review with automated regression checks; authenticated browser journeys and a live production database were not exercised.

## Fixed

- Trip setup previously updated the trip, deleted companions and inserted replacements in separate requests. A failed insert could lose companions. Saving now uses one authenticated database transaction, preserving existing RLS and deriving ownership from `auth.uid()`.
- Background trip refreshes no longer overwrite edits to the same trip. Setup blocks saving when the existing trip could not be loaded, with a retry option.
- Delayed GPS/reverse-geocoding responses no longer overwrite a manually chosen start, a swapped route, a loaded saved route or an explicit shared-link origin. Cached coordinates are validated.
- Route sharing waits for the clipboard operation before reporting success and handles denied clipboard access.
- Removing a waypoint no longer runs route calculation inside a React state updater, which could execute twice in development Strict Mode.
- Map import/initialization failures and a failed fallback style now leave the loading screen and offer a usable retry. The load timer is cleared on unmount.
- Saved places without coordinates no longer silently route to Panjim. Zero coordinates are accepted when valid. Database read failures preserve the query's error state, show retry UI, and prevent Explore from toggling an unknown saved-place list.
- Authentication error text is no longer decoded twice, preventing malformed percent text from crashing the sign-in page.
- SafeTag rejects non-object alert bodies, handles non-string notes, validates complete coordinate pairs and bounds, and adds database request timeouts. Mock notification delivery is never presented as a delivered guardian alert. Missing live delivery credentials produce failed channel statuses rather than simulated success.
- Weather responses are validated before rendering. Partial/null forecast arrays are hidden, preventing missing values from appearing as zero temperatures, zero rain probabilities or clear skies. Unknown weather codes have an honest unavailable label.
- The service worker only removes obsolete Safr caches and bypasses cross-origin and non-GET requests.

## Required database update

Apply `backend/supabase/migrations/20261012000200_atomic_trip_save.sql` before deploying the updated trip setup page. The same function is mirrored in `backend/supabase/schema.sql`.

Until this migration is applied, saving shows a database-update message and leaves existing data intact. There is deliberately no destructive multi-request fallback. The SQL was reviewed but not executed against PostgreSQL in this session. Verify with two authenticated accounts that one user cannot modify another user's trip, and that a rejected companion insert rolls back both the trip edit and companion deletion.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with two existing Fast Refresh export warnings in `ui/button.tsx` and `ui/toggle.tsx`.
- `npm run build`: passed; existing large client chunk warnings remain.
- `npm test`: 105 tests passed, including 9 additional regression tests for request validation, notification honesty, transactional trip client behavior, service-worker isolation and incomplete weather responses. Tests use fixtures/mocks; no real external requests or notifications were sent.
- `git diff --check`: passed. No generated route files or Supabase client files were edited. No new explicit `any` types or lint-disable comments were introduced.

## Still requires configuration or manual verification

- The local `.env` has no populated `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` or `NOTIFY_MODE`. Live SafeTag delivery needs valid server-only credentials and explicit live configuration; defaults simulate delivery, which now remains visibly undelivered. Secrets were neither fabricated nor printed.
- Previously reported missing remote tables/migrations were not applied or reverified against production. See `docs/runtime-audit-repair.md` for the existing database repair procedure. Persistent cache, crowd reports and saved routes depend on that setup.
- Real family location sharing remains unimplemented; the Reunite page already explains this limitation. It was not completed as part of bug repair.
- Test device location permission denial, a slow GPS response after choosing a start, shared-link origins, route swaps, clipboard denial, missing-coordinate saved places and map retry with blocked tile requests.
- Verify trip editing after applying the migration, including companion age/phone validation failures. Confirm SafeTag live delivery in a controlled test using an authorized guardian and properly configured credentials.
- Authenticated visual journeys and live API availability/photo matching remain manual checks. Passing local checks cannot establish that every production interaction is bug-free.
