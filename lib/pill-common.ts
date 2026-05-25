export interface PillCountResult {
  count: number;
  points: { x: number; y: number }[];
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
