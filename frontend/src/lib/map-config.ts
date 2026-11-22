/**
 * Map configuration for MapLibre GL maps in Safr.
 *
 * Tile sources:
 *   Streets / Light / Dark — OpenFreeMap (https://openfreemap.org)
 *     License: free for all uses, no API key required.
 *     Attribution: "© OpenFreeMap © OpenMapTiles © OpenStreetMap"
 *
 *   Satellite — Esri World Imagery (https://server.arcgisonline.com)
 *     Free for non-commercial display with attribution.
 *     Attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community"
 *
 *   Terrain DEM — AWS Terrain Tiles (public dataset, terrarium encoding)
 *     https://registry.opendata.aws/terrain-tiles/
 *     Free under Creative Commons Attribution 4.0.
 */

import type {
  StyleSpecification,
  Map as MapLibreMap,
  LngLatBoundsLike,
} from "maplibre-gl";

// ---------------------------------------------------------------------------
// Style definitions
// ---------------------------------------------------------------------------

export interface MapStyleEntry {
  id: string;
  label: string;
  icon: string; // emoji
  /** URL string → fetched remotely; StyleSpecification object → inline */
  style: string | StyleSpecification;
  isVector: boolean;
}

const streetsUrl =
  (typeof import.meta !== "undefined"
    ? import.meta.env?.["VITE_MAP_STYLE_STREETS"]
    : undefined) || "https://tiles.openfreemap.org/styles/liberty";

const lightUrl =
  (typeof import.meta !== "undefined"
    ? import.meta.env?.["VITE_MAP_STYLE_LIGHT"]
    : undefined) || "https://tiles.openfreemap.org/styles/positron";

const darkUrl =
  (typeof import.meta !== "undefined"
    ? import.meta.env?.["VITE_MAP_STYLE_DARK"]
    : undefined) || "https://tiles.openfreemap.org/styles/dark";

export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-tiles-layer",
      type: "raster",
      source: "osm-tiles",
    },
  ],
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
    },
  ],
};

export const MAP_STYLES: MapStyleEntry[] = [
  {
    id: "streets",
    label: "Streets",
    icon: "🗺️",
    style: streetsUrl,
    isVector: true,
  },
  { id: "light", label: "Light", icon: "☀️", style: lightUrl, isVector: true },
  { id: "dark", label: "Dark", icon: "🌙", style: darkUrl, isVector: true },
  {
    id: "satellite",
    label: "Satellite",
    icon: "🛰️",
    style: SATELLITE_STYLE,
    isVector: false,
  },
  {
    id: "osm",
    label: "Standard",
    icon: "🌍",
    style: OSM_RASTER_STYLE,
    isVector: false,
  },
];

/** Interactive vector streets; the map instance falls back to raster on failure. */
export function getDefaultStyleId(): string {
  return "streets";
}

// ---------------------------------------------------------------------------
// Goa bounds & center
// ---------------------------------------------------------------------------

export const GOA_CENTER: [number, number] = [73.8278, 15.4989]; // [lng, lat]
export const GOA_BOUNDS: LngLatBoundsLike = [
  [73.3, 14.6],
  [74.6, 15.95],
];

// ---------------------------------------------------------------------------
// Terrain configuration
// ---------------------------------------------------------------------------

export const ENABLE_TERRAIN = true;

const TERRAIN_SOURCE_ID = "safr-terrain-dem";
const TERRAIN_TILES_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

// ---------------------------------------------------------------------------
// addCustomLayers — re-adds all custom sources & layers after a style change
// ---------------------------------------------------------------------------

/**
 * Re-add 3D buildings, terrain/hillshade, and the route-arrow image.
 * Safe to call even if the current style lacks the expected source-layers.
 * `routeData` is called to get the current GeoJSON sources and layers to re-add.
 */
