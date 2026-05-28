# Testing Patterns

**Analysis Date:** 2026-05-28

## Test Framework

**Status:** No test framework is configured.

**Runner:** None
- No `jest.config.*`, `vitest.config.*`, or `playwright.config.*` found
- No test-related dependencies in `package.json`
- No test scripts in `package.json` (`scripts` only has `dev`, `build`, `start`, `lint`)

**Assertion Library:** None configured

**Run Commands:**
```bash
# No test commands available. To add testing:
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
# or
pnpm add -D jest @types/jest @testing-library/react @testing-library/jest-dom
```

## Test File Organization

**Location:** No test files exist

**Current file count:**
- Source files: 15 (`.ts` and `.tsx` in `app/`, `components/`, `lib/`)
- Test files: 0

**Recommended structure (when added):**
```
pill-counter/
├── lib/
│   ├── __tests__/
│   │   ├── pill-common.test.ts
│   │   ├── pill-cv.test.ts
│   │   ├── compress.test.ts
│   │   └── openrouter.test.ts
│   └── ...
├── components/
│   ├── __tests__/
│   │   ├── image-picker.test.tsx
│   │   ├── annotated-image.test.tsx
│   │   └── result-display.test.tsx
│   └── ...
└── app/
    └── api/
        └── count/
            └── __tests__/
                └── route.test.ts
```

## Test Coverage

**Current coverage:** 0% — No tests exist

**Coverage requirements:** None enforced

**Coverage config:** `.gitignore` includes `/coverage` directory, suggesting coverage reports were anticipated but never set up.

## What Should Be Tested

Based on codebase analysis, these are the critical testable units:

### High Priority (Core Logic)

**`lib/pill-common.ts`:**
- `buildPillCountPrompt()` — returns correct prompt string
- `isPillCountResult()` — type guard validation
  - Valid input returns `true`
  - Missing `count` returns `false`
  - Missing `points` returns `false`
  - Invalid point structure returns `false`
  - Null/undefined returns `false`

**`lib/pill-cv.ts`:**
- `countPillsWithCV()` — end-to-end pill counting
  - Requires OpenCV mock (complex)
  - Test with known image fixtures
  - Test empty image returns `{ count: 0, points: [] }`
  - Test debug mode returns debug info

**`lib/compress.ts`:**
- `compressImage()` — client-side image compression
  - Requires DOM mocks (canvas, FileReader, Image)
  - Test image resizing when > MAX_DIMENSION
  - Test quality reduction loop
  - Test 1:1 square normalization
- `base64ToGenerativePart()` — base64 parsing
  - Valid base64 data URL returns correct mimeType and data
  - Invalid format throws error

**`lib/openrouter.ts`:**
- `countPills()` — OpenRouter API integration
  - Requires fetch mock
  - Test successful response parsing
  - Test API error handling
  - Test empty response handling
  - Test invalid JSON response

### Medium Priority (Components)

**`components/image-picker.tsx`:**
- File selection triggers `onImageSelected` callback
- Camera input has `capture="environment"` attribute
- Preview displays after selection
- Clear button resets state
- Disabled state prevents interaction

**`components/result-display.tsx`:**
- Renders count badge with correct number
- Passes points to AnnotatedImage

**`components/annotated-image.tsx`:**
- Canvas draws correct number of markers
- Handles window resize
- Handles empty points array

### Lower Priority (Integration)

**`app/api/count/route.ts`:**
- POST returns 400 for missing image
- POST returns 500 for processing errors
- POST returns pill count result on success
- Debug flag behavior in non-production

## Suggested Test Setup

### Vitest (Recommended)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
});
```

```typescript
// test/setup.ts
import "@testing-library/jest-dom";
```

```json
// package.json scripts
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### Test Utilities Needed

```typescript
// test/helpers.ts
export function createMockFile(
  name: string = "test.jpg",
  type: string = "image/jpeg",
  size: number = 1024
): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

export function createBase64Image(width: number = 100, height: number = 100): string {
  // Create a minimal valid JPEG base64 string for testing
  return "data:image/jpeg;base64,/9j/4AAQSkZJRg...";
}
```

## Mocking Strategy

**OpenCV (`@techstark/opencv-js`):**
```typescript
// Complex dependency — requires careful mocking
vi.mock("@techstark/opencv-js", () => ({
  Mat: vi.fn(),
  // ... mock OpenCV functions
}));
```

**Fetch (for API tests):**
```typescript
global.fetch = vi.fn();
```

**Canvas API (for component tests):**
```typescript
// jsdom provides basic canvas, may need additional mocks
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
  // ... other canvas methods
}));
```

**FileReader / Image (for compress.ts):**
```typescript
// Requires jsdom environment
// Mock FileReader.onload behavior
```

## CI/CD Test Integration

**Status:** No CI/CD pipeline configured

**No `.github/workflows/` directory found.** No Vercel/Netlify config files found.

**Recommended GitHub Actions workflow:**
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
```

## Current Quality Assurance

**Without tests, quality is maintained through:**
1. TypeScript strict mode catches type errors at build time
2. ESLint with Next.js rules catches common React issues
3. `pnpm build` runs type-checking as part of the build
4. Manual testing with test images in `test-img/` directory

**Test images directory:** `test-img/` exists (gitignored or empty based on git log mentioning "add test img")

## Coverage Gaps (Risk Assessment)

| Area | Risk Level | Reason |
|------|-----------|--------|
| `pill-cv.ts` (760 lines) | **High** | Complex image processing logic, no tests, hard to debug regressions |
| `openrouter.ts` | **High** | External API integration, error handling depends on correct parsing |
| `compress.ts` | **Medium** | Browser API dependent, edge cases in compression loop |
| `pill-common.ts` | **Medium** | Type guard correctness critical for data validation |
| Components | **Low** | Simple presentational components, visual inspection sufficient |
| API route | **Low** | Thin wrapper, delegates to `pill-cv.ts` |

---

*Testing analysis: 2026-05-28*
