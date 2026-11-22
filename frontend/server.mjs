import { staticResponseHeaders } from "./server-static.mjs";
import {
  healthPayload,
  requestId,
  requestLog,
} from "./server-observability.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { toNodeHandler } from "srvx/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Production starts do not pass through Vite: load server-only local settings here.
if (fs.existsSync(path.join(__dirname, ".env")))
  process.loadEnvFile(path.join(__dirname, ".env"));

const clientDir = fs.existsSync(path.resolve(__dirname, "dist/client"))
  ? path.resolve(__dirname, "dist/client")
  : path.resolve(__dirname, "../frontend/dist/client");

const serverEntry = fs.existsSync(
  path.resolve(__dirname, "dist/server/server.js"),
)
  ? path.resolve(__dirname, "dist/server/server.js")
  : path.resolve(__dirname, "../frontend/dist/server/server.js");

if (!fs.existsSync(serverEntry)) {
  console.error(
    "Server build not found at",
    serverEntry,
    '- run "npm run build" first.',
  );
  process.exit(1);
}

const { default: serverApp } = await import(pathToFileURL(serverEntry).href);
const ssrHandler = toNodeHandler(serverApp.fetch);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const startedAt = performance.now();
  const id = requestId(req.headers["x-request-id"]);
  res.setHeader("X-Request-ID", id);
  // Security headers to protect against clickjacking, MIME sniffing, and enforce HTTPS
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://translate.google.com https://translate.googleapis.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com https://www.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss: https://translate.googleapis.com https://translate-pa.googleapis.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-src 'self' https://translate.google.com https://translate.googleapis.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  const parsedUrl = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`,
  );
  let pathname;
  try {
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  res.once("finish", () => {
    if (!pathname.startsWith("/assets/")) {
      console.log(
        requestLog({
          id,
          method: req.method || "GET",
          pathname,
          status: res.statusCode,
          durationMs: performance.now() - startedAt,
        }),
      );
    }
  });

  if (pathname === "/healthz") {
    const payload = JSON.stringify(healthPayload());
    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(payload));
    res.end(payload);
    return;
  }

  // Check static file in dist/client
  if (pathname !== "/") {
    const filePath = path.join(clientDir, pathname);
    // Path traversal check
    if (filePath.startsWith(clientDir + path.sep) && fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || "application/octet-stream";
          for (const [name, value] of Object.entries(
            staticResponseHeaders(pathname),
          ))
            res.setHeader(name, value);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Length", stat.size);
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      } catch (err) {
        console.error("Error reading static file:", err);
      }
    }
  }

  // Delegate all dynamic routes & server functions to TanStack Start SSR
  ssrHandler(req, res);
});

const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

server.listen(port, host, () => {
  console.log(`Safr server listening on http://${host}:${port}`);
});
