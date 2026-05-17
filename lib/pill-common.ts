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

export function parsePillCountResponse(text: string): PillCountResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid response from AI");

  const parsed = JSON.parse(jsonMatch[0]);

  if (typeof parsed.count !== "number" || !Array.isArray(parsed.points)) {
    throw new Error("Invalid response format");
  }

  return {
    count: parsed.count,
    points: parsed.points.filter(
      (p: { x: number; y: number }) =>
        typeof p.x === "number" && typeof p.y === "number"
    ),
  };
}
