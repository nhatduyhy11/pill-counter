# Pill Counter — CV Pipeline Prototype

## What This Is

Standalone Python CLI tool for batch pill counting using classical computer vision (OpenCV). Scans all images in a folder, counts pills with high accuracy, outputs JSON report + annotated images. This is a dev/debug tool to iterate on the CV pipeline independently from the Next.js app.

## Core Value

Exact pill count accuracy (0-1 off) on controlled-environment images. Everything else is secondary.

## Requirements

### Validated

- ✓ Next.js pill counter app exists — existing (app/)
- ✓ OpenCV.js integration exists — existing (lib/pill-cv.ts)
- ✓ OpenRouter AI integration exists — existing (lib/openrouter.ts)
- ✓ Codebase map complete — .planning/codebase/

### Active

- [ ] CLI can scan all images in a specified folder
- [ ] Each image is processed through OpenCV pipeline (threshold → morphology → watershed → contour filtering)
- [ ] Each detected pill gets a red dot at center + sequence number on annotated output
- [ ] JSON report with per-image count + total + metadata
- [ ] Annotated images saved to output folder
- [ ] Works on white paper background and silver medical tray (with mild reflection)
- [ ] Handles touching pills (watershed separation)
- [ ] Single pill type per image (uniform shape/size/color)

### Out of Scope

- AI/ML models or training — OpenCV classical CV only for prototype
- Multiple pill types per image — v2 if needed
- Overlapping pills (stacked) — classical CV can't handle this well
- Web UI or Next.js integration — standalone CLI only
- Real-time processing — batch mode only
- OpenRouter/Gemini fallback — prototype uses pure OpenCV

## Context

### Existing Codebase

- **Next.js app** in `app/` with API route `/api/count` using OpenCV.js (server-side WASM)
- **Current pipeline** in `lib/pill-cv.ts` (760 lines): grayscale → blur → threshold → morphology → connected components → contour filtering
- **Known issues:** accuracy not reliable, duplicate modules (`lib/opencv/` abandoned), no tests
- **Research document** at `plans/research_pill_cv.md` — detailed analysis of CV approaches

### Problem Constraints (from research)

- **Single pill type per image** — repeated shape counting, not object recognition
- **Controlled background** — white paper or silver medical tray (mild reflection OK)
- **No overlap** — pills don't stack, but may touch at edges
- **Same plane** — flat surface, fixed camera angle preferred
- **Pills mostly round/ellipse** — can use circularity, aspect ratio for filtering

### Technical Decisions

- **Python + OpenCV** — no training, no fine-tuning, pure classical CV
- **Pipeline:** Based on research `plans/research_pill_cv.md` Option B (General Background with Watershed)
- **Background handling:** Auto-detect from corners or user-specified color
- **Parameters:** Hardcoded with clear variable names for easy tuning

## Constraints

- **Language**: Python 3.10+ — prototype speed, OpenCV bindings
- **Dependencies**: opencv-python, numpy only — minimal
- **No ML**: No PyTorch/TensorFlow, no model downloads
- **Standalone**: Separate from Next.js app, own folder/repo
- **Batch only**: Process folder of images, not single image interactive

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Python over TypeScript | OpenCV Python bindings more mature, easier prototyping | — Pending |
| Classical CV over AI | Controlled environment + single pill type = CV is sufficient | — Pending |
| Watershed for touching pills | Research confirms distance transform + watershed is standard approach | — Pending |
| White/silver background | User's actual setup; HSV segmentation or adaptive threshold needed | — Pending |
| Hardcoded params with clear names | Prototype stage; refactor to config after validating pipeline works | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-28 after initialization*
