export function isGoaNight(timeStr?: string): boolean {
  if (timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    if (typeof h === "number" && !isNaN(h)) {
      const minutes = h * 60 + (m || 0);
      return minutes < 390 || minutes >= 1125; // Before 06:30 or after 18:45
    }
  }
  const istFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = istFormatter.formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const minutes = h * 60 + m;
  return minutes < 390 || minutes >= 1125;
}
