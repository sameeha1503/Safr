/** Move one stop without changing the others' relative order. Invalid drops are ignored. */
export function reorderStops<T>(
  stops: readonly T[],
  from: number,
  to: number,
): T[] {
  const result = [...stops];
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= result.length ||
    to >= result.length
  )
    return result;
  const [stop] = result.splice(from, 1);
  result.splice(to, 0, stop!);
  return result;
}
