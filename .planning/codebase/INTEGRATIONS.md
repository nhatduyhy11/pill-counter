# External Integrations

**Analysis Date:** 2026-05-28

## APIs & External Services

**AI Vision (Primary Integration):**
- OpenRouter API — AI-powered pill counting via vision model
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions`
  - Model: `openai/gpt-5.5` (configured in `lib/openrouter.ts`)
  - Auth: Bearer token via `OPENROUTER_API_KEY` env var
  - Usage: Sends base64 image + structured prompt, expects JSON response with `{ count, points }`
  - Temperature: 0.1 (deterministic output)
  - Response format: `json_object`
  - Implementation: `lib/openrouter.ts` → `countPillsWithCV()` function
  - **Note:** This is an alternative/fallback path — the primary counting uses local OpenCV (see below)

**Computer Vision (Local Processing):**
- OpenCV.js (`@techstark/opencv-js` 4.12.0-release.1) — Local image processing for pill detection
  - Runs server-side in Node.js runtime (`app/api/count/route.ts`)
  - Initialization: `lib/opencv-init.ts` — lazy-loaded singleton with 10s timeout
  - Processing pipeline: `lib/pill-cv.ts` — image decode → resize → mask candidates → connected components → pill counting
  - No external API calls — all processing is local

**MCP Servers (Development Tooling):**
- Exa Search — Configured in `opencode.json` as remote MCP server
  - URL: `https://mcp.exa.ai/mcp`
  - Purpose: Web search during development (not used in production)

## Data Storage

**Databases:**
- None — Application is stateless, no database connections

**File Storage:**
- Local filesystem only — Images processed in-memory, not persisted
- Temporary test images in `test-img/` directory

**Caching:**
- None — No caching layer implemented

## Authentication & Identity

**Auth Provider:**
- None — No user authentication implemented
- API key for OpenRouter is server-side only (env var)

## Monitoring & Observability

**Error Tracking:**
- None — No error tracking service integrated

**Logs:**
- `console.error` for errors in API route (`app/api/count/route.ts:25`)
- `console.log` for raw AI response debugging (`lib/openrouter.ts:46`)
- `console.error` for OpenCV init errors (`lib/pill-cv.ts:63`)
- `console.error` for image decode errors (`lib/pill-cv.ts:150`)

## CI/CD & Deployment

**Hosting:**
- Not detected — No deployment config found (no `vercel.json`, `Dockerfile`, etc.)
- `.vercel` in `.gitignore` suggests Vercel may be used

**CI Pipeline:**
- None detected — No CI config files found

## Environment Configuration

**Required env vars:**
| Variable | Purpose | Used In |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | API key for OpenRouter AI service | `lib/openrouter.ts:6` |

**Optional env vars:**
| Variable | Purpose | Used In |
|----------|---------|---------|
| `NODE_ENV` | Controls debug mode in API response | `app/api/count/route.ts:19` |

**Secrets location:**
- `.env*` files gitignored (`.gitignore` line 34)
- No `.env.example` or `.env.local` found in repo
- Secrets should be set in deployment environment or local `.env.local`

## Webhooks & Callbacks

**Incoming:**
- None — No webhook endpoints defined

**Outgoing:**
- None — No outbound webhook calls

## API Routes

**`POST /api/count`** — `app/api/count/route.ts`
- Runtime: Node.js (`export const runtime = "nodejs"`)
- Input: FormData with `image` field (base64 string)
- Output: JSON `{ count: number, points: Array<{x, y}> }` or `{ error: string }`
- Processing: Calls `countPillsWithCV()` from `lib/pill-cv.ts`
- Debug mode: Enabled in non-production or with `?debug=1` query param

## Client-Side Integrations

**Image Compression:** `lib/compress.ts`
- Uses Canvas API for client-side image processing
- Normalizes images to 1:1 square with white padding
- Max dimension: 2048px
- Max file size: 5MB (iteratively reduces JPEG quality from 0.8 to 0.3)
- Output: base64 data URL

**Image Annotation:** `components/annotated-image.tsx`
- Uses Canvas API to draw numbered circles on detected pill positions
- Responsive — handles device pixel ratio and window resize

## Dependency Architecture

```
Browser (Client)                    Server (Node.js)
┌─────────────────┐                ┌──────────────────────┐
│ ImagePicker      │                │ /api/count/route.ts  │
│  └─ compress.ts  │──FormData──→  │  └─ pill-cv.ts       │
│     (Canvas API) │   (base64)    │     ├─ opencv-init.ts │
│                  │                │     │   (OpenCV.js)   │
│ AnnotatedImage   │←─JSON─────── │     ├─ jimp (decode)  │
│  (Canvas API)    │  {count,pts}  │     └─ pill-cv-config │
└─────────────────┘                └──────────────────────┘

Alternative path (not currently used in API route):
lib/openrouter.ts → OpenRouter API (cloud AI)
```

---

*Integration audit: 2026-05-28*
