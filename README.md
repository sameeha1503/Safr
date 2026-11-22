# Safr

Safr is a travel-safety and trip-planning web app piloted in Goa. It combines maps, route planning, place discovery, itinerary generation, family location sharing, SafeTag QR identification, SOS tools, and a public emergency directory.

## What it includes

- Interactive MapLibre map with multi-stop routing and route alternatives
- Goa place explorer with real photos, weather, sea conditions, opening hours, crowd reports, and bucket lists
- Time-budgeted itinerary planner with deterministic fallback when AI is unavailable
- Reunite live companion tracking, meeting points, invite links, and SOS reporting
- Printable SafeTag QR codes with privacy-preserving guardian alerts
- Offline emergency fallback and verified Goa emergency contacts

Safr does not invent unavailable live data. External services fail softly, and safety guidance is presented as general guidance rather than an official warning.

## Stack

- React 19, TypeScript, TanStack Start/Router and TanStack Query
- Vite 8, Tailwind CSS 4, Radix UI and shadcn/ui
- Supabase Auth, PostgreSQL, Row Level Security and Realtime
- MapLibre GL, OpenStreetMap, Overpass, Photon, Valhalla and OSRM
- Gemini for optional itinerary ranking
- Wikipedia/Wikimedia and Open-Meteo
- Twilio for optional SMS or WhatsApp alerts

## Local setup

Requirements: Node.js 20 or newer and npm.

```bash
git clone https://github.com/Prajj11/Safr-AI.git
cd Safr-AI/frontend
npm install
copy .env.example .env
npm run dev
```

The development server normally opens at `http://localhost:5173`.

On macOS or Linux, replace the `copy` command with:

```bash
cp .env.example .env
```

## Configuration

At minimum, configure these values in `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional services are configured with:

```dotenv
GEMINI_API_KEY=
ROUTING_PROVIDER=valhalla
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
OSRM_BASE_URL=https://router.project-osrm.org
OVERPASS_URL=https://overpass-api.de/api/interpreter
OVERPASS_FALLBACK_URL=https://maps.mail.ru/osm/tools/overpass/api/interpreter
```

Notifications default to safe mock mode. Live delivery additionally needs an approved Twilio sender:

```dotenv
NOTIFY_MODE=mock
NOTIFY_CHANNELS=whatsapp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_SMS_FROM=
```

Never expose the service-role key, Gemini key, or Twilio credentials in browser-prefixed variables, source control, logs, screenshots, or chat.

## Database

Apply `backend/supabase/schema.sql` to a new Supabase project, or apply the migrations in `backend/supabase/migrations/` in order. Existing deployments can use the targeted scripts in `backend/supabase/repairs/`.

After database changes, verify both anonymous access and authenticated cross-account isolation:

```bash
cd frontend
npm run check:rls
npm run check:rls-auth
npm run check:tracking
```

## Development commands

Run commands from `frontend/`:

```bash
npm run dev              # development server
npm run typecheck        # TypeScript validation
npm run lint             # ESLint
npm test                 # unit and integration tests
npm run build            # production build
npm run start            # serve the production build
npm run check:browser    # real-browser emergency/offline smoke test
npm run check:itinerary  # live itinerary fallback check
npm run check:deployment # schema and notification readiness
```

`check:deployment` validates readiness but deliberately does not send an SMS or WhatsApp message.

## Project layout

```text
frontend/   application, server functions and production server
backend/    Supabase schema, migrations, repairs and verification scripts
misc/tests/ automated unit and integration tests
docs/       architecture, data-source and production runbooks
```

Useful references:

- [Production verification](docs/production-verification.md)
- [External data sources](docs/data-sources.md)
- [Remaining service setup](docs/remaining-services-setup.md)
- [Detailed technical documentation](misc/MASTER_PROJECT_DOCUMENTATION.md)

## Production notes

- Use your own production-grade routing and Overpass capacity; public endpoints are suitable only for light use.
- Probe `GET /healthz` and collect the server's structured JSON request logs.
- Test Reunite on two physical phones because mobile browsers may suspend background GPS.
- Keep `NOTIFY_MODE=mock` until Twilio sender and recipient consent requirements are satisfied.
- Apply all database migrations before enabling place caching, crowd reports, saved routes, or Reunite.

## License

MIT — see [misc/LICENSE](misc/LICENSE).
