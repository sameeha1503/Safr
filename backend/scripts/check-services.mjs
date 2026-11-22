// Read-only connectivity checks. Never print credentials or raw provider responses.
process.loadEnvFile();
const checks = [
  ["Photon geocoding", "https://photon.komoot.io/api/?q=Panjim%20Goa%20India&limit=2"],
  [
    "OSRM road matrix",
    `${process.env.OSRM_BASE_URL || "https://router.project-osrm.org"}/table/v1/driving/73.8278,15.4989;73.7517,15.5553?annotations=duration,distance`,
  ],
  [
    "Supabase connection",
    `${process.env.VITE_SUPABASE_URL}/auth/v1/settings`,
    { headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "" } },
  ],
];
if (process.env.GEMINI_API_KEY)
  checks.push([
    "Gemini model access",
    "https://generativelanguage.googleapis.com/v1beta/models",
    { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY } },
  ]);
for (const [name, url, init] of checks) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    console.log(`${name}: HTTP ${response.status}${body.code ? ` (${body.code})` : ""}`);
    if (name === "Gemini model access" && response.ok)
      console.log(
        `Configured model available: ${Boolean(body.models?.some((m) => m.name === `models/${process.env.GEMINI_MODEL || "gemini-2.5-flash"}`))}`,
      );
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.log(`${name}: ${error.cause?.code || error.name}`);
    process.exitCode = 1;
  }
}

if (process.argv.includes("--generate") && process.env.GEMINI_API_KEY) {
  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return JSON: {"ok":true}' }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const result = await response.json();
    console.log(
      `Gemini generation: HTTP ${response.status}; ${result.error?.status || "response received"}; output present: ${Boolean(result.candidates?.[0]?.content)}`,
    );
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.log(`Gemini generation: ${error.name}`);
    process.exitCode = 1;
  }
}
