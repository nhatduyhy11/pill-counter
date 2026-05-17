"use client";

import { useCallback, useEffect, useRef } from "react";

interface AnnotatedImageProps {
  imageSrc: string;
  points: { x: number; y: number }[];
}

export function AnnotatedImage({ imageSrc, points }: AnnotatedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = canvas.parentElement?.clientWidth || img.width;
    const scale = containerWidth / img.width;
    const width = containerWidth;
    const height = img.height * scale;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.drawImage(img, 0, 0, width, height);

    const circleRadius = Math.max(12, Math.min(20, width / 40));

    points.forEach((point, i) => {
      const x = point.x * width;
      const y = point.y * height;

      ctx.beginPath();
      ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
      ctx.fill();

      ctx.fillStyle = "#ef4444";
      ctx.font = `bold ${Math.round(circleRadius * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x, y);
    });
  }, [points]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageSrc;

    return () => {
      imgRef.current = null;
    };
  }, [imageSrc, draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div className="rounded-lg overflow-hidden border">
      <canvas ref={canvasRef} className="block w-full" />
    </div>
  );
}
