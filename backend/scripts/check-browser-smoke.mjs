import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const frontendDir = path.resolve(import.meta.dirname, "../../frontend");
const port = Number(process.env.SMOKE_PORT || 3217);
const baseUrl = `http://127.0.0.1:${port}`;

function browserPath() {
  const candidates = [
    process.env.BROWSER_BIN,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Safr production server did not become ready");
}

function dumpDom(executable, url, profileDir) {
  return new Promise((resolve, reject) => {
    const browser = spawn(
      executable,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profileDir}`,
        "--virtual-time-budget=4000",
        "--dump-dom",
        url,
      ],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    browser.stdout.on("data", (chunk) => (stdout += chunk));
    browser.stderr.on("data", (chunk) => (stderr += chunk));
    browser.on("error", reject);
    browser.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Browser exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

const executable = browserPath();
if (!executable) {
  throw new Error(
    "No Chromium browser found. Set BROWSER_BIN to Chrome, Edge or Chromium.",
  );
}
if (!fs.existsSync(path.join(frontendDir, "dist/server/server.js"))) {
  throw new Error("Production build missing. Run npm run build first.");
}

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "safr-smoke-"));
const server = spawn(process.execPath, ["--use-system-ca", "server.mjs"], {
  cwd: frontendDir,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

try {
  await waitUntilReady();
  const emergencyDom = await dumpDom(
    executable,
    `${baseUrl}/emergency`,
    profileDir,
  );
  if (!/Emergency|112/.test(emergencyDom)) {
    throw new Error("Emergency page did not render its critical UI");
  }

  const offlineDom = await dumpDom(
    executable,
    `${baseUrl}/offline.html`,
    profileDir,
  );
  if (!/You.re offline/.test(offlineDom) || !/tel:112/.test(offlineDom)) {
    throw new Error("Offline emergency fallback did not render correctly");
  }
  console.log("Browser smoke passed: emergency and offline fallback rendered.");
} finally {
  server.kill();
  fs.rmSync(profileDir, { recursive: true, force: true });
}
