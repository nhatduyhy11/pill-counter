import { NextRequest, NextResponse } from "next/server";
import { countPills } from "@/lib/openrouter";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as string;

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const text = await countPills(image);
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Count error:", error);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
