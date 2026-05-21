import { NextRequest, NextResponse } from "next/server";
import { countPillsWithCV } from "@/lib/pill-cv";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (typeof image !== "string" || image.length === 0) {
      return NextResponse.json(
        { error: "Vui lòng chọn file ảnh" },
        { status: 400 }
      );
    }

    const debug =
      process.env.NODE_ENV !== "production" ||
      request.nextUrl.searchParams.get("debug") === "1";
    const result = await countPillsWithCV(image, { debug });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Count error:", error);

    const message =
      error instanceof Error && error.message.startsWith("Không thể")
        ? error.message
        : "Không thể phân tích ảnh, vui lòng thử lại";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
