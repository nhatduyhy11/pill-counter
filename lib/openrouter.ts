import { buildPillCountPrompt, type PillCountResult } from "./pill-common";

const OPENROUTER_MODEL = "openai/gpt-5.5";

export async function countPills(imageBase64: string): Promise<PillCountResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const res = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPillCountPrompt() },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from AI");

  console.log("Raw AI response:", text.slice(0, 500));

  let parsed: { count: number; points: unknown[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI returned invalid JSON");
  }

  if (typeof parsed.count !== "number" || !Array.isArray(parsed.points)) {
    throw new Error("Invalid response format from AI");
  }

  return {
    count: parsed.count,
    points: parsed.points as PillCountResult["points"],
  };
}
