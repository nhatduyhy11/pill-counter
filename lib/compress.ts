const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 2048;
const QUALITY_STEP = 0.1;
const MIN_QUALITY = 0.3;

export async function compressImage(file: File): Promise<string> {
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

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let base64 = canvas.toDataURL("image/jpeg", quality);

        while (base64.length > MAX_FILE_SIZE * 1.37 && quality > MIN_QUALITY) {
          quality -= QUALITY_STEP;
          base64 = canvas.toDataURL("image/jpeg", quality);
        }

        resolve(base64);
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
