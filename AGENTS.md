# Pill Counter - Agent Guide

## Project Overview
AI-powered pill counter using vision model (via OpenRouter). Vietnamese UI. Single-page app with image upload and pill detection overlay. Currently POC/testing phase — model not finalized.

## Tech Stack
- **Next.js 16.2.6** (App Router) + React 19.2.4
- **pnpm** package manager
- **Tailwind CSS v4** via PostCSS (`@tailwindcss/postcss`)
- **shadcn/ui** (base-nova style, lucide icons)
- **TypeScript** (strict mode)

## Commands
```bash
pnpm dev          # Start dev server (Turbopack by default in v16)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint (flat config)
```
No test framework configured.

## Architecture
```
pill-counter/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # Main client component ("use client")
│   ├── globals.css
│   └── api/
│       └── count/
│           └── route.ts      # POST endpoint, receives base64 image, returns pill count + coordinates
├── components/
│   ├── image-picker.tsx      # File picker + camera
│   ├── result-display.tsx    # Hiển thị kết quả
│   ├── annotated-image.tsx   # Canvas vẽ circle markers
│   └── ui/                   # shadcn components (button, card, badge)
├── lib/
│   ├── pill-common.ts        # Shared prompt, types (PillCountResult), response parser
│   ├── openrouter.ts         # OpenRouter API integration
│   └── compress.ts           # Client-side image compression (5MB limit, 2048px max)
├── public/
├── .env.local                # OPENROUTER_API_KEY
└── ...config files
```

## Environment
Requires `OPENROUTER_API_KEY` in `.env.local` (see `.env.example`).

## Next.js 16 Breaking Changes (Critical)
- **Turbopack default**: `--turbopack` flag no longer needed
- **Async Request APIs**: `params`, `searchParams`, `cookies()`, `headers()` must be `await`ed
- **middleware → proxy**: Rename `middleware.ts` to `proxy.ts`, export `proxy` function
- **next lint removed**: Use `eslint` directly (already configured in package.json)
- **ESLint flat config**: Default format (project uses `eslint.config.mjs`)
- **React 19.2**: View Transitions, `useEffectEvent`, Activity API available

## UI Language
All user-facing strings are Vietnamese. Preserve this convention.

## Key Patterns
- Images compressed client-side before upload (base64 format)
- API returns normalized coordinates (0-1) for pill positions
- Canvas overlay draws numbered circles on detected pills
- Annotation style: chấm (dot) tại trung tâm viên thuốc + đánh số thứ tự (1, 2, 3...)
- shadcn components added via `npx shadcn@latest add <component>`

## AI Prompt
- Gửi ảnh + prompt yêu cầu đếm pills, trả về JSON `{count, points[]}`
- Points là normalized coordinates (0-1) cho vị trí từng viên
- Parser trong `lib/pill-common.ts` xử lý response

## Error Messages (Vietnamese)
1. File quá lớn (> 5MB sau compress) → "Ảnh quá lớn, vui lòng chọn ảnh nhỏ hơn"
2. File không phải ảnh → "Vui lòng chọn file ảnh"
3. AI API error → "Không thể phân ảnh, vui lòng thử lại"
4. Không tìm thấy thuốc → "Không tìm thấy viên thuốc nào trong ảnh"
5. Response parse error → "Không thể phân ảnh, vui lòng thử lại"

## Operational Notes
- Image gửi dưới dạng base64 inline (không upload lên storage)
- Canvas annotation cần handle device pixel ratio cho sắc nét trên Retina
- Camera capture cần HTTPS trên mobile

## File References
- `node_modules/next/dist/docs/` - Next.js 16 documentation (consult before writing code)
