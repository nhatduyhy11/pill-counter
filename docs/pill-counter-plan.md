# Pill Counter App - Implementation Plan

## Overview
Web app đếm số viên thuốc trong ảnh. User chọn ảnh (file picker hoặc camera), app gửi lên Google Gemini Vision API để đếm, trả về số lượng + vẽ circle markers trên ảnh.

## Tech Stack
- **Framework**: Next.js (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **AI**: Google Gemini 2.0 Flash (Vision API)
- **Canvas**: Native HTML5 Canvas API
- **Deploy**: Vercel
- **Package manager**: pnpm

## Project Structure
```
pill-counter/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # Main page
│   ├── globals.css
│   └── api/
│       └── count/
│           └── route.ts      # API route gọi Gemini
├── components/
│   ├── image-picker.tsx      # File picker + camera
│   ├── result-display.tsx    # Hiển thị kết quả
│   └── annotated-image.tsx   # Canvas vẽ circle markers
├── lib/
│   ├── gemini.ts             # Gemini API client
│   └── compress.ts           # Image compression utility
├── public/
├── .env.local                # GEMINI_API_KEY
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Implementation Steps

### Step 1: Project Setup
- `npx create-next-app@latest pill-counter --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"`
- Install dependencies: `pnpm add @google/generative-ai`
- Install shadcn/ui: `npx shadcn@latest init`
- Add components: `npx shadcn@latest add button card`

### Step 2: Environment Setup
- Tạo `.env.local` với `GEMINI_API_KEY=your_key_here`
- Verify Gemini API key hoạt động

### Step 3: Image Compression (`lib/compress.ts`)
- Function nhận File/Blob, trả về compressed base64
- Resize ảnh nếu > 5MB
- Giữ aspect ratio
- Output JPEG quality adaptive

### Step 4: Gemini API Client (`lib/gemini.ts`)
- Initialize Gemini với `@google/generative-ai`
- Function `countPills(imageBase64: string)`:
  - Gửi ảnh + prompt
  - Prompt yêu cầu trả về JSON: `{ count: number, points: [{x: number, y: number}] }`
  - Points là normalized coordinates (0-1)
  - Parse response, validate format
  - Trả về structured result

### Step 5: API Route (`app/api/count/route.ts`)
- POST handler
- Nhận FormData với image file
- Compress ảnh
- Gọi Gemini API
- Trả về JSON result
- Error handling: invalid image, API error, no pills detected

### Step 6: Image Picker Component (`components/image-picker.tsx`)
- File input accept image/*
- Camera button (capture="environment")
- Preview ảnh đã chọn
- Nút "Đếm thuốc" để submit
- Hiển thị lỗi nếu file quá lớn

### Step 7: Annotated Image Component (`components/annotated-image.tsx`)
- Canvas element
- Draw ảnh gốc lên canvas
- Draw circle markers tại mỗi center point
- Circle style: viền đỏ, fill trong suốt
- Responsive: scale canvas theo container

### Step 8: Result Display Component (`components/result-display.tsx`)
- Hiển thị số lượng: "X viên thuốc"
- Hiển thị annotated image
- Nút "Đếm lại" hoặc chọn ảnh mới

### Step 9: Main Page (`app/page.tsx`)
- Layout responsive (mobile + desktop)
- Image picker ở trên
- Result display ở dưới
- Loading state: spinner khi đang gọi API
- Error state: message đơn giản

### Step 10: Polish & Deploy
- Test với nhiều loại ảnh khác nhau
- Responsive check
- Error handling edge cases
- Deploy lên Vercel
- Set env variable GEMINI_API_KEY trên Vercel

## Gemini Prompt Design
```
Analyze this image and count the number of pills/tablets/capsules visible.

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
Do not include any text outside the JSON object.
```

## Error Cases
1. File quá lớn (> 5MB sau compress) → "Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn"
2. File không phải ảnh → "Vui lòng chọn file ảnh"
3. Gemini API error → "Không thể phân ảnh, vui lòng thử lại"
4. Không tìm thấy thuốc → "Không tìm thấy viên thuốc nào trong ảnh"
5. Response parse error → "Không thể phân ảnh, vui lòng thử lại"

## Environment Variables
```
GEMINI_API_KEY=your_google_gemini_api_key
```

## Dependencies
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.x",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "typescript": "latest",
    "tailwindcss": "latest",
    "@types/react": "latest"
  }
}
```

## Notes
- Gemini 2.0 Flash free tier: 15 RPM, 1M tokens/day - đủ cho personal use
- Image sẽ được gửi dưới dạng base64 inline (không upload lên storage)
- Canvas annotation cần handle device pixel ratio cho sắc nét trên Retina
- Camera capture cần HTTPS trên mobile
