<!-- refreshed: 2026-05-28 -->
# Architecture

**Analysis Date:** 2026-05-28

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ ImagePicker  │    │  page.tsx    │    │ ResultDisplay    │   │
│  │ File/Camera  │───→│  (Home)      │───→│ + AnnotatedImage │   │
│  │ compress.ts  │    │  State Mgmt  │    │ Canvas Overlay   │   │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘   │
│                             │ POST FormData(base64)              │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (Next.js API Route)                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  app/api/count/route.ts                                   │   │
│  │  - Parse FormData                                         │   │
│  │  - Call countPillsWithCV()                                │   │
│  │  - Return JSON {count, points, debug?}                    │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │  lib/pill-cv.ts — OpenCV.js Pipeline                      │   │
│  │  1. Decode base64 → RGBA Mat (jimp)                       │   │
│  │  2. Resize if > maxDimension                              │   │
│  │  3. Generate 7 mask candidates (Otsu, Adaptive, BG-dist)  │   │
│  │  4. Score & select best mask                               │   │
│  │  5. Connected components → distance transform → markers    │   │
│  │  6. Return normalized {x, y} points                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  lib/openrouter.ts — AI Pipeline (legacy/alternative)     │   │
│  │  1. Build prompt (pill-common.ts)                         │   │
│  │  2. POST to OpenRouter API (gpt-5.5, json_object mode)    │   │
│  │  3. Parse JSON response → validate                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| RootLayout | HTML shell, fonts, metadata | `app/layout.tsx` |
| Home (page) | Main UI, state management, API call orchestration | `app/page.tsx` |
| ImagePicker | File/camera input, client-side compression | `components/image-picker.tsx` |
| ResultDisplay | Count badge + annotated image wrapper | `components/result-display.tsx` |
| AnnotatedImage | Canvas-based pill marker overlay | `components/annotated-image.tsx` |
| API Route | Server endpoint, delegates to CV pipeline | `app/api/count/route.ts` |
| pill-cv.ts | OpenCV.js computer vision pipeline | `lib/pill-cv.ts` |
| openrouter.ts | OpenRouter AI API client (alternative) | `lib/openrouter.ts` |
| compress.ts | Client-side image compression/normalization | `lib/compress.ts` |
| opencv-init.ts | OpenCV.js runtime singleton loader | `lib/opencv-init.ts` |
| pill-common.ts | Shared types, prompt builder | `lib/pill-common.ts` |
| pill-cv-config.ts | CV pipeline configuration constants | `lib/pill-cv-config.ts` |

## Pattern Overview

**Overall:** Monolithic Next.js App Router with server-side CV processing

**Key Characteristics:**
- Single-page application with one API endpoint
- Client-side image preprocessing (compress, normalize to 1:1 square)
- Server-side computer vision processing via OpenCV.js
- Two counting backends: OpenCV.js (primary) and OpenRouter AI (legacy/alternative)
- Canvas-based result visualization with numbered markers
- Vietnamese UI throughout

## Layers

**Presentation Layer (Client Components):**
- Purpose: Image selection, result display, user interaction
- Location: `app/page.tsx`, `components/`
- Contains: React client components (`"use client"`)
- Depends on: `lib/compress.ts` for image preprocessing
- Used by: End users via browser

**API Layer (Server Route):**
- Purpose: Receive image, process, return count results
- Location: `app/api/count/route.ts`
- Contains: Next.js route handler (POST)
- Depends on: `lib/pill-cv.ts` (primary), `lib/openrouter.ts` (alternative)
- Used by: Client via `fetch("/api/count")`

**Processing Layer (CV Pipeline):**
- Purpose: Computer vision pill detection and counting
- Location: `lib/pill-cv.ts`, `lib/pill-cv-config.ts`
- Contains: OpenCV.js operations, mask generation, component analysis
- Depends on: `@techstark/opencv-js`, `jimp`, `lib/opencv-init.ts`
- Used by: API route

**Processing Layer (AI Pipeline):**
- Purpose: AI-based pill counting via vision model
- Location: `lib/openrouter.ts`
- Contains: OpenRouter API client, prompt construction
- Depends on: `lib/pill-common.ts`, OpenRouter API
- Used by: API route (alternative to CV)

**Shared Layer:**
- Purpose: Common types, utilities, configuration
- Location: `lib/pill-common.ts`, `lib/types.ts`, `lib/utils.ts`
- Contains: Type definitions, prompt builder, utility functions
- Depends on: Nothing external
- Used by: All other layers

## Data Flow

### Primary Request Path (CV Pipeline)

1. **User selects image** — `ImagePicker` component (`components/image-picker.tsx:17-26`)
   - File input or camera capture triggers `handleFile()`
   - Calls `compressImage()` from `lib/compress.ts:12-52`
   - Normalizes to 1:1 square with white padding
   - Compresses JPEG quality (0.8 → 0.3) until < 5MB
   - Returns base64 data URL

2. **User triggers count** — `Home` component (`app/page.tsx:21-63`)
   - Creates `FormData` with `image` field (base64 string)
   - POSTs to `/api/count`

3. **Server processes image** — API route (`app/api/count/route.ts:6-36`)
   - Extracts base64 from FormData
   - Calls `countPillsWithCV()` from `lib/pill-cv.ts:49-134`

4. **CV Pipeline executes** — `pill-cv.ts:49-134`
   - Decodes base64 → RGBA Mat via jimp (`pill-cv.ts:136-153`)
   - Resizes if > 1024px (`pill-cv.ts:161-175`)
   - Generates 7 mask candidates:
     - Otsu threshold (light/dark foreground)
     - Adaptive threshold (light/dark foreground)
     - Background distance (3 scales: 0.85, 1.0, 1.25)
   - Scores each mask (`pill-cv.ts:438-467`)
   - Selects best mask, runs connected components
   - Distance transform for overlapping pill separation
   - Returns normalized {x, y} points

