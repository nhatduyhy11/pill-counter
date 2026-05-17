export interface PillCountResult {
  count: number;
  points: { x: number; y: number }[];
}

export const PILL_COUNT_PROMPT = `Analyze this image and count the number of pills/tablets/capsules visible.

Return ONLY a JSON object in this exact format:
{
  "count": <number>,
  "points": [{"x": <0-1>, "y": <0-1>}, ...]
}

Where:
- "count" is the total number of pills
- "points" contains the center position of each pill as normalized coordinates (0.0 to 1.0)
- x=0 is left edge, x=1 is right edge
- y=0 is top edge, y=1 is bottom edge

If no pills are found, return {"count": 0, "points": []}
Do not include any text outside the JSON object.`;

function extractJson(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Invalid response from AI");

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  throw new Error("Invalid response from AI");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parsePillCountResponse(text: string): PillCountResult {
  const jsonStr = extractJson(text);
  const parsed = JSON.parse(jsonStr);

  if (typeof parsed.count !== "number" || !Array.isArray(parsed.points)) {
    throw new Error("Invalid response format");
  }

  const points = parsed.points
    .filter(
      (p: { x: number; y: number }) =>
        typeof p.x === "number" && typeof p.y === "number"
    )
    .map((p: { x: number; y: number }) => ({
      x: clamp(p.x, 0, 1),
      y: clamp(p.y, 0, 1),
    }));

  return {
    count: points.length,
    points,
  };
}
