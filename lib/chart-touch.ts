/** Match touch coordinates to the nearest point in the 640-unit chart viewBox. */
export function chartDayAtTouch(clientX: number, left: number, width: number, count: number): number | null {
  if (count < 1 || width <= 0) return null;
  const fraction = ((clientX - left) / width * 640 - 26) / 596;
  return Math.max(0, Math.min(count - 1, Math.round(fraction * (count - 1))));
}
