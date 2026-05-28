# Coding Conventions

**Analysis Date:** 2026-05-28

## Languages

**Primary:**
- TypeScript 5.x — All source files (`.ts`, `.tsx`)
- Target: ES2017
- Strict mode: **enabled** (`"strict": true` in `tsconfig.json`)

**Secondary:**
- CSS — Tailwind CSS v4 utility classes (no custom CSS beyond `globals.css`)

## Formatting

**Tool:** None configured (no Prettier, no Biome, no `.editorconfig`)

**Observed conventions (follow these):**
- **Indentation:** 2 spaces (not tabs)
- **Semicolons:** Omitted in shadcn UI files (`components/ui/*.tsx`), used in application code (`lib/*.ts`, `app/*.tsx`, `components/*.tsx`)
- **Quotes:** Double quotes for strings in TypeScript, single quotes in some shadcn-generated files
- **Trailing commas:** Yes in multi-line arrays/objects
- **Line length:** No enforced limit; lines stay under ~100 chars naturally

**Recommendation:** Follow the pattern of the file you're editing. New application files should use **semicolons and double quotes**.

## Linting

**Tool:** ESLint 9 with flat config (`eslint.config.mjs`)

**Config:**
```javascript
// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

**Run command:** `pnpm lint`

**Key rules:** Inherits from `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. No custom rule overrides.

## TypeScript Configuration

**File:** `tsconfig.json`

**Key settings:**
| Setting | Value | Implication |
|---------|-------|-------------|
| `strict` | `true` | All strict checks enabled (noImplicitAny, strictNullChecks, etc.) |
| `noEmit` | `true` | TypeScript only for type-checking, Next.js handles compilation |
| `moduleResolution` | `"bundler"` | Modern resolution, supports `@/` aliases |
| `jsx` | `"react-jsx"` | Automatic JSX transform (no `import React` needed) |
| `isolatedModules` | `true` | Each file must be independently compilable |

**Path aliases:**
- `@/*` → `./*` (project root)
- Use `@/components/...`, `@/lib/...` for all imports

## Import Organization

**Order (follow this pattern):**
1. React/Next.js built-in imports
2. Third-party library imports
3. `@/` aliased imports (components, lib)
4. Relative imports (`./`, `../`)

**Examples from codebase:**
```typescript
// app/page.tsx
import { useState } from "react";                          // React
import { Button } from "@/components/ui/button";            // UI components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePicker } from "@/components/image-picker";    // App components
import { type PillCountResult } from "@/lib/pill-common";   // Lib types
```

```typescript
// lib/pill-cv.ts
import { Jimp } from "jimp";                               // Third-party
import type { Mat } from "@techstark/opencv-js";            // Third-party types
import { DEFAULT_PILL_CV_CONFIG, type PillCVConfig } from "./pill-cv-config"; // Relative
import { getCV, type OpenCVRuntime } from "./opencv-init";  // Relative
import type { PillCountDebug, PillCountResult, PillPoint } from "./pill-common";
```

**Type-only imports:** Use `import type` for type-only imports:
```typescript
import type { Mat } from "@techstark/opencv-js";
import { type PillCountResult } from "@/lib/pill-common";
```

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` — `image-picker.tsx`, `annotated-image.tsx`, `result-display.tsx`
- Library modules: `kebab-case.ts` — `pill-common.ts`, `pill-cv.ts`, `opencv-init.ts`
- Config files: `kebab-case.config.ts` — `pill-cv-config.ts`
- UI components: `kebab-case.tsx` — `button.tsx`, `card.tsx`, `badge.tsx`

**Components:**
- PascalCase function components — `ImagePicker`, `AnnotatedImage`, `ResultDisplay`, `Button`, `Card`
- Named exports (not default) for components: `export function ImagePicker`
- Default exports for pages only: `export default function Home()`

**Functions:**
- camelCase — `compressImage`, `countPillsWithCV`, `buildPillCountPrompt`, `getCV`
- Private/module-level functions: camelCase, no prefix — `decodeBase64Image`, `cleanupMask`, `scoreMask`

**Types/Interfaces:**
- PascalCase — `PillCountResult`, `PillPoint`, `PillCVConfig`, `ImagePickerProps`
- Props interfaces: `{ComponentName}Props` — `ImagePickerProps`, `AnnotatedImageProps`, `ResultDisplayProps`
- No `I` prefix for interfaces

**Constants:**
- UPPER_SNAKE_CASE for true constants — `MAX_FILE_SIZE`, `MAX_DIMENSION`, `QUALITY_STEP`, `DEFAULT_PILL_CV_CONFIG`
- camelCase for module-level state — `cvReady`, `cvLoading`

**Variables:**
- camelCase — `imageBase64`, `foregroundRatio`, `candidateScores`

## Component Patterns

**File structure:**
```typescript
"use client";  // Only for client components (at top of file)

import { ... } from "...";

interface ComponentNameProps {
  // Props definition
}

