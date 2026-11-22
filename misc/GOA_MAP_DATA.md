# Goa map and place catalogue

The `/map` page uses MapLibre with OpenFreeMap vector streets by default, with the existing OSM raster fallback. Basemap roads, buildings and labels are streamed from the tile provider; they are not downloaded into this repository. Satellite and routing continue to use their existing providers.

The Discover Goa panel reads `/data/goa-places.json`, an independently refreshable OpenStreetMap snapshot. It supports category filters, name/location/cuisine search, clustered map markers, keyboard-accessible result buttons, and the existing place cards, bookmarks and route stops. The same discovery markers work on raster styles. Stored details are displayed without a new Overpass request.

## Refresh the place data

From the repository root, run `node backend/scripts/refresh-goa-map.mjs`. Set `OVERPASS_URL` to a suitable Overpass interpreter endpoint if required. This is a maintenance command, not a request to run on every page view. Public query services may be unavailable or overloaded; use a suitable hosted service for production maintenance. Failed or partial responses leave the prior snapshot untouched. Deploy the refreshed JSON with the frontend.

The importer selects named tourism, amenity, shopping, historic, natural, leisure and transport features inside the Goa administrative area (`ISO3166-2=IN-GA`). It retains OSM type/ID, coordinates, selected public tags, fetch time and upstream data timestamp. Ways and relations use bounding-box centres, which are approximate locations rather than verified entrances. OSM can contain duplicate representations of a business; type/ID identity is preserved rather than guessing which record is correct.

## Attribution and limits

The catalogue is © OpenStreetMap contributors, licensed under ODbL 1.0: https://www.openstreetmap.org/copyright. Keep its attribution and licence when redistributing. The supplied JSON is the downloadable derived database. Provider attributions remain visible on the map.

This is not Google's database and not a verified complete business directory. Unnamed and unmapped places, reviews, photos, live traffic, and live opening status are not supplied by this snapshot. Business information may be missing or outdated. The basemap and routing still require network access. Do not claim full offline navigation or complete Google Maps parity.
