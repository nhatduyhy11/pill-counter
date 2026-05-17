"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/compress";

interface ImagePickerProps {
  onImageSelected: (base64: string) => void;
  disabled?: boolean;
}

export function ImagePicker({ onImageSelected, disabled }: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      const base64 = await compressImage(file);
      setPreview(base64);
      onImageSelected(base64);
    } catch (err) {
      console.error("Failed to process image:", err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          📁 Chọn ảnh
        </Button>
        <Button
          variant="outline"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
        >
          📷 Chụp ảnh
        </Button>
        {preview && (
          <Button variant="ghost" onClick={clear} disabled={disabled}>
            ✕ Xóa
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      {preview && (
        <div className="relative rounded-lg overflow-hidden border">
          <img
            src={preview}
            alt="Selected"
            className="max-h-80 w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
