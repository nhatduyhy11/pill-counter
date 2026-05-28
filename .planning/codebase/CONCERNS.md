# Codebase Concerns

**Analysis Date:** 2026-05-28

## Tech Debt

### Duplicate Type Definitions

- Issue: `PillPoint`, `PillCountResult`, and `isPillCountResult()` are defined identically in both `lib/types.ts` and `lib/pill-common.ts`. `PillCountCandidateDebug` and `PillCountDebug` are defined in both `lib/pill-common.ts` and `lib/opencv/types.ts`.
- Files: `lib/types.ts`, `lib/pill-common.ts`, `lib/opencv/types.ts`
- Impact: Drift risk — changing one copy without the other causes silent type mismatches. Confusing for developers about which to import.
- Fix approach: Consolidate into a single canonical source (`lib/types.ts` or `lib/pill-common.ts`). Delete the duplicate. Update all imports.

### Duplicate OpenCV Config

- Issue: `PillCVConfig` interface and `DEFAULT_PILL_CV_CONFIG` are defined identically in both `lib/pill-cv-config.ts` and `lib/opencv/config.ts`.
- Files: `lib/pill-cv-config.ts`, `lib/opencv/config.ts`
- Impact: Same drift risk as above. Two files with identical content create maintenance confusion.
- Fix approach: Keep one (recommend `lib/pill-cv-config.ts` as the canonical config since `lib/pill-cv.ts` imports from it). Delete `lib/opencv/config.ts` or make it re-export from the canonical source.

### Duplicate OpenCV Init Module

- Issue: `lib/opencv-init.ts` and `lib/opencv/init.ts` contain identical code for `getCV()`, `loadCV()`, `isReadyCV()`, etc.
- Files: `lib/opencv-init.ts`, `lib/opencv/init.ts`
- Impact: Same module-level singleton pattern duplicated. Changes to initialization logic must be applied in two places.
- Fix approach: Keep one canonical location (recommend `lib/opencv/init.ts` as the organized path). Update `lib/pill-cv.ts` import to use it. Delete `lib/opencv-init.ts`.

### `lib/opencv/` Directory Appears Abandoned

- Issue: The `lib/opencv/` directory contains `config.ts`, `init.ts`, and `types.ts` that duplicate files already in `lib/`. The main consumer `lib/pill-cv.ts` imports from `lib/pill-cv-config.ts` and `lib/opencv-init.ts` (the root-level copies), not from `lib/opencv/`.
- Files: `lib/opencv/config.ts`, `lib/opencv/init.ts`, `lib/opencv/types.ts`
- Impact: Dead code / confusing structure. New developers may import from the wrong location.
- Fix approach: Either migrate all imports to use `lib/opencv/` and delete root-level duplicates, or delete `lib/opencv/` entirely.

## Security Considerations

### No Rate Limiting on API Route

- Risk: The `/api/count` endpoint has no rate limiting. Each request triggers an expensive OpenCV pipeline + external AI API call. An attacker could exhaust API credits or cause denial of service.
- Files: `app/api/count/route.ts`
- Current mitigation: None.
- Recommendations: Add rate limiting middleware (e.g., `next-rate-limit` or a simple in-memory token bucket). Consider per-IP limits and global throughput caps.

### No Request Size Limit Validation

- Risk: The API route accepts `formData` with a base64 image string. While client-side compression limits to 5MB, the server does not enforce a maximum payload size. A direct API caller could send arbitrarily large payloads.
- Files: `app/api/count/route.ts`
- Current mitigation: Client-side compression in `lib/compress.ts` limits to ~5MB, but this is bypassable.
- Recommendations: Add server-side validation of the base64 string length before processing. Set Next.js `api.bodyParser.sizeLimit` or use middleware to cap request size.

### Debug Mode Exposed in Non-Production

- Risk: The debug flag at `app/api/count/route.ts:18-20` is enabled when `NODE_ENV !== "production"` OR when `?debug=1` query param is present. The `?debug=1` bypass works even in production, exposing internal CV pipeline details (foreground ratios, component counts, candidate scores).
- Files: `app/api/count/route.ts`
- Current mitigation: None for the query param bypass.
- Recommendations: Remove the `?debug=1` query param option from production, or gate it behind authentication.

