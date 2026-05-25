# Pill Counter - Tech Stack

## Stack
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
│           └── route.ts      # POST endpoint, receives base64 image, returns raw AI text
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

## Next.js 16 Breaking Changes (Critical)
- **Turbopack default**: `--turbopack` flag no longer needed
- **Async Request APIs**: `params`, `searchParams`, `cookies()`, `headers()` must be `await`ed
- **middleware → proxy**: Rename `middleware.ts` to `proxy.ts`, export `proxy` function
- **next lint removed**: Use `eslint` directly (already configured in package.json)
- **ESLint flat config**: Default format (project uses `eslint.config.mjs`)
- **React 19.2**: View Transitions, `useEffectEvent`, Activity API available

## References
- `node_modules/next/dist/docs/` - Next.js 16 documentation (consult before writing code)
