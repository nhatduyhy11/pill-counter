export interface PillPoint {
  x: number;
  y: number;
}

export interface PillCountResult {
  count: number;
  points: PillPoint[];
}

export function isPillCountResult(value: unknown): value is PillCountResult {
  if (typeof value !== "object" || value === null) return false;

  const result = value as { count?: unknown; points?: unknown };
  return (
    typeof result.count === "number" &&
    Array.isArray(result.points) &&
    result.points.every(
      (point) =>
        typeof point === "object" &&
        point !== null &&
        typeof (point as { x?: unknown }).x === "number" &&
        typeof (point as { y?: unknown }).y === "number"
    )
  );
}
