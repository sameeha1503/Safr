# Explore overhaul report

Branch: `feat/explore-overhaul`. Phases 1–5 and each Phase 6 sub-step have separate commits. An additional final correction commit covers slow article hydration, curated/live merging, independent failure status, and the final report.

## Behaviour

Resolved search coordinates and names now drive saving, map links and planning. Normalized comparison avoids duplicate saves such as Baga / Baga Beach. Generic rules, crowd percentages, transport estimates, unrelated photos and generic warnings were removed.

Wikipedia descriptions and article thumbnails require a name match; missing or failed images use a neutral category icon. Existing curated highlights and interests remain. The hero renders independently of nearby results; a slow Wikipedia lookup can hydrate it afterward. Autocomplete is debounced and keyboard accessible. Search URLs support refresh, back and sharing, with the existing session fallback.

Independent sections provide weather/sea data, general guidance, nearby essentials, road estimates and actual crowd reports. Near me requests browser permission only on click and supports the Goa region. Open now hides only confidently closed places. Unknown hours remain visible. Map pins select corresponding nearby cards. Nearby details reuse the existing server function. Itinerary links pass coordinates through existing origin support; absent coordinates retain geocoding.

## Validation

- Typecheck, lint, production build and Node tests pass (85 tests).
- Lint has 18 pre-existing warnings; no new `any` types or eslint-disable comments were introduced.
- Tests block unmocked global fetch by default and use fixtures/mocked fetch. No live external API is contacted by tests.
- `rg -n "picsum" frontend/src`: no matches.
- `rg -n 'sights\?\.\[0\]' frontend/src`: no matches.
- No new component or route file under `src/routes/`; generated route tree and Supabase client files untouched.
- New Explore provider requests use fetchJson with a User-Agent and <=6-second timeouts and soft-fail. Supabase cache requests have 1-second deadlines; crowd database calls have 3-second deadlines. The shared existing map renderer requests its tiles/styles through MapLibre.

## Database and environment

Apply these manually to the intended Supabase database, in order:

1. `backend/supabase/migrations/20261012000000_place_cache.sql`
2. `backend/supabase/migrations/20261012000100_crowd_reports.sql`

The schema mirror and handwritten generated-type definitions include both tables. Cache has no authenticated-user policies; service-role calls populate it. Crowd insert/select policies restrict authenticated users to their own rows; aggregation uses service role. A database trigger serializes same-user/place inserts and enforces the 30-minute cooldown across processes and direct inserts.

No new environment variables. Existing optional `OSRM_BASE_URL` and `OVERPASS_URL` remain supported. Persistent cache and crowd services use existing Supabase service-role configuration. Missing database/cache configuration fails softly; missing crowd table shows unavailable rather than fabricated reports.

## Not done and why

- Migrations have not been applied: database deployment is left manual as requested.
- Seasonal notes have not been written: the task requires human-written, verified content, so all 40 existing curated entries remain without notes.
- Live provider responses, real-device/browser location permission flows, rendered MapLibre interactions, deployed database RLS/cooldown behaviour, and actual end-to-end first-paint timing have not been verified in this authenticated runtime. Automated checks use fixtures; external services and device permissions need manual verification.
- No Google Maps data replication, traffic feed, business ratings, transport prices or official swimming warnings are claimed. These sources do not supply those fields. Road estimates use a driving profile without live traffic.

## Verify by hand

- Apply both SQL migrations; check cache persistence after server restart, own-row crowd access, two-account aggregation, and cooldown rejection (including concurrent/direct inserts).
- On a real device in Goa, test Near me permission allow/deny, map pin selection, and bucket-list distance sorting. No location should be requested on page load.
- Search, refresh, share the URL, navigate back, choose suggestions with arrows/Enter/Escape, and test each section's Retry state with unavailable providers.
- Check road estimates from the searched centre and from granted location, quickest sorting, and null/unreachable routes.
- Check simple opening-hours boundaries in India time; complex/unknown hours must stay visible without a badge.
- Review live weather/marine responses and Wikipedia match/image quality for all eight featured names: Baga Beach, Fort Aguada, Dudhsagar Waterfalls, Anjuna Flea Market, Palolem Beach, Basilica of Bom Jesus, Chapora Fort, Arambol Beach.
- Review each image's actual Wikimedia attribution/licence through its article; image rights vary.
- Review [data source terms](data-sources.md) before commercial launch: Open-Meteo free tier is non-commercial, and the public OSRM demo is for light use. Production needs suitable provider subscriptions/keys/instances.

## Created files

