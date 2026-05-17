"use client";

import { Badge } from "@/components/ui/badge";
import { AnnotatedImage } from "./annotated-image";

interface ResultDisplayProps {
  count: number;
  imageSrc: string;
  points: { x: number; y: number }[];
}

export function ResultDisplay({ count, imageSrc, points }: ResultDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-medium">Kết quả:</span>
        <Badge variant="default" className="text-lg px-4 py-1">
          {count} viên thuốc
        </Badge>
      </div>
      <AnnotatedImage imageSrc={imageSrc} points={points} />
    </div>
  );
}
