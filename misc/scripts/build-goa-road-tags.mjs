#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const OUTPUT_FILE = path.resolve(ROOT_DIR, "frontend/public/data/goa-road-tags.json");
const CHECKPOINT_FILE = path.resolve(ROOT_DIR, "frontend/public/data/.goa-road-tags-checkpoint.json");

const SOUTH = 14.88;
const NORTH = 15.82;
const WEST = 73.65;
const EAST = 74.35;
const STEP = 0.1;

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const ALLOWED_TAGS = ["highway", "surface", "smoothness", "lit", "maxspeed"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function generateTiles() {
  const tiles = [];
  for (let s = SOUTH; s < NORTH - 0.001; s += STEP) {
    const n = Math.min(s + STEP, NORTH);
    for (let w = WEST; w < EAST - 0.001; w += STEP) {
      const e = Math.min(w + STEP, EAST);
      tiles.push({
        s: Number(s.toFixed(4)),
        w: Number(w.toFixed(4)),
        n: Number(n.toFixed(4)),
        e: Number(e.toFixed(4)),
      });
    }
  }
  return tiles;
}

async function queryTile(tile, tileIndex, totalTiles) {
  const query = `[out:json][timeout:60];way(${tile.s},${tile.w},${tile.n},${tile.e})[highway][highway!~"^(footway|path|steps|cycleway|pedestrian|track|bridleway|corridor|elevator|proposed|construction)$"];out tags qt;`;
  const body = new URLSearchParams({ data: query }).toString();

  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const endpoint of ENDPOINTS) {
      let hostname = endpoint;
      try {
        hostname = new URL(endpoint).hostname;
      } catch {}

      try {
        const timeoutMs = endpoint.includes("maps.mail.ru") ? 25000 : 5000;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "SafrRoadTagsBuilder/1.0 (https://github.com/sameeha1503/Safr)",
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          console.warn(`  [tile ${tileIndex + 1}/${totalTiles}] ${hostname} HTTP ${response.status} (attempt ${attempt}/3)`);
          await sleep(3000);
          continue;
        }

        const json = await response.json();
        if (json.remark) {
          console.warn(`  [tile ${tileIndex + 1}/${totalTiles}] ${hostname} remark: ${json.remark} (attempt ${attempt}/3)`);
          await sleep(3000);
          continue;
        }

        const elements = json.elements || [];
        return { success: true, elements, hostname };
      } catch (err) {
        console.warn(`  [tile ${tileIndex + 1}/${totalTiles}] ${hostname} error: ${err.message || err} (attempt ${attempt}/3)`);
        await sleep(3000);
      }
    }
  }

  return { success: false, elements: [], hostname: "none" };
}