### AI Prompt Injection Surface

- Risk: The AI prompt in `buildPillCountPrompt()` is static and does not incorporate user input, so direct prompt injection is not possible. However, the image content itself is sent to the AI — a malicious image could contain text instructing the AI to behave differently.
- Files: `lib/pill-common.ts`, `lib/openrouter.ts`
- Current mitigation: The prompt uses `response_format: { type: "json_object" }` which constrains output format. Temperature is low (0.1).
- Recommendations: Low risk currently, but monitor for adversarial images. Consider adding output validation beyond the current type checks.

### API Key Exposure in Error Messages

- Risk: The OpenRouter error handler at `lib/openrouter.ts:38-39` includes the raw response body in the error message: `throw new Error(\`OpenRouter error: ${res.status} ${err}\`)`. If the API returns sensitive info in error bodies, it could leak to the client.
- Files: `lib/openrouter.ts`
- Current mitigation: The API route's catch block at `app/api/count/route.ts:27-30` filters error messages — only messages starting with "Không thể" are passed through; all others become a generic message. This mitigates the leak.
- Recommendations: Still worth cleaning up — log the full error server-side but throw a sanitized message.

## Performance Bottlenecks

### OpenCV Initialization Polling

- Problem: The OpenCV runtime initialization in `lib/opencv-init.ts:63-77` uses a 25ms polling interval with `setTimeout` to check if the runtime is ready. This is a busy-wait pattern that wastes CPU.
- Files: `lib/opencv-init.ts`
- Cause: The `@techstark/opencv-js` library's initialization callback pattern requires polling as a fallback.
- Improvement path: The code already handles the `onRuntimeInitialized` callback (line 58-61), so polling is a fallback. Consider removing the poll or increasing the interval to 100-200ms.

### Large Image Processing Blocks Event Loop

- Problem: The CV pipeline in `lib/pill-cv.ts` processes images synchronously on the Node.js event loop. For large images (up to 1024px after resize), the pixel-level loops in `createBackgroundDistanceMask()` (line 366-372), `getBorderForegroundRatio()` (line 703-712), and `sampleBorderRgb()` (line 728-739) can block for hundreds of milliseconds.
- Files: `lib/pill-cv.ts`
- Cause: Synchronous pixel iteration over potentially 1M+ pixels.
- Improvement path: Consider offloading to a worker thread, or optimize by reducing the image dimension further for background estimation passes.

### No Request Deduplication on Client

- Problem: The client page at `app/page.tsx` has no mechanism to prevent duplicate submissions. A user could click "Đếm thuốc" multiple times while a request is in flight, creating redundant expensive API calls.
- Files: `app/page.tsx`
- Cause: The `loading` state disables the button, but rapid clicks before state updates could trigger multiple calls.
- Improvement path: The `disabled={!image || loading}` check at line 100 should prevent this in practice. Low priority.

## Missing Critical Features

### Zero Test Coverage

- Problem: No test files exist anywhere in the codebase. No test framework is configured (no jest.config, vitest.config, or test scripts in package.json).
- Files: Entire codebase
- Blocks: Confidence in refactoring, regression detection, CI/CD pipeline.
- Priority: **High** — The CV pipeline has complex algorithmic logic (mask scoring, component analysis, distance transform markers) that is error-prone to modify without tests.

### No Error Boundary

- Problem: The app has no React error boundary. If `AnnotatedImage` canvas rendering throws (e.g., invalid image data), the entire app crashes with a white screen.
- Files: `app/page.tsx`, `components/annotated-image.tsx`
- Blocks: User experience on unexpected errors.
- Priority: Medium

### No Loading/Error States for Image Processing

- Problem: The `ImagePicker` component at `components/image-picker.tsx:23-25` silently swallows image processing errors with only a `console.error`. The user gets no feedback when image compression fails.
- Files: `components/image-picker.tsx`
- Blocks: User understanding of failures.
- Priority: Medium

## Fragile Areas

### OpenCV Memory Management

