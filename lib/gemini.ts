import { GoogleGenerativeAI } from "@google/generative-ai";

export interface PillCountResult {
  count: number;
  points: { x: number; y: number }[];
}

const PROMPT = `Analyze this image and count the number of pills/tablets/capsules visible.

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

export async function countPills(
  imageBase64: string
): Promise<PillCountResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const match = imageBase64.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image format");

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    },
  ]);

  const text = result.response.text().trim();
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
