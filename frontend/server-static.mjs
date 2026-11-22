export function staticResponseHeaders(pathname) {
  if (pathname === "/sw.js")
    return { "Cache-Control": "no-cache", "Service-Worker-Allowed": "/" };
  return {
    "Cache-Control": pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  };
}