export function addCustomLayers(
  map: MapLibreMap,
  opts: {
    is3d: boolean;
    isVector: boolean;
    routeDataFn?: () => void;
  },
): void {
  if (!map.isStyleLoaded()) {
    map.once("idle", () => {
      addCustomLayers(map, opts);
    });
    return;
  }

  const style = map.getStyle();
  if (!style) return;

  // Find first symbol layer to insert 3D buildings and hillshade below labels
  let firstSymbolId: string | undefined;
  if (style.layers) {
    for (const layer of style.layers) {
      if (layer.type === "symbol") {
        firstSymbolId = layer.id;
        break;
      }
    }
  }

  // 1) 3D buildings (only on vector styles that have a vector source)
  if (opts.isVector) {
    try {
      let vectorSourceName: string | undefined;
      if (style.sources) {
        for (const [sourceName, sourceDef] of Object.entries(style.sources)) {
          if (sourceDef && (sourceDef as { type?: string }).type === "vector") {
            vectorSourceName = sourceName;
            break;
          }
        }
      }

      if (vectorSourceName && !map.getLayer("safr-3d-buildings")) {
        map.addLayer(
          {
            id: "safr-3d-buildings",
            type: "fill-extrusion",
            source: vectorSourceName,
            "source-layer": "building",
            minzoom: 15,
            paint: {
              "fill-extrusion-color": "hsl(35, 12%, 82%)",
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                ["get", "height"],
                5,
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                0,
              ],
              "fill-extrusion-opacity": 0.8,
            },
          },
          firstSymbolId,
        );
      }
    } catch {
      // source-layer or source doesn't exist in this style — skip silently
    }
  }

  // 2) Terrain DEM + hillshade (only added and active when 3D is toggled on)
  if (ENABLE_TERRAIN) {
    try {
      if (opts.is3d) {
        if (!map.getSource(TERRAIN_SOURCE_ID)) {
          map.addSource(TERRAIN_SOURCE_ID, {
            type: "raster-dem",
            tiles: [TERRAIN_TILES_URL],
            tileSize: 256,
            encoding: "terrarium",
            maxzoom: 15,
          });
        }

        if (!map.getLayer("safr-hillshade")) {
          map.addLayer(
            {
              id: "safr-hillshade",
              type: "hillshade",
              source: TERRAIN_SOURCE_ID,
              paint: {
                "hillshade-exaggeration": 0.35,
                "hillshade-shadow-color": "hsl(39, 21%, 33%)",
                "hillshade-illumination-direction": 315,
              },
            },
            firstSymbolId,
          );
        } else {
          map.setLayoutProperty("safr-hillshade", "visibility", "visible");
        }
        map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.2 });
      } else {
        if (map.getLayer("safr-hillshade")) {
          map.setLayoutProperty("safr-hillshade", "visibility", "none");
        }
        if (map.getTerrain()) {
          map.setTerrain(null);
        }
      }
    } catch {
      // DEM tiles unavailable — skip terrain silently
    }
  }

  // 3) Route arrow image
  addArrowImage(map);

  // 4) Re-add route data if present
  opts.routeDataFn?.();
}

// ---------------------------------------------------------------------------
// Arrow image for route direction symbols (canvas-generated, no font glyph)
// ---------------------------------------------------------------------------

export function addArrowImage(map: MapLibreMap): void {
  if (map.hasImage("safr-route-arrow")) return;
  const size = 20;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Triangle pointing right →
  ctx.moveTo(4, 4);
  ctx.lineTo(16, 10);
  ctx.lineTo(4, 16);
  ctx.lineTo(7, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const imgData = ctx.getImageData(0, 0, size, size);
  map.addImage("safr-route-arrow", imgData, { sdf: false });
}

// ---------------------------------------------------------------------------
// SVG marker constants (no user data, safe inline strings)
// ---------------------------------------------------------------------------

/** Pulsing teal dot with white ring — origin / user location */
export const ORIGIN_MARKER_SVG = `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
  <span style="position:absolute;width:100%;height:100%;border-radius:50%;background:#14b8a6;opacity:0.4;animation:safr-pulse 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
  <span style="position:relative;width:16px;height:16px;border-radius:50%;background:#14b8a6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></span>
</div>`;

/** Teardrop pin in coral with white inner circle — destination */
export const DESTINATION_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
  <defs>
    <filter id="ds" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="#f97316" filter="url(#ds)"/>
  <circle cx="15" cy="14" r="6" fill="white"/>
</svg>`;

/** Step marker: numbered circle */
export function stepMarkerSvg(n: number): string {
  return `<div style="background:#0f766e;color:white;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;">${n}</div>`;
}

// ---------------------------------------------------------------------------
// CSS keyframes injection (runs once)
// ---------------------------------------------------------------------------

let cssInjected = false;
export function injectMapCSS(): void {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes safr-pulse {
      0% { transform: scale(1); opacity: 0.4; }
      70% { transform: scale(2.2); opacity: 0; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    .safr-style-switcher {
      display: flex;
      gap: 2px;
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(8px);
      border-radius: 10px;
      padding: 3px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      border: 1px solid rgba(0,0,0,0.08);
    }
    @media (prefers-color-scheme: dark) {
      .safr-style-switcher {
        background: rgba(30,30,30,0.92);
        border-color: rgba(255,255,255,0.1);
      }
    }
    .safr-style-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.15s, transform 0.1s;
      padding: 0;
    }
    .safr-style-btn:hover { background: rgba(0,0,0,0.06); }
    .safr-style-btn[aria-pressed="true"] {
      background: rgba(20,184,166,0.18);
      box-shadow: 0 0 0 2px rgba(20,184,166,0.3);
    }
    @media (prefers-color-scheme: dark) {
      .safr-style-btn:hover { background: rgba(255,255,255,0.1); }
    }
    .safr-map-ctrl-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 8px;
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(8px);
      cursor: pointer;
      font-size: 15px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      border: 1px solid rgba(0,0,0,0.08);
      transition: background 0.15s, transform 0.1s;
      color: #333;
    }
    .safr-map-ctrl-btn:hover { background: rgba(240,240,240,0.95); transform: scale(1.05); }
    .safr-map-ctrl-btn[aria-pressed="true"] {
      background: rgba(20,184,166,0.18);
      color: #0d9488;
    }
    @media (prefers-color-scheme: dark) {
      .safr-map-ctrl-btn {
        background: rgba(30,30,30,0.92);
        border-color: rgba(255,255,255,0.1);
        color: #ddd;
      }
      .safr-map-ctrl-btn:hover { background: rgba(50,50,50,0.95); }
    }
    .maplibregl-ctrl-group { border-radius: 10px !important; overflow: hidden; }
    .maplibregl-ctrl-group button { border-radius: 0 !important; }
  `;
  document.head.appendChild(style);
}