- `backend/supabase/migrations/20261012000000_place_cache.sql`
- `backend/supabase/migrations/20261012000100_crowd_reports.sql`
- `docs/data-sources.md`
- `docs/seasonal-notes-todo.md`
- `frontend/src/features/explore/components/ConditionsCard.tsx`
- `frontend/src/features/explore/components/CrowdReportCard.tsx`
- `frontend/src/features/explore/components/ExploreSearch.tsx`
- `frontend/src/features/explore/components/GettingThere.tsx`
- `frontend/src/features/explore/components/NearbyPlaceDetails.tsx`
- `frontend/src/features/explore/components/NearbyRecommendations.tsx`
- `frontend/src/features/explore/components/PlaceHero.tsx`
- `frontend/src/features/explore/components/PlaceImage.tsx`
- `frontend/src/features/explore/components/ResultsMap.tsx`
- `frontend/src/features/explore/components/SafetyEssentialsCard.tsx`
- `frontend/src/lib/conditions-advice.ts`
- `frontend/src/lib/conditions.server.ts`
- `frontend/src/lib/conditions.ts`
- `frontend/src/lib/crowd.server.ts`
- `frontend/src/lib/crowd.ts`
- `frontend/src/lib/curated-match.ts`
- `frontend/src/lib/explore-access.server.ts`
- `frontend/src/lib/explore-featured.ts`
- `frontend/src/lib/explore-results.ts`
- `frontend/src/lib/explore-travel.server.ts`
- `frontend/src/lib/opening-hours.ts`
- `frontend/src/lib/place-cache.server.ts`
- `frontend/src/lib/place-names.ts`
- `frontend/src/lib/rate-limiter.server.ts`
- `frontend/src/lib/resolved-centre.ts`
- `frontend/src/lib/wikipedia-match.ts`
- `frontend/src/lib/wikipedia.server.ts`
- `misc/tests/conditions.test.ts`
- `misc/tests/explore-backend.test.ts`
- `misc/tests/explore-core.test.ts`
- `misc/tests/explore-opening-hours.test.ts`
- `misc/tests/explore-travel-crowd.test.ts`
- `misc/tests/explore.test.ts`
- `misc/tests/resolved-centre.test.ts`
- `misc/tests/wikipedia.test.ts`
- `docs/explore-overhaul-report.md`

## Changed files

- `backend/supabase/schema.sql`
- `frontend/src/features/map/lib/opening-hours.ts`
- `frontend/src/integrations/supabase/types.ts`
- `frontend/src/lib/goa-places-data.ts`
- `frontend/src/lib/goa-schemas.ts`
- `frontend/src/lib/goa.functions.ts`
- `frontend/src/lib/maps.server.ts`
- `frontend/src/lib/places.server.ts`
- `frontend/src/lib/travel.server.ts`
- `frontend/src/routes/_authenticated/explore.tsx`
- `frontend/src/routes/_authenticated/itinerary.tsx`
- `misc/scripts/register-typescript.mjs`

The pre-existing uncommitted changes in `frontend/src/components/GoogleTranslate.tsx` remain outside these commits. Its existing formatting errors were normalized to let repository lint pass; its functional changes were preserved.

## Places awaiting seasonal verification

- Chapora Fort
- Fort Aguada & Lighthouse
- Reis Magos Fort
- Basilica of Bom Jesus
- Sé Cathedral
- Cabo de Rama Fort
- Houses of Goa Museum
- Vinayak Family Restaurant
- Gunpowder Assagao
- Ritz Classic Panjim
- The Fisherman's Wharf (Cavelossim)
- Souza Lobo Calangute
- Martin's Corner Betalbatim
- Kokni Kanteen Panjim
- Anjuna Beach & Flea Market Coast
- Vagator & Ozran Beach
- Baga Beach
- Candolim Beach & Dunes
- Palolem Crescent Beach
- Agonda Turtle Beach
- Morjim Beach & Chapora Estuary
- Arambol Beach & Sweet Water Lake
- Curlies Beach Shack & Lounge
- Tito's Lane Baga
- HillTop Vagator
- Cohiba Bar & Kitchen Sinquerim
- Thalassa Siolim
- Dudhsagar Waterfalls
- Dr. Salim Ali Bird Sanctuary
- Bondla Wildlife Sanctuary
- Anjuna Flea Market
- Mapusa Friday Market
- Fontainhas Latin Quarter & Art Shops
- Church of Our Lady of the Immaculate Conception
- Mangueshi Temple Priol
- Shanta Durga Temple Kavlem
- Baga & Calangute Water Sports Hub
- Grand Island Scuba Diving & Snorkeling Point
- Morjim Surf & SUP Club
- Palolem Island Kayaking & Backwaters
