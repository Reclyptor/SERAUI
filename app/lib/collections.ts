// Returns a new Map with at most `max` entries, keeping the most recently
// inserted ones (insertion order is preserved by Map iteration). Returns the
// input untouched if it's already within the cap, so consumers can compare
// references to short-circuit re-renders.
export function trimMap<K, V>(map: Map<K, V>, max: number): Map<K, V> {
  if (map.size <= max) return map;
  const entries = Array.from(map.entries());
  // Use length - max instead of -max so max = 0 yields slice(length) = [].
  // slice(-0) is equivalent to slice(0) and would return the whole array.
  return new Map(entries.slice(entries.length - max));
}
