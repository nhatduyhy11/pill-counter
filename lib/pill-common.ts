export interface PillPoint {
  x: number;
  y: number;
}

export interface PillCountCandidateDebug {
  name: string;
  score: number;
  foregroundRatio: number;
  borderForegroundRatio: number;
  componentCount: number;
  smallComponentRatio: number;
}

export interface PillCountDebug {
  image: {
    width: number;
    height: number;
    processedWidth: number;
    processedHeight: number;
  };
  selectedMode: string;
  foregroundRatio: number;
  candidateScores: PillCountCandidateDebug[];
  rejectedComponents: number;
  sourceComponents: number;
  clustersSplit: number;
  warnings: string[];
}

export interface PillCountResult {
  count: number;
  points: PillPoint[];
  debug?: PillCountDebug;
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

export function buildPillCountPrompt(): string {
  return `You are a precise pill counting assistant. Count every pill, tablet, or capsule in this image and return the exact center of each one.

The image is a square. Ignore any white padding areas — only count pills on the actual photo content.

INSTRUCTIONS:
1. Scan the ENTIRE image carefully — check all areas including edges and corners
2. Count every distinct pill. A pill may be round, oval, or capsule-shaped
3. If pills overlap partially, count each visible pill separately
4. For each pill, locate its geometric center (the point equidistant from all edges of the pill shape)

COORDINATE SYSTEM (normalized 0.0 to 1.0):
- x: 0.0 = left edge, 1.0 = right edge
- y: 0.0 = top edge, 1.0 = bottom edge
- Example: center of image = {"x": 0.5, "y": 0.5}

PRECISION: Use at least 2 decimal places. The center must be ON the pill.

Return ONLY JSON:
{"count": <number>, "points": [{"x": <0.0-1.0>, "y": <0.0-1.0>}, ...]}

points array must have exactly "count" entries.
If no pills found: {"count": 0, "points": []}
No text outside the JSON.`;
}
