# Explore data sources and production use

All requests from the Explore backend use a User-Agent and timeouts of at most six seconds. Tests mock fetch and use response fixtures. Missing optional data is omitted; this app does not certify operating status, swimming safety or access.

| Source | Purpose | Usage terms and production considerations |
| --- | --- | --- |
| [Photon](https://photon.komoot.io/) / [project](https://github.com/komoot/photon) | Resolve place coordinates and search suggestions | OSM-derived results require OSM attribution. The public demonstration service has no availability guarantee; host an instance or arrange production geocoding capacity. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | Nearby places and essentials | ODbL, attribute OpenStreetMap contributors and meet applicable database share-alike requirements. Public instances have their own resource limits; cache requests and use an appropriate production instance. |
| [OSRM](https://project-osrm.org/) / [demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy) | Driving distance/time estimates | The public demo server is for light use, with no production SLA. Production needs its own instance or suitable hosted service. Driving profiles do not include live traffic or guarantee accessibility. |
| [Wikipedia / Wikimedia Commons](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use) / [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette) | Matched descriptions, article thumbnails and place-photo fallback search | Attribute and link to Wikipedia text under CC BY-SA 4.0. Image rights vary, so every Commons fallback links directly to its file page for the applicable creator, attribution and licence. A text licence is not a claim that every image has that same licence. Send a descriptive User-Agent and cache results. |
| [Open-Meteo forecast and marine](https://open-meteo.com/en/terms) | Weather and modelled sea conditions | The free API tier is for non-commercial use. Commercial production needs the appropriate subscription/key/endpoint. Attribute Open-Meteo and check upstream data licences. Forecast sea values are not official lifeguard flags. |
| [OpenFreeMap](https://openfreemap.org/) | Vector basemap | Preserve OpenFreeMap, OpenMapTiles and OSM attribution supplied by the style. |

No new environment variables are required by these changes. Existing optional `OVERPASS_URL` and `OSRM_BASE_URL` select hosted instances. Persistent caching and crowd aggregation use the application's existing Supabase service-role configuration; without it, optional cache reads miss and crowd services report unavailable.

The two SQL migrations must be applied manually to the intended Supabase environment. Neither migration is applied by the app or test suite.
