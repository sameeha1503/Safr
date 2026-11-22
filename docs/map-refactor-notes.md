# Map Refactor Notes & Reconnaissance

## 1. Behaviour Checklist of `/map` Today

This checklist documents every existing user-facing and background behavior in `frontend/src/routes/_authenticated/map.tsx`. It serves as the baseline to ensure zero regression across the refactoring phases.

### A. Place & Destination Search
- [ ] **Autocomplete & Search Input**: Typing queries (min 2 chars) queries `searchPlaces` server function (`maps.server.ts` -> Photon / Goa places). Debounced / triggered via form submission.
- [ ] **Hit selection**: Clicking a result sets `destination`, clears search hits, saves to recent searches, flies map to destination or fits bounds to route, and calculates current route.
- [ ] **Empty / Error states**: Displays sonner toast ("No matching places found in Goa." or error message).

### B. Quick Destinations & Recent Searches
- [ ] **Quick Destination Chips**: Predefined popular spots (Baga Beach, Fort Aguada, Palolem Beach, Dudhsagar Falls, Panjim Church) with coordinates and addresses. Clicking sets destination and triggers routing.
- [ ] **Recent Searches**: Persisted in `localStorage` key `safr_recent_destinations` (max 5 items). Deduplicated by name case-insensitively. Clicking a recent destination triggers routing.

### C. Origin Picker & Location Management
- [ ] **Default Origin**: Falls back to Panjim (`{ lat: 15.4989, lng: 73.8278, name: "Panjim" }`) if no GPS or cached origin.
- [ ] **Cached Origin**: Reads `localStorage` key `safr_last_origin` on mount (`{ coords, label, isGps }`).
- [ ] **GPS Origin (`requestUserLocation`)**:
  - Checks `navigator.geolocation`.
  - Attempts high accuracy with 6s timeout; falls back to low accuracy with 8s timeout on timeout.
  - Reverse-geocodes origin using `getCurrentArea` to get human-readable Goa neighborhood name.
  - Caches to `localStorage` key `safr_last_origin`.
  - Sets `isGpsOrigin = true` (pulsing emerald indicator).
  - Triggers route calculation if destination already exists.
- [ ] **Manual Origin Search**: Modal/search input allowing search for starting location via `searchPlaces`. Selecting updates starting point, resets `isGpsOrigin = false`, and triggers routing.

### D. Multi-Stop Waypoints (Up to 5)
- [ ] **Add Stop Search**: Input to search and append intermediate waypoints (`waypoints` array, max 5).
- [ ] **Numbered Stop Markers**: Numbered markers (1 to 5) rendered with popups displaying stop index and name.
- [ ] **Reorder / Remove Stops**: Up/down movement to reorder stops, delete button to remove stop.
- [ ] **Auto-Recalculate**: Modifying waypoints recalculates routes with updated waypoint array.

### E. Travel Modes
- [ ] **Modes**: `car`, `motor_scooter`, `bicycle`, `walking`.
- [ ] **Routing Config Integration**: Queries `getRoutingConfig` (queryKey `["routing-config"]`). If routing provider is OSRM, restricts active mode to `car`; if Valhalla, enables all four modes.
- [ ] **Mode Switching**: Updates `travelMode` state and triggers route recalculation.

### F. Departure Time & Night Mode
- [ ] **Departure Mode**: `Leave Now` vs `Leave At` (custom time picker, e.g., "19:00").
- [ ] **Goa Night Calculation (`isGoaNight`)**: Time before 06:30 or after 18:45 is considered night. Uses Asia/Kolkata timezone.
- [ ] **Night Safety Flag**: Passes `isNight` boolean to `getRoutes` server function for safety scoring penalties on unlit roads.

### G. Route Comparison & Scoring
- [ ] **Route Evaluation**: Evaluates up to multiple routes returned by routing provider.
- [ ] **Comparison Cards**:
  - Fastest route (`isFastest`).
  - Shortest route (`isShortest`).
  - Safest route estimate (`isSafest`).
  - Unified card when Fastest & Shortest coincide.
- [ ] **Safety Scores**: Displays safety rating, road lighting notes, surface conditions, police/hospital proximity alerts.

### H. Turn-by-Turn Directions & Active Step Marker
- [ ] **Step List**: Expandable sheet with step-by-step maneuvers, distances, street names, and maneuver icons (`getManeuverIcon`).
- [ ] **Step Clicking (`handleStepClick`)**:
  - Flies map to step coordinate (`zoom: 15`).
  - Renders temporary numbered step marker (`stepMarkerSvg`) with popup instruction.
  - Splits selected route polyline into "traveled" (dashed muted gray) and "remaining" (solid colored).

### I. Share & Save Route
- [ ] **Share Route (`handleShareRoute`)**: Copies URL with search params (`dest`, `lat`, `lng`, `origin`, `originLat`, `originLng`, `stops`).
- [ ] **Save Route (`handleSaveRoute`)**: Saves route to Supabase table `saved_routes` with `name`, `mode`, `origin`, `destination`, `waypoints`. Refetches `["saved-routes"]`.

