# Technology Stack

**Analysis Date:** 2026-05-28

## Languages

**Primary:**
- TypeScript 5.x — All application code (components, lib, API routes)

**Secondary:**
- CSS — Styling via Tailwind CSS utility classes in `app/globals.css`

## Runtime

**Environment:**
- Node.js (server-side API routes use `runtime = "nodejs"` in `app/api/count/route.ts`)
- Browser (client-side image processing via Canvas API and OpenCV.js)

**Package Manager:**
- pnpm (lockfile v9.0)
- Lockfile: `pnpm-lock.yaml` present (6729 lines)
- Workspace config: `pnpm-workspace.yaml` (ignores `sharp`, `unrs-resolver` build deps)

## Frameworks

**Core:**
- Next.js 16.2.6 — Full-stack React framework (App Router)
- React 19.2.4 — UI library
- React DOM 19.2.4 — DOM rendering

**Testing:**
- Not detected — No test framework configured, no test files found

**Build/Dev:**
- Next.js built-in bundler (Turbopack in dev)
- TypeScript 5.x — Type checking
- ESLint 9.x — Linting with `eslint-config-next` 16.2.6
- PostCSS — CSS processing via `@tailwindcss/postcss`

## Key Dependencies

**Critical (runtime):**
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.2.6 | Framework, routing, API routes, SSR |
| `react` / `react-dom` | 19.2.4 | UI rendering |
| `@techstark/opencv-js` | 4.12.0-release.1 | Computer vision — pill detection via image processing |
| `jimp` | ^1.6.1 | Image decoding (base64 → pixel data) on server side |
| `shadcn` | ^4.7.0 | UI component registry (shadcn/ui) |
| `@base-ui/react` | ^1.4.1 | Headless UI primitives (used by shadcn) |
| `lucide-react` | ^1.16.0 | Icon library |
| `class-variance-authority` | ^0.7.1 | Component variant management |
| `clsx` | ^2.1.1 | Conditional className joining |
| `tailwind-merge` | ^3.6.0 | Tailwind class deduplication |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utilities |

**Dev Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^4 | Utility-first CSS framework |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin for Tailwind |
| `typescript` | ^5 | Type checking |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.2.6 | Next.js ESLint rules |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^19 | React type definitions |
| `@types/react-dom` | ^19 | React DOM type definitions |

## Configuration

**Environment:**
- `.env*` files gitignored — no `.env.example` found
- Required env var: `OPENROUTER_API_KEY` (used in `lib/openrouter.ts`)
- `NODE_ENV` checked for debug mode in API route (`app/api/count/route.ts`)

**Build:**
- `next.config.ts` — Minimal config, marks `@techstark/opencv-js` and `jimp` as `serverExternalPackages`
- `tsconfig.json` — Target ES2017, bundler module resolution, path alias `@/*` → `./*`
- `postcss.config.mjs` — Single plugin: `@tailwindcss/postcss`
- `eslint.config.mjs` — Flat config with `eslint-config-next/core-web-vitals` + `typescript`
- `components.json` — shadcn/ui config (style: `base-nova`, RSC enabled, Lucide icons)

**Path Aliases:**
- `@/*` → project root (configured in `tsconfig.json`)

## CSS / Styling Approach

**Framework:** Tailwind CSS v4 with PostCSS integration

**Approach:**
- Utility-first CSS with Tailwind classes directly in JSX
- CSS custom properties (oklch color space) for theming in `app/globals.css`
- Dark mode via `.dark` class variant (`@custom-variant dark (&:is(.dark *))`)
- `cn()` utility in `lib/utils.ts` combines `clsx` + `tailwind-merge` for conditional classes
- shadcn/ui components in `components/ui/` (badge, button, card)

**Fonts:**
- Geist Sans (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`) via `next/font/google`

## State Management

**Pattern:** React `useState` hooks — no external state library

**Location:** `app/page.tsx` (single-page app)
- `image` — base64 string of selected image
- `result` — `PillCountResult` from API
- `loading` — boolean for API call in progress
- `error` — string error message
- `pickerKey` — key for resetting ImagePicker component

**Data Flow:**
1. User selects image → `ImagePicker` calls `compressImage()` → stores base64 in state
2. User clicks "Đếm thuốc" → POST to `/api/count` with FormData
3. API returns `{ count, points }` → stored in `result` state
4. `ResultDisplay` renders annotated image with pill markers

## Server-Side External Packages

Configured in `next.config.ts` → `serverExternalPackages`:
- `@techstark/opencv-js` — WebAssembly-based OpenCV, must run in Node.js runtime
- `jimp` — Image processing library, server-side only

These packages are excluded from the client bundle and run only in the Node.js API route.

---

*Stack analysis: 2026-05-28*
