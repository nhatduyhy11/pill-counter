"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePicker } from "@/components/image-picker";
import { ResultDisplay } from "@/components/result-display";
import { type PillCountResult } from "@/lib/pill-common";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<PillCountResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const handleCount = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const res = await fetch("/api/count", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể phân tích ảnh, vui lòng thử lại");
      }

      const points = (data.points as { x: number; y: number }[])
        .filter(
          (p) => typeof p.x === "number" && typeof p.y === "number"
        )
        .map((p) => ({
          x: clamp(p.x, 0, 1),
          y: clamp(p.y, 0, 1),
        }));

      setResult({
        count: points.length,
        points,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể phân tích ảnh, vui lòng thử lại"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setPickerKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-black p-4 sm:p-8">
      <main className="w-full max-w-2xl flex flex-col gap-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-center">
          💊 Pill Counter
        </h1>

        <Card>
          <CardHeader>
            <CardTitle>Chọn ảnh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImagePicker
              key={pickerKey}
              onImageSelected={(base64) => {
                setImage(base64);
              }}
              disabled={loading}
            />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Mẹo: dùng nền phẳng, tương phản với màu thuốc, tránh bóng gắt và
              hạn chế viên thuốc chồng lên nhau.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={handleCount}
                disabled={!image || loading}
                className="flex-1"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Đang phân tích...
                  </span>
                ) : (
                  "Đếm thuốc"
                )}
              </Button>

              {(result || error) && (
                <Button variant="outline" onClick={handleReset}>
                  Đếm lại
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && image && (
          <Card>
            <CardContent className="pt-6">
              <ResultDisplay
                count={result.count}
                imageSrc={image}
                points={result.points}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
