import type { ScoredRoute } from "@/lib/maps.server";
import { EMERGENCY_CONTACTS } from "../../../lib/emergency-contacts";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

/** A self-contained, script-free document; no external tiles or remote assets. */
export function createOfflineTrip(route: ScoredRoute, savedAt: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Safr offline trip</title><style>body{font:18px system-ui;max-width:760px;margin:auto;padding:24px;color:#17251f;background:#fff}li{margin:18px 0}a{color:#07543c}small{display:block;color:#46534c}</style><h1>Safr offline trip</h1><p>${escape(route.summary || route.label)}</p><p>${escape(route.mode || "car")} · ${route.distanceKm.toFixed(1)} km · about ${Math.ceil(route.durationMin)} min</p><p>Saved ${escape(savedAt)}. This is a static route reference. Conditions may have changed. Live navigation, rerouting and map tiles require a connection.</p><h2>Directions</h2><ol>${route.steps.map((step) => `<li>${escape(step.instruction)}<small>${Math.round(step.distanceMeters)} m${step.location ? ` · ${step.location[0].toFixed(5)}, ${step.location[1].toFixed(5)}` : ""}</small></li>`).join("")}</ol><h2>Emergency contacts</h2><ul>${EMERGENCY_CONTACTS.map((contact) => `<li>${escape(contact.name)}: <a href="tel:${escape(contact.phone)}">${escape(contact.phone)}</a></li>`).join("")}</ul><p>Keep this downloaded file private if it reveals your travel plans. Delete it when no longer needed.</p></html>`;
}