export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // Component logic
  return (
    <div>...</div>
  );
}
```

**Props typing:**
- Define a dedicated `interface` for props (not inline)
- Use destructuring in function signature
- Optional props use `?` — `disabled?: boolean`
- For shadcn components, extend primitive props: `React.ComponentProps<"div">`

**State management:**
- `useState` for local state — no external state library
- State shape: `const [image, setImage] = useState<string | null>(null)`
- Loading/error pattern: separate `loading` and `error` state variables

**Client vs Server:**
- Mark client components explicitly: `"use client"` at top of file
- Server components (layout, API routes) have no directive
- API routes use `export const runtime = "nodejs"` for server-only packages

## Error Handling

**Pattern (API route):**
```typescript
// app/api/count/route.ts
try {
  // ... logic
  return NextResponse.json(result);
} catch (error) {
  console.error("Count error:", error);
  const message =
    error instanceof Error && error.message.startsWith("Không thể")
      ? error.message
      : "Không thể phân ảnh, vui lòng thử lại";
  return NextResponse.json({ error: message }, { status: 500 });
}
```

**Pattern (client component):**
```typescript
// app/page.tsx
try {
  const res = await fetch("/api/count", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không thể phân tích ảnh");
  // ... success handling
} catch (err) {
  setError(err instanceof Error ? err.message : "Fallback error message");
} finally {
  setLoading(false);
}
```

**Pattern (library function):**
```typescript
// lib/openrouter.ts
if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${err}`);
if (!text) throw new Error("Empty response from AI");
```

**Key rules:**
- Always use `try/catch` with `finally` for cleanup
- Use `instanceof Error` to check error type
- Vietnamese user-facing error messages
- `console.error` for server-side logging
- Never expose internal error details to client

## Logging

**Framework:** `console.log` / `console.error` (no structured logging library)

**Patterns:**
- `console.error` for errors: `console.error("Count error:", error)`
- `console.log` for debug: `console.log("Raw AI response:", text.slice(0, 500))`
- Debug output controlled by `config.debug` flag in CV processing

## Comments

**When to comment:**
- Explain non-obvious logic: `// Normalize to 1:1 square — center image with white padding`
- Inline comments for clarity: `// count from AI ignored, client uses points.length`
- ESLint disable comments when necessary: `{/* eslint-disable-next-line @next/next/no-img-element */}`

**JSDoc/TSDoc:** Not used in this codebase. Prefer self-documenting code.

## Function Design

**Size:** Functions are kept focused. The largest file (`pill-cv.ts`, 760 lines) has many small private functions (30-80 lines each).

**Parameters:**
- Destructure object params for multiple args: `function countPillsWithCV(imageBase64: string, options: CountOptions = {})`
- Use interfaces for complex params: `interface CountOptions { debug?: boolean; config?: Partial<PillCVConfig> }`

**Return values:**
- Use explicit return types for public APIs: `Promise<PillCountResult>`
- Return objects for multiple values: `{ mat: Mat; owned: boolean }`

## Module Design

**Exports:**
- Public functions: named exports at top of file
- Types: export alongside or from dedicated `types.ts`
- No barrel files (`index.ts`) used

**Deduplication:**
- `lib/pill-common.ts` — shared types and prompt (used by both client and server)
- `lib/types.ts` — exists but appears to be an older version; prefer `lib/pill-common.ts`

## CSS/Styling

**Framework:** Tailwind CSS v4 with `@tailwindcss/postcss`

**Component library:** shadcn/ui (base-nova style)
- Add components: `pnpx shadcn@latest add <component>`
- Config: `components.json`
- Style utility: `cn()` from `lib/utils.ts` (clsx + tailwind-merge)

**Pattern:**
```typescript
import { cn } from "@/lib/utils"

<div className={cn("base-classes", conditionalClass && "conditional", className)}>
```

**Dark mode:** Uses `.dark` class variant (not media query)
```css
@custom-variant dark (&:is(.dark *));
```

## Git Commit Messages

**Observed pattern:** Lowercase, no conventional commits, concise descriptions:
```
get-shit-done
refactor lib to opencv and apirouter, add test img
switch to offline open-cv controlled background
update docs
switch to openrouter, add test-case
Initial commit from Create Next App
```

**Style:** Short imperative or descriptive phrases. No prefix (feat/fix/chore). Vietnamese or English mixed.

## Environment Variables

**Required:**
- `OPENROUTER_API_KEY` — OpenRouter API key (in `.env.local`)

**Runtime detection:**
```typescript
process.env.NODE_ENV !== "production"
```

**Note:** `.env*` files are gitignored. Never commit secrets.

## Next.js 16 Specifics

**Critical conventions:**
- `pnpm dev` uses Turbopack by default (no `--turbopack` flag needed)
- Use `eslint` directly, not `next lint` (removed in v16)
- Async Request APIs: `params`, `searchParams`, `cookies()`, `headers()` must be `await`ed
- ESLint flat config format (`eslint.config.mjs`)

---

*Convention analysis: 2026-05-28*