async function main() {
  console.log("=== Building Goa Road Tags Snapshot ===");
  console.log(`Bounds: S=${SOUTH}, W=${WEST}, N=${NORTH}, E=${EAST}, step=${STEP}`);

  const tiles = generateTiles();
  console.log(`Total tiles to process: ${tiles.length}`);

  let waysMap = {};
  let completedTiles = new Set();

  try {
    const rawCheckpoint = await fs.readFile(CHECKPOINT_FILE, "utf8");
    const cp = JSON.parse(rawCheckpoint);
    if (cp && cp.ways && Array.isArray(cp.completedTiles)) {
      waysMap = cp.ways;
      completedTiles = new Set(cp.completedTiles);
      console.log(`Resuming from checkpoint: ${completedTiles.size}/${tiles.length} tiles previously completed.`);
    }
  } catch {
    // No valid checkpoint, start fresh
  }

  const failedTiles = [];

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const tileKey = `${tile.s},${tile.w},${tile.n},${tile.e}`;

    if (completedTiles.has(tileKey)) {
      continue;
    }

    console.log(`[${i + 1}/${tiles.length}] Querying tile (${tile.s}, ${tile.w}, ${tile.n}, ${tile.e})...`);
    const result = await queryTile(tile, i, tiles.length);

    if (!result.success) {
      console.error(`  [tile ${i + 1}/${tiles.length}] PERMANENT FAILURE for tile (${tileKey}) across all endpoints.`);
      failedTiles.push(tileKey);
    } else {
      let addedInTile = 0;
      for (const el of result.elements) {
        if (!el.id || !el.tags) continue;
        const idStr = String(el.id);
        const filteredTags = {};
        for (const tag of ALLOWED_TAGS) {
          if (el.tags[tag] && typeof el.tags[tag] === "string" && el.tags[tag].trim().length > 0) {
            filteredTags[tag] = el.tags[tag].trim();
          }
        }
        if (Object.keys(filteredTags).length > 0) {
          waysMap[idStr] = { ...(waysMap[idStr] || {}), ...filteredTags };
          addedInTile++;
        }
      }
      completedTiles.add(tileKey);
      console.log(`  ✓ Received ${result.elements.length} ways (${addedInTile} valid) from ${result.hostname}. Total unique ways so far: ${Object.keys(waysMap).length}`);

      // Save checkpoint after every tile
      try {
        await fs.writeFile(
          CHECKPOINT_FILE,
          JSON.stringify({ ways: waysMap, completedTiles: Array.from(completedTiles) }),
          "utf8"
        );
      } catch {}
    }

    if (i < tiles.length - 1) {
      await sleep(2000);
    }
  }

  if (failedTiles.length > 0) {
    console.error("\nWarning: The following tiles permanently failed to return data:");
    for (const f of failedTiles) {
      console.error(` - ${f}`);
    }
  }

  const outputData = {
    generatedAt: new Date().toISOString(),
    source: "OpenStreetMap contributors (ODbL) via Overpass",
    ways: waysMap,
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  let jsonStr = JSON.stringify(outputData, null, 2);
  let byteSize = Buffer.byteLength(jsonStr, "utf8");

  console.log(`\nGenerated snapshot raw size: ${(byteSize / (1024 * 1024)).toFixed(2)} MB (${byteSize} bytes)`);

  if (byteSize > 8 * 1024 * 1024) {
    console.log("Snapshot exceeds 8 MB. Dropping minor ways with ONLY highway in {residential, service, unclassified}...");
    const prunedWays = {};
    let droppedCount = 0;

    for (const [id, tags] of Object.entries(waysMap)) {
      const tagKeys = Object.keys(tags);
      if (
        tagKeys.length === 1 &&
        tagKeys[0] === "highway" &&
        ["residential", "service", "unclassified"].includes(tags.highway)
      ) {
        droppedCount++;
        continue;
      }
      prunedWays[id] = tags;
    }

    outputData.ways = prunedWays;
    jsonStr = JSON.stringify(outputData, null, 2);
    byteSize = Buffer.byteLength(jsonStr, "utf8");
    console.log(`Dropped ${droppedCount} ways. New size: ${(byteSize / (1024 * 1024)).toFixed(2)} MB (${byteSize} bytes)`);
  }

  await fs.writeFile(OUTPUT_FILE, jsonStr, "utf8");
  console.log(`Saved snapshot to: ${OUTPUT_FILE}`);

  // Clean up checkpoint
  try {
    await fs.unlink(CHECKPOINT_FILE);
  } catch {}

  // Compute coverage stats
  const finalWays = Object.values(outputData.ways);
  const totalWays = finalWays.length;
  let surfaceCount = 0;
  let smoothnessCount = 0;
  let litCount = 0;
  let maxspeedCount = 0;

  for (const tags of finalWays) {
    if (tags.surface) surfaceCount++;
    if (tags.smoothness) smoothnessCount++;
    if (tags.lit) litCount++;
    if (tags.maxspeed) maxspeedCount++;
  }

  console.log("\n==========================================");
  console.log("=== Goa Road Tags Snapshot Coverage ===");
  console.log("==========================================");
  console.log(`Total ways:     ${totalWays}`);
  console.log(`- surface:      ${surfaceCount} (${totalWays ? ((surfaceCount / totalWays) * 100).toFixed(1) : 0}%)`);
  console.log(`- smoothness:   ${smoothnessCount} (${totalWays ? ((smoothnessCount / totalWays) * 100).toFixed(1) : 0}%)`);
  console.log(`- lit:          ${litCount} (${totalWays ? ((litCount / totalWays) * 100).toFixed(1) : 0}%)`);
  console.log(`- maxspeed:     ${maxspeedCount} (${totalWays ? ((maxspeedCount / totalWays) * 100).toFixed(1) : 0}%)`);
  console.log("==========================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
