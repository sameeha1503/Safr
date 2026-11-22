export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

export function routeColor(kind: string, isSelected: boolean): string {
  if (!isSelected) return "#94a3b8";
  if (kind === "safer") return "#10b981";
  if (kind === "alt") return "#06b6d4";
  return "#f97316";
}
