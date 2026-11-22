/**
 * Pure opening hours parsing for OpenStreetMap opening_hours strings.
 * Evaluates current time in Asia/Kolkata.
 * NOTE: Do NOT import maplibre-gl, React, or DOM APIs in this file.
 */

export interface ParsedOpeningHours {
  raw: string;
  isOpen?: boolean | undefined;
  statusBadge?: string | undefined; // "Open 24/7" | "Open" | "Closed"
  statusDetail?: string | undefined; // e.g. "Closes at 18:00", "Opens at 09:00"
}

const DAY_INDICES: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

/**
 * Parses time string "HH:MM" into minutes from midnight (0..1439).
 */
function parseTimeToMinutes(timeStr: string): number | null {
  const parts = timeStr.trim().split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 24 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Gets the current day of the week (0 = Sunday .. 6 = Saturday) and
 * minute of the day (0 .. 1439) in Asia/Kolkata timezone.
 */
export function getKolkataNow(referenceDate?: Date): {
  dayOfWeek: number;
  currentMinutes: number;
} {
  const date = referenceDate ?? new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekdayStr = (parts.find((p) => p.type === "weekday")?.value || "Sun")
    .slice(0, 2)
    .toLowerCase();

  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const minStr = parts.find((p) => p.type === "minute")?.value ?? "0";

  const hour = parseInt(hourStr, 10) % 24;
  const minute = parseInt(minStr, 10);

  const dayOfWeek = DAY_INDICES[weekdayStr] ?? 0;
  const currentMinutes = hour * 60 + minute;

  return { dayOfWeek, currentMinutes };
}

/** Only simple weekly intervals are supported; uncertain rules have no badge. */
export function parseOpeningHours(
  rawInput?: string | null,
  referenceDate?: Date,
): ParsedOpeningHours {
  const raw = rawInput?.trim() || "";
  if (!raw) return { raw };
  if (raw === "24/7")
    return {
      raw,
      isOpen: true,
      statusBadge: "Open 24/7",
      statusDetail: "Open 24 hours",
    };
  const rules: {
    days: number[];
    open: number;
    close: number;
    closeText: string;
  }[] = [];
  const used = new Set<number>();
  for (const part of raw.split(";")) {
    const match = part
      .trim()
      .match(
        /^(?:(daily|Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+)?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/i,
      );
    if (!match) return { raw };
    const open = parseTimeToMinutes(match[3]!);
    const close = parseTimeToMinutes(match[4]!);
    if (
      open == null ||
      close == null ||
      open >= 1440 ||
      close > 1440 ||
      open === close
    )
      return { raw };
    const days: number[] = [];
    if (!match[1] || match[1].toLowerCase() === "daily") {
      if (match[2]) return { raw };
      days.push(0, 1, 2, 3, 4, 5, 6);
    } else {
      const start = DAY_INDICES[match[1].toLowerCase()]!;
      const end = match[2] ? DAY_INDICES[match[2].toLowerCase()]! : start;
      for (let day = start; ; day = (day + 1) % 7) {
        days.push(day);
        if (day === end) break;
      }
    }
    if (days.some((day) => used.has(day))) return { raw };
    days.forEach((day) => used.add(day));
    rules.push({ days, open, close, closeText: match[4]! });
  }
  const { dayOfWeek: day, currentMinutes: time } = getKolkataNow(referenceDate);
  const active = rules.find((rule) =>
    rule.open < rule.close
      ? rule.days.includes(day) && time >= rule.open && time < rule.close
      : (rule.days.includes(day) && time >= rule.open) ||
        (rule.days.includes((day + 6) % 7) && time < rule.close),
  );
  return {
    raw,
    isOpen: Boolean(active),
    statusBadge: active ? "Open" : "Closed",
    ...(active ? { statusDetail: `Closes at ${active.closeText}` } : {}),
  };
}
