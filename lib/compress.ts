const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 2048;
const QUALITY_STEP = 0.1;
const MIN_QUALITY = 0.3;

export interface CompressedImage {
  base64: string;
  width: number;
  height: number;
}

export async function compressImage(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Normalize to 1:1 square — center image with white padding
        const size = Math.max(width, height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);

        let quality = 0.8;
        let base64 = canvas.toDataURL("image/jpeg", quality);

        while (base64.length > MAX_FILE_SIZE * 1.37 && quality > MIN_QUALITY) {
          quality -= QUALITY_STEP;
          base64 = canvas.toDataURL("image/jpeg", quality);
        }

        resolve({ base64, width: size, height: size });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function base64ToGenerativePart(base64: string) {
  const match = base64.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 format");
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2],
    },
  };
}