### J. Saved Places Layer (Bucket List)
- [ ] **Query**: Queries Supabase table `saved_places` using react-query key `["saved-places"]`.
- [ ] **Clustered GeoJSON Source**: Source id `safr-saved-places-src` with clustering enabled (`clusterRadius: 40`, `clusterMaxZoom: 14`).
- [ ] **Cluster Layers**: `safr-saved-clusters` (teal circles sized by point count), `safr-saved-cluster-count` (point count symbol text). Clicking zooms into cluster expansion.
- [ ] **Unclustered Points Layer**: `safr-saved-points` (dark teal circle).
- [ ] **Point Popup**: Clicking an unclustered point opens popup with place name, category, and action buttons:
  - "📍 Set as destination"
  - "➕ Add as stop" (enforces max 5 waypoints limit)
- [ ] **Toggle Visibility**: Toggle switch to show/hide saved places layer on map.

### K. Map Controls & Navigation
- [ ] **NavigationControl**: Compass and zoom controls in `top-right`.
- [ ] **FullscreenControl**: In `top-right`.
- [ ] **GeolocateControl** (to be replaced by custom live location marker + RecenterButton in Phase 1).
- [ ] **Style Switcher**: Custom control in `top-left` supporting Streets, Light, Dark, Satellite, Standard OSM.
- [ ] **3D Toggle**: Toggles 3D pitch (60° vs 0°), 3D building extrusions (`safr-3d-buildings`), and AWS Terrarium DEM terrain hillshade (`safr-hillshade`).
- [ ] **Reset View Button (⌂)**: Flies back to route bounds or default Goa center (`GOA_CENTER`).
- [ ] **Fit Bounds (`fitMapToRoute`)**: Computes `LngLatBounds` enclosing origin, all waypoints, destination, and polyline coordinates with 48px padding.

### L. Resilience & Error Handling
- [ ] **Style Timeout & Fallback**: 12-second timeout on style initialization; falls back to standard OpenStreetMap raster tiles (`OSM_RASTER_STYLE`) if vector tiles fail to load.
- [ ] **Retry Button (`handleRetryMap`)**: Visible when `mapLoadError` is true, falls back to OSM raster style.
- [ ] **Non-fatal Resource Errors**: Listens to map `error` event and logs warnings without crashing the UI.

### M. URL Search Parameters
- [ ] Supported search parameters validated by Route:
  - `dest`: string
  - `lat`: string (latitude)
  - `lng`: string (longitude)
  - `origin`: string (origin name)
  - `originLat`: string
  - `originLng`: string
  - `stops`: JSON array string of `[{ lat, lng, name }]`
- [ ] Auto-restores route and triggers search on page load.

---

## 2. Streets Style Runtime Symbol Layers Inspection

The Streets style is defined by `VITE_MAP_STYLE_STREETS` (defaulting to OpenFreeMap Liberty style: `https://tiles.openfreemap.org/styles/liberty`).

Inspection of `map.getStyle().layers` filtered to `type === "symbol"`:

| Layer ID | Source Layer | Description / Purpose |
|---|---|---|
| `road_one_way_arrow` | `transportation` | One-way traffic arrows |
| `road_one_way_arrow_opposite` | `transportation` | Opposite one-way traffic arrows |
| `waterway_line_label` | `waterway` | River, canal, stream labels |
| `water_name_point_label` | `water_name` | Lake, bay, water body point labels |
| `water_name_line_label` | `water_name` | Linear water body labels |
| `poi_r20` | `poi` | Points of interest (low zoom rank 20) |
| `poi_r7` | `poi` | Points of interest (mid zoom rank 7) |
| `poi_r1` | `poi` | Points of interest (high zoom rank 1) |
| `poi_transit` | `poi` | Transit stations, bus stops, ferry terminals |
| `highway-name-path` | `transportation_name` | Footpath, cycleway, track names |
| `highway-name-minor` | `transportation_name` | Residential, service, unclassified road names |
| `highway-name-major` | `transportation_name` | Motorway, trunk, primary, secondary road names |
| `highway-shield-non-us` | `transportation_name` | International / Indian highway shields |
| `highway-shield-us-interstate` | `transportation_name` | Interstate shields |
| `road_shield_us` | `transportation_name` | US highway shields |
| `airport` | `aerodrome_label` | Airport and aerodrome icons and labels |
| `label_other` | `place` | Hamlets, suburbs, neighbourhoods, isolated dwellings |
| `label_village` | `place` | Village labels |
| `label_town` | `place` | Town labels |
| `label_state` | `place` | State/province labels |
| `label_city` | `place` | City labels |
| `label_city_capital` | `place` | Capital city labels |
| `label_country_3` | `place` | Small country labels |
| `label_country_2` | `place` | Medium country labels |
| `label_country_1` | `place` | Large country labels |

### Key Observations for Clickable Map Places (Phase 2):
1. **Interactive POI Layers**:
   - `poi_r20`, `poi_r7`, `poi_r1`, and `poi_transit` all share `source-layer: "poi"`.
   - `airport` uses `source-layer: "aerodrome_label"`.
   - `label_other`, `label_village`, `label_town`, `label_city` use `source-layer: "place"`.
2. **First Symbol Layer for Insertion**:
   - The first symbol layer in the style is `road_one_way_arrow`.
   - Any custom layers (like 3D buildings and hillshade) are placed below this layer so road text and POI icons stay on top.
