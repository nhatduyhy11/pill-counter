# Pill Counter - Agent Guide

## Project Overview
AI-powered pill counter using Google Gemini. Vietnamese UI. Single-page app with image upload and pill detection overlay.

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
- `app/page.tsx` - Main client component (`"use client"`)
- `app/api/count/route.ts` - POST endpoint, receives base64 image, returns pill count + coordinates
- `lib/pill-common.ts` - Shared prompt, types (`PillCountResult`), and response parser
- `lib/openrouter.ts` - OpenRouter API integration
- `lib/compress.ts` - Client-side image compression (5MB limit, 2048px max dimension)
- `components/` - ImagePicker, ResultDisplay, AnnotatedImage (canvas overlay)
- `components/ui/` - shadcn components (button, card, badge)

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

## File References
- `node_modules/next/dist/docs/` - Next.js 16 documentation (consult before writing code)
