/** Calendar arithmetic in Goa's timezone, independent of the device timezone. */
export function itineraryDate(
  kind: "today" | "tomorrow" | "weekend",
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((value) => value.type === type)?.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const day = date.getUTCDay();
  const offset =
    kind === "tomorrow" ? 1 : kind === "weekend" && day !== 0 ? 6 - day : 0;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
