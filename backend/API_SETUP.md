# API configuration

The existing **Gemini key passed a real generation request** and a complete itinerary test. A new key is not currently necessary. **OSRM, Overpass, Photon and the public development Open-Meteo endpoint do not require API keys.** Supabase project `<your-project-id>` is connected and active.

| Service | Variables | Where to obtain them |
| --- | --- | --- |
| Gemini | `GEMINI_API_KEY` (server only), optional `GEMINI_MODEL` | [Google AI Studio](https://aistudio.google.com/apikey); [key documentation](https://ai.google.dev/gemini-api/docs/api-key) |
| Supabase browser | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing project dashboard → project connection/API settings |
| Supabase server authentication | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Same project URL and publishable key as above |
| OSRM | Optional `OSRM_BASE_URL` | Default: `https://router.project-osrm.org`; no key |
| Nearby places | Optional `OVERPASS_URL` | Default: `https://overpass-api.de/api/interpreter`; no key |
| Place search/current area | None | Photon public service; no key |
| Weather | None | Open-Meteo public service used by the Panjim weather widget |

Use `.env.example` as a reference. Do not overwrite an existing `.env` with placeholders. The local `.env` remains present and is now untracked/ignored. Set these variables in your hosting environment when deploying; a production Node process does not automatically read Vite's development `.env` file.

Never use a `VITE_` prefix for the Gemini key or a Supabase secret/service-role key. Browser Supabase connections use only the publishable key with row-level security enabled. None of these changes needs a service-role key.

The repository previously tracked `.env`. Removing it from tracking does not erase Git history; rotate any secret that has already been pushed or distributed. This update does not rewrite repository history or rotate account credentials.

Public map endpoints are suitable for development, with caching and bounded requests. For production, check the provider's usage terms and provision your own or a hosted routing/place service. OSRM gives road estimates, not live-traffic predictions. A separate live crowd or lifeguard data source would be needed before those values could be shown.
