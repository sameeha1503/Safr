# 🛡️ Safr — Backend & Database Services

This folder contains all backend infrastructure, database schemas, and server runtimes for the **Safr** travel safety platform.

---

## 📁 Directory Structure

```
backend/
├── supabase/                      # PostgreSQL database layer
│   ├── migrations/                # Database migrations (including phone number schema)
│   └── schema.sql                 # Consolidated production database schema & RLS policies
├── scripts/                       # Backend validation & verification scripts
│   ├── check-services.mjs         # Connectivity tester for Gemini, Supabase, OSRM, Photon
│   ├── check-rls.mjs              # Row-Level Security verification script
│   └── check-itinerary.mjs        # Itinerary generator verification
├── server.mjs                     # Production Node.js SSR server with CSP & security headers
└── API_SETUP.md                   # API keys configuration guide (Gemini, Supabase, OSRM)
```

---

## 🚀 Key Responsibilities

1. **Database & Auth (Supabase / PostgreSQL)**:
   - User authentication via Supabase Auth.
   - Row-Level Security (RLS) guaranteeing strict data segregation.
   - Core tables: `trips`, `travel_buddies`, `emergency_contacts`, `saved_places`, `feedback`.
   - Migration history preserved in `supabase/migrations/`.

2. **Server Runtime (`server.mjs`)**:
   - Compatibility entry point importing `../frontend/server.mjs`, the single production HTTP/SSR implementation.
   - Hardened Content-Security-Policy (CSP) allowing Google Translate, OpenStreetMap tiles, and Supabase WebSockets.

3. **External Services & Integrations (`API_SETUP.md`)**:
   - Google Gemini 2.5 Flash for itinerary ranking.
   - OSRM (Open Source Routing Machine) for road distance matrices.
   - Photon & Overpass for geocoding and 1.5 km corridor point-of-interest discovery.

---

## 🗄️ Database Migrations

Database migrations are stored sequentially in `supabase/migrations/`.
To apply migrations to your Supabase project:

1. **Via Supabase CLI**:
   ```bash
   npx supabase db push
   ```
2. **Via Supabase Dashboard**:
   Copy and execute the contents of the latest migration SQL file (e.g. `supabase/migrations/20261001210000_bucket_list_and_saved_routes.sql`) in the **SQL Editor** tab of your Supabase dashboard.
   The migration is idempotent (`IF NOT EXISTS` / deduplication before index creation) and safe to run on existing deployments.

