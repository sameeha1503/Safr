# Companion tracking, meeting points and SOS

Implemented on 2026-10-18. The Reunite workspace is `/live-tracking`; companion invitations open `/share/:token` without an account.

## Deployment

### Finding the settings and repairing the project

1. Sign in at https://supabase.com/dashboard/project/<your-project-ref>/sql/new and confirm this is your Safr project.
2. Open `backend/supabase/repairs/20261022_reunite.sql`, copy its entire contents into a new SQL query, and click Run. It must finish successfully; if it fails, keep the error text for diagnosis. The transaction rolls back on failure.
3. Open Project Settings → API Keys. Under Legacy API Keys, reveal the `service_role` key; an existing server secret key (`sb_secret_…`) is also supported. Do not copy the publishable/anon key for this setting. Do not rotate or remove existing keys to perform this repair.
4. Edit `frontend/.env` locally and add `SUPABASE_SERVICE_ROLE_KEY=` followed by that private key. Never paste the key into chat or commit the file. A deployed app needs the same value in its hosting provider's server environment settings.
5. Stop and restart the app with `npm run dev` from `frontend/`. Run `npm run check:tracking`; missing tables, columns or credentials should no longer be reported. Open Reunite and click Check again.

The 2026-10-24 browser investigation reproduced an itinerary authentication failure under the old start command. Development and production start commands now enable Node's system CA store, preserving TLS verification. This makes normal app launches use the same trusted certificates as diagnostics. The actual authenticated itinerary page subsequently generated a five-stop Anjuna plan and confirmed it was saved to the account. Reunite's missing configuration stops automatic retry/polling until a manual recheck; a missing trip offers trip setup, while an expired session offers sign-in.

### Repair for an older database (2026-10-22)

Read-only checks of the configured remote project found missing `trips.phone_number`, `travellers.phone_number`, `location_links`, `trip_meeting_points`, and `sos_incidents`. The local server service-role key is also absent. Changing the UI alone cannot restore these features.

Apply `backend/supabase/repairs/20261022_reunite.sql` in the intended project's SQL Editor. It combines the missing phone columns, location-sharing dependencies, meeting/SOS tables and policies, and the current atomic trip-saving function in one transaction, then refreshes the API schema cache. It preserves existing rows and can be rerun against the repository schema. If existing rows violate a unique constraint, the transaction stops for manual reconciliation rather than deleting data. The repair has not been executed here because no database administrator connection is configured.

Add the service-role key privately to the server environment, restart the server, and run `npm run check:tracking` from `frontend/`. That check requests zero rows and never prints keys. It uses the operating system's trusted certificate store; TLS verification stays enabled. Then verify trip saving, invitation creation, and the two-device checks below. Do not put a service-role key in chat or a browser-prefixed environment variable.

1. Apply existing prerequisite migrations, including `20261008000000_location_sharing.sql`, then `20261018000000_meeting_points_and_sos.sql`. The consolidated schema mirrors this migration. It also updates the atomic trip-save function to preserve existing companion IDs and their invitations when editing a trip.
2. Configure the existing server-only `SUPABASE_SERVICE_ROLE_KEY` alongside the Supabase URL. Never use a `VITE_` prefix for this secret. No new environment variable names are introduced.
3. For real messages, configure existing `NOTIFY_MODE`, `NOTIFY_CHANNELS`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and the WhatsApp/SMS sender settings. The default notification mode is mock. Set channels to `whatsapp,sms` for both, subject to provider permissions and recipient eligibility. Provider acceptance is not confirmed delivery.
4. Deploy over HTTPS for mobile geolocation. Verify private Realtime subscriptions and the migration's policies in the target Supabase project. Public channels carry refresh hints only; if unavailable, companion polling remains available.
5. Run the repository RLS audit against the deployment. The audit includes the two new tables. Review the SQL in staging before production; automated fixtures do not execute PostgreSQL policies.

## Behaviour and access

- Invitations contain 32 random bytes encoded as hex, expire after 24 hours, and are stored only as SHA-256 hashes. Rotating or revoking an invitation invalidates the old token. Treat an invitation URL as a secret; QR generation is local.
- Location collection starts only after a companion clicks Start and grants browser permission. Battery reporting is optional. Pause clears the saved position; End sharing revokes the invitation. Closing a tab ends its local GPS watcher, but cannot reliably send a final pause request.
- Location updates are throttled to approximately two seconds; persistent snapshots use a 30-second database compare-and-set interval. The guardian sees accuracy, battery when available, freshness, straight-line distance and bearing, and walking directions through the native/maps link.
- Guardians receive location messages on authenticated private `trip_tracking_` channels. Browser publication to that namespace is denied. The server verifies ownership or the invitation on every operation, then broadcasts. Public per-invitation channels contain only refresh hints, never coordinates, names or incident details. Receiving a hint triggers a token-authorized read.
- Meeting points are owner-controlled, one current spot per trip, with map selection or address search. Companions receive the point and directions through their valid invitation.
- SOS requires a two-second hold, supports keyboard cancellation, and opens emergency calling controls immediately. GPS failure does not prevent reporting. The server determines identity and trip membership, stores the incident, sends Realtime updates, and attempts configured notifications to the guardian or accepted companions. Active incidents are deduplicated per sender. Guardians can resolve or mark a false alarm.
- Emergency contacts reuse the existing verified/unverified labels in the directory. SOS does not automatically call or dispatch emergency services. The nearest listed Goa landmark is a curated straight-line approximation, shown only when nearby.

## Validation and remaining manual checks

Type checking and production build pass. Lint has zero errors and two pre-existing Fast Refresh warnings in the button/toggle UI modules. All 124 tests pass. New tests mock external requests and cover token lifecycle, ownership, snapshot throttling, meeting points, SOS identity/delivery failures, stale updates, distance/bearing, and cancelled holds.

Browser inspection verified invalid-invitation and unavailable-service states, the guardian retry state, and that a short SOS click does not activate it. The local service-role configuration is missing, so a live two-device flow and PostgreSQL/RLS execution have not been verified. No real alert messages were sent.

Before launch, verify on two real phones: invitation/QR joining, GPS allow and deny, pause/resume/end, rotation and expiry, meeting updates, connection loss/recovery, freshness indicators, and trip edits preserving invitations. Use designated test recipients to verify SOS persistence, both configured message channels, resolution, dial links, sound and vibration. Measure actual device-to-device latency; the 1–2 second target is not a measured guarantee.

Mobile browsers can suspend GPS or connections when backgrounded or locked. Sound, vibration and battery APIs vary by browser. Guardian polling falls back to 30 seconds and companion polling to 15 seconds. Rate limits are process-local; use a shared/edge limiter for multiple application replicas. Expired links cannot expose their snapshots through these APIs, but physical historical records need an explicit deployment retention policy.

## Implementation areas

Server functions and pure validation live in `frontend/src/lib/location-sharing*`, `companion-tracking.ts`, `tracking-actions.ts`, and `hold-trigger.ts`. Tracking UI/hooks live in `frontend/src/features/tracking/`; global SOS controls live in `frontend/src/components/sos/`. Routes remain thin wrappers. The AppShell, trip setup, notification adapter, Supabase types, schema and RLS audit were updated. Tests live in `misc/tests/` with mocked fixtures under `misc/tests/helpers/`.

Supabase references: [Realtime concepts](https://supabase.com/docs/guides/realtime/concepts), [authorization](https://supabase.com/docs/guides/realtime/authorization), and [Broadcast](https://supabase.com/docs/guides/realtime/broadcast). Private and public channels with the same topic are distinct; private location payloads are never sent on the public hint channel.
