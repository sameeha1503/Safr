<div align="center">

# Safr

**A travel-safety and trip-planning companion for Goa.**

Maps · Routing · Itineraries · Live Location Sharing · SOS · Emergency Directory

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](misc/LICENSE)
[![Node](https://img.shields.io/badge/node-24.x-339933?logo=node.js&logoColor=white)](frontend/package.json)
[![Built with TanStack Start](https://img.shields.io/badge/built%20with-TanStack%20Start-FF4154?logo=react&logoColor=white)](https://tanstack.com/start)
[![Supabase](https://img.shields.io/badge/backend-Supabase-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

Safr helps travelers in Goa move around with more confidence — not by guessing at danger, but by combining real mapped data, community reporting, and honest uncertainty. When the app doesn't have enough information to call a route "safer," it says so instead of making something up.

## ✨ What it does

| | |
|---|---|
| 🗺️ **Interactive routing** | MapLibre-powered map with multi-stop routing, route alternatives, and turn-by-turn directions |
| 🧭 **Place explorer** | Real photos, weather, sea conditions, opening hours, crowd levels, and a personal bucket list for Goa's spots |
| 🗓️ **Itinerary planner** | Time-budgeted trip planning with a deterministic fallback so it still works if the AI ranking step is unavailable |
| 👪 **Reunite** | Live companion location sharing, meeting points, consent-based invite links, and family tracking |
| 🆘 **SOS** | Hold-to-activate panic button that shares your location and alerts your guardian instantly |
| 🏷️ **SafeTag** | Printable QR codes that let anyone alert your registered guardian with one scan — no app required on their end |
| 📞 **Emergency directory** | Verified Goa emergency contacts, available offline |
| 🛣️ **Road condition reports** | Community-reported closures, flooding, roadworks, and obstructions, plus informational traveler safety reviews |

Safr never invents data it doesn't have. External services fail softly, and anything safety-related is presented as general guidance — never as an official warning.

## 🧱 Tech stack

- **Frontend:** React 19, TypeScript, TanStack Start/Router, TanStack Query, Vite 8, Tailwind CSS 4, Radix UI, shadcn/ui
- **Backend:** Supabase (Auth, PostgreSQL, Row Level Security, Realtime)
- **Maps & routing:** MapLibre GL, OpenStreetMap, Overpass, Photon, Valhalla, OSRM
- **AI:** Gemini (optional itinerary ranking)
- **Data:** Wikipedia/Wikimedia, Open-Meteo
- **Alerts:** Twilio (SMS / WhatsApp)

## 🚀 Quick start

**Requirements:** Node.js 20+ and npm.

```bash
git clone https://github.com/sameeha1503/Safr.git
cd Safr/frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

The dev server opens at `http://localhost:5173`.

## ⚙️ Configuration

At minimum, set these in `frontend/.env`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional services:

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

> ⚠️ **Never** commit the service-role key, Gemini key, or Twilio credentials, or expose them in browser-prefixed (`VITE_`) variables, logs, screenshots, or chat.

## 🗄️ Database

Apply `backend/supabase/schema.sql` to a fresh Supabase project, or run the migrations in `backend/supabase/migrations/` in order. Existing deployments can use the targeted scripts in `backend/supabase/repairs/`.

After any database change, verify access control:

```bash
cd frontend
npm run check:rls
npm run check:rls-auth
npm run check:tracking
```

## 🛠️ Development commands

Run from `frontend/`:

```bash
npm run dev              # development server
npm run typecheck        # TypeScript validation
npm run lint              # ESLint
npm test                  # unit and integration tests
npm run build             # production build
npm run start              # serve the production build
npm run check:browser     # real-browser emergency/offline smoke test
npm run check:itinerary   # live itinerary fallback check
npm run check:deployment  # schema and notification readiness
```

`check:deployment` validates readiness but deliberately does not send a real SMS or WhatsApp message.

## 📁 Project layout

```text
frontend/    application, server functions, and production server
backend/     Supabase schema, migrations, repairs, and verification scripts
misc/tests/  automated unit and integration tests
docs/        architecture, data-source, and production runbooks
```

**References:**
- [Production verification](docs/production-verification.md)
- [External data sources](docs/data-sources.md)
- [Remaining service setup](docs/remaining-services-setup.md)
- [Detailed technical documentation](misc/MASTER_PROJECT_DOCUMENTATION.md)

## 📌 Production notes

- Use your own production-grade routing and Overpass capacity — public endpoints are suitable only for light use.
- Probe `GET /healthz` and collect the server's structured JSON request logs.
- Test Reunite on two physical phones, since mobile browsers may suspend background GPS.
- Keep `NOTIFY_MODE=mock` until Twilio sender and recipient consent requirements are satisfied.
- Apply all database migrations before enabling place caching, crowd reports, saved routes, or Reunite.

## 👥 Team

Built by **Team KoPS Squad** — Kaitlyn Fernandes, Sameeha Modak & Prajwal Naik.

## 📄 License

MIT — see [misc/LICENSE](misc/LICENSE).