5. **Client renders result** — `page.tsx:42-54`
   - Filters invalid points, clamps to [0, 1]
   - Sets `count = points.length` (ignores server count)
   - Renders `ResultDisplay` → `AnnotatedImage`

6. **Canvas annotation** — `components/annotated-image.tsx:14-56`
   - Loads image into canvas
   - Handles devicePixelRatio for Retina
   - Draws numbered red circles at each pill center

### AI Pipeline (Alternative Path)

1. Same client flow as above
2. API route calls `countPills()` from `lib/openrouter.ts:5-63`
3. Builds prompt via `buildPillCountPrompt()` (`lib/pill-common.ts:54-77`)
4. Sends to OpenRouter API (model: `openai/gpt-5.5`, temperature: 0.1)
5. Uses `response_format: { type: "json_object" }` for guaranteed JSON
6. Parses response, validates structure
7. Returns to client (same post-processing as CV path)

**State Management:**
- React `useState` hooks in `app/page.tsx`
- No external state library
- State: `image` (base64), `result` (PillCountResult), `loading`, `error`
- Reset via `pickerKey` increment to force `ImagePicker` remount

## Key Abstractions

**PillCountResult:**
- Purpose: Unified result type for both CV and AI pipelines
- Definition: `lib/pill-common.ts:31-35`
- Shape: `{ count: number, points: PillPoint[], debug?: PillCountDebug }`
- Pattern: Shared interface used across client and server

**PillCVConfig:**
- Purpose: Configurable CV pipeline parameters
- Definition: `lib/pill-cv-config.ts:1-16`
- Shape: Thresholds, kernel sizes, iteration counts
- Pattern: Default config with partial override support

**OpenCVRuntime:**
- Purpose: Singleton OpenCV.js instance
- Definition: `lib/opencv-init.ts:1`
- Pattern: Lazy-loaded singleton with promise deduplication

## Entry Points

**Client Entry:**
- Location: `app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: Render UI, manage state, call API

**API Entry:**
- Location: `app/api/count/route.ts`
- Triggers: POST request to `/api/count`
- Responsibilities: Validate input, delegate to CV pipeline, return JSON

**Layout Entry:**
- Location: `app/layout.tsx`
- Triggers: Every page load
- Responsibilities: HTML shell, fonts, metadata, global styles

## Architectural Constraints

- **Threading:** Single-threaded Node.js server; OpenCV.js runs synchronously in request handler (no worker threads)
- **Global state:** OpenCV runtime singleton in `lib/opencv-init.ts` (module-level `cvReady` and `cvLoading` variables)
- **Circular imports:** None detected — clean dependency flow: components → lib → external packages
- **Memory:** OpenCV Mat objects require manual `.delete()` — all allocations wrapped in try/finally cleanup
- **Image size:** Hardcoded limits: 5MB file size, 2048px max dimension (client), 1024px max dimension (CV processing)

## Anti-Patterns

### Duplicate Type Definitions

**What happens:** `PillPoint`, `PillCountResult`, and `isPillCountResult` are defined in both `lib/types.ts` and `lib/pill-common.ts`
**Why it's wrong:** Confusion about which to import; risk of divergence
**Do this instead:** Use `lib/pill-common.ts` as the single source of truth (it has the richer `PillCountDebug` type); delete `lib/types.ts`

### Duplicate OpenCV Initialization

**What happens:** `lib/opencv-init.ts` and `lib/opencv/init.ts` are identical files with the same logic
**Why it's wrong:** Maintenance burden; changes must be made in two places
**Do this instead:** Keep only `lib/opencv-init.ts` (the one actually imported by `pill-cv.ts`); delete `lib/opencv/` directory or repurpose it

### Duplicate CV Config

**What happens:** `lib/pill-cv-config.ts` and `lib/opencv/config.ts` contain identical `PillCVConfig` interface and `DEFAULT_PILL_CV_CONFIG`
**Why it's wrong:** Same duplication issue as above
**Do this instead:** Keep only `lib/pill-cv-config.ts`; delete `lib/opencv/config.ts`

## Error Handling

**Strategy:** Catch-and-wrap with Vietnamese user-facing messages

**Patterns:**
- API route catches all errors, returns `{ error: string }` with appropriate status code (`app/api/count/route.ts:24-36`)
- CV pipeline throws Vietnamese error messages for image decode failures (`lib/pill-cv.ts:150-152`)
- Client displays error in red card (`app/page.tsx:121-127`)
- OpenCV init failures wrapped with Vietnamese message (`lib/pill-cv.ts:63-65`)
- OpenRouter errors include HTTP status in message (`lib/openrouter.ts:38-39`)

**Error Messages (Vietnamese):**
- Image decode failure: "Không thể đọc ảnh, vui lòng chọn ảnh khác"
- OpenCV init failure: "Không thể khởi tạo bộ xử lý ảnh"
- Generic fallback: "Không thể phân tích ảnh, vui lòng thử lại"

## Cross-Cutting Concerns

**Logging:** `console.error` for server errors, `console.log` for raw AI responses (truncated to 500 chars)
**Validation:** Basic — checks for presence of image string, validates JSON structure from AI
**Authentication:** None — public endpoint, no auth required
**Caching:** None — every request processes fresh
**Rate Limiting:** None implemented

---

*Architecture analysis: 2026-05-28*
