# Pill Counter - Specs

## Project Overview
AI-powered pill counter using vision model (via OpenRouter). Vietnamese UI. Single-page app with image upload and pill detection overlay. Currently POC/testing phase — model not finalized.

## UI Language
All user-facing strings are Vietnamese. Preserve this convention.

## Error Messages (Vietnamese)
1. File quá lớn (> 5MB sau compress) → "Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn"
2. File không phải ảnh → "Vui lòng chọn file ảnh"
3. AI API error → "Không thể phân ảnh, vui lòng thử lại"
4. Không tìm thấy thuốc → "Không tìm thấy viên thuốc nào trong ảnh"
5. Response parse error → "Không thể phân ảnh, vui lòng thử lại"

## Key Patterns
- Images compressed client-side before upload (base64 format via FormData)
- Images normalized to **1:1 square** with white padding in `compress.ts`
- API endpoint returns **raw AI text** — no server-side JSON parsing
- All post-processing (JSON parse, filter valid points, clamp to [0,1]) happens **client-side** in `page.tsx`
- **Count trust**: `count` from AI ignored, client uses `points.length`
- Canvas overlay draws numbered circles on detected pills
- Annotation style: circle đỏ + số thứ tự tại trung tâm viên thuốc
- Canvas handles devicePixelRatio for Retina sharpness
- shadcn components added via `npx shadcn@latest add <component>`

## AI Integration
- **Model**: `openai/gpt-5.5` via OpenRouter (`lib/openrouter.ts`)
- **Prompt**: Built by `buildPillCountPrompt()` in `lib/pill-common.ts`
- **Input**: base64 image + text prompt → OpenRouter chat completions API
- **Output**: Raw text containing JSON `{"count": N, "points": [{x, y}, ...]}`
- **Parse flow**: `extractJson()` (brace-match) → `JSON.parse` → validate → filter → clamp
- See `docs/count_flow.md` for full end-to-end flow

## Operational Notes
- Image gửi dưới dạng base64 inline (không upload lên storage)
- Camera capture cần HTTPS trên mobile

## Environment
Requires `OPENROUTER_API_KEY` in `.env.local` (see `.env.example`).