- Files: `lib/pill-cv.ts`
- Why fragile: The code manually manages OpenCV `Mat` objects with `.delete()` calls in `try/finally` blocks. Any code path that misses a `.delete()` causes a memory leak. The current code appears correct, but adding new CV operations requires extreme care.
- Safe modification: Always wrap new Mat allocations in try/finally with explicit `.delete()` calls. Follow the existing pattern in `countPillsInMask()` (line 485-556).
- Test coverage: None — memory leaks are invisible without profiling.

### AI Response Parsing

- Files: `lib/openrouter.ts`
- Why fragile: The AI response is parsed as raw JSON from the LLM output (line 50). While `response_format: { type: "json_object" }` helps, the code trusts the AI's `count` field but then the client at `app/page.tsx:42-53` recalculates count from `points.length` — meaning the AI's count value is ignored. If the AI returns mismatched count vs points array length, the behavior is inconsistent.
- Safe modification: The current client-side recalculation is actually the safer approach. Keep this pattern.
- Test coverage: None.

### Base64 Image Handling

- Files: `lib/compress.ts`, `lib/pill-cv.ts`
- Why fragile: The compression at `lib/compress.ts:31` uses non-null assertion `ctx!` which will throw if canvas context is null (rare but possible on low-memory devices). The base64 regex at `lib/pill-cv.ts:137` handles both raw base64 and data-URL formats, but `lib/compress.ts:55` only handles data-URL format.
- Safe modification: Always validate base64 format before processing.
- Test coverage: None.

## Console.log Statements

**Production log to remove:**
- `lib/openrouter.ts:46` — `console.log("Raw AI response:", text.slice(0, 500))` — This logs AI responses (potentially large, potentially sensitive) in production. **Remove or gate behind debug flag.**

**Acceptable error logging (keep):**
- `lib/pill-cv.ts:63` — `console.error("OpenCV init error:", error)` — Server-side error logging, appropriate.
- `lib/pill-cv.ts:150` — `console.error("Image decode error:", error)` — Server-side error logging, appropriate.
- `app/api/count/route.ts:25` — `console.error("Count error:", error)` — Server-side error logging, appropriate.
- `components/image-picker.tsx:24` — `console.error("Failed to process image:", err)` — Client-side, should be replaced with user-facing error state.

## Lint Suppression

- `components/image-picker.tsx:81` — `eslint-disable-next-line @next/next/no-img-element` — Uses raw `<img>` instead of Next.js `<Image>`. Justified because the src is a dynamic base64 data URL, which `next/image` doesn't support well. Acceptable.

## Scalability Concerns

### Single-Threaded CV Processing

- Current capacity: One image processed at a time per server instance.
- Limit: Under concurrent load, multiple OpenCV pipelines compete for the same event loop, causing all requests to slow down.
- Scaling path: Use Node.js worker threads (`worker_threads`) to isolate CV processing. Each request gets its own worker, preventing event loop starvation.

### OpenCV-JS Bundle Size

- Current capacity: `@techstark/opencv-js` is a ~8MB WASM module loaded on first request.
- Limit: Cold starts are slow (10s timeout configured). Memory usage grows with concurrent processing.
- Scaling path: Pre-load OpenCV on server startup instead of lazy-loading on first request. Consider server-side native OpenCV via Python subprocess for production deployments.

## Dependencies at Risk

### `@techstark/opencv-js` 4.12.0-release.1

- Risk: Pinned to a pre-release version (`release.1`). Pre-release versions may have bugs or breaking API changes in the final release.
- Impact: If the package is yanked or has a critical bug, the entire pill counting pipeline breaks.
- Migration plan: Monitor for stable release. Consider `opencv.js` (official) or server-side OpenCV via Python as alternatives.

### `jimp` ^1.6.1

- Risk: Jimp is used only for image decoding (reading bitmap data from buffer). It's a large library for a simple task.
- Impact: Bundle size overhead.
- Migration plan: Consider `sharp` (native, faster) for server-side image decoding, or use the browser's `createImageBitmap` on the client side.

## Missing Documentation

### No API Documentation

- Problem: The `/api/count` endpoint has no OpenAPI/Swagger spec, no request/response examples, and no error code documentation.
- Files: `app/api/count/route.ts`

### No Environment Setup Guide

- Problem: `OPENROUTER_API_KEY` is required but there's no `.env.example` file documenting required environment variables.
- Files: None (missing file)

---

*Concerns audit: 2026-05-28*
