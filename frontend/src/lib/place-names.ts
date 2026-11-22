/** Comparison key only; keep the original name for display and storage. */
export function normalizePlaceName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/);
  const specific = words.filter(
    (word) =>
      !["beach", "fort", "falls", "waterfalls", "waterfall", "church"].includes(
        word,
      ),
  );
  return (specific.length ? specific : words).join(" ");
}
