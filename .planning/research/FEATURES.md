# Feature Landscape: Pill Counter CLI

**Domain:** Batch image processing CLI for computer vision pill counting
**Researched:** 2026-05-28
**Confidence:** MEDIUM-HIGH (patterns from 10+ CLI tools analyzed)

## Table Stakes

Features users expect. Missing = tool is useless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Folder scanning** | Core premise — batch process all images in a folder | Low | Accept folder path as positional arg or `-i/--input` |
| **Per-image pill count** | Primary output — "how many pills per image" | Low | JSON object per image with `filename`, `count`, `status` |
| **Aggregate total** | Summary view — total pills across all images | Low | Sum of per-image counts in final JSON |
| **Annotated output images** | Visual verification — user must see what was detected | Med | Red dot at center + sequence number on each pill |
| **Output directory** | Don't modify input files — write to separate folder | Low | `-o/--output`, default `./output/` |
| **Exit codes** | Scriptable — 0=success, 1=error, 2=partial failure | Low | Standard CLI convention, enables `&&` chaining |
| **Error handling per file** | One bad image shouldn't kill entire batch | Low | Skip + log error, continue processing remaining files |
| **Standard image formats** | Users have JPG, PNG, possibly TIFF from scanners | Low | Use OpenCV's `imread` — handles most formats natively |
| **Help text** | Every CLI needs `--help` | Low | `argparse` or `click` generates this automatically |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Debug mode (`--debug`)** | Save intermediate images (threshold, morphology, distance transform, watershed markers) for pipeline tuning | Med | Saves to `./debug/` subfolder. Critical for iterating on CV params |
| **Verbose/quiet (`-v/-q`)** | Progress for humans, silence for scripts | Low | `-v` shows per-image status, `-q` suppresses all except errors |
| **JSON output to stdout** | Pipe to `jq`, other tools | Low | `--json` flag or default when `-q` |
| **CSV export** | Spreadsheet-friendly output | Low | `--csv results.csv` alongside JSON |
| **Configurable CV params** | Different pill sizes, backgrounds need different thresholds | Med | `--min-area`, `--max-area`, `--circularity`, `--bg-color` |
| **Background auto-detection** | White paper vs silver tray — auto-detect from corners | Med | Sample 4 corners, determine background color/type |
| **Progress bar** | Visual feedback for large batches | Low | `tqdm` or rich progress — shows current/total |
| **`--dry-run`** | Preview which files will be processed without running CV | Low | List files, show estimated count, no output written |
| **Recursive scanning (`-R`)** | Process nested folder structures | Low | Common in batch tools, flag `--recursive` |
| **Summary statistics** | Min/max/avg count per image, detect outliers | Low | Post-processing step, cheap to compute |
| **`--background` hint** | User specifies "white" or "silver" to skip auto-detect | Low | Simple flag that sets threshold strategy |
| **Timing report** | Show processing time per image + total | Low | Useful for performance tuning |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **ML/AI models** | Out of scope — controlled environment = classical CV is sufficient | Stick to OpenCV pipeline. If CV fails on edge cases, document the limitation |
| **Real-time / webcam mode** | Different tool, different UX — batch is the core loop | If needed later, separate CLI command |
| **Interactive / wizard mode** | Adds complexity, breaks scriptability | Use flags + defaults. If needed, wrap in shell script |
| **Web UI** | Out of scope — this is a dev/debug CLI | The Next.js app already exists for UI |
| **Multiple pill types per image** | Classical CV can't distinguish pill types reliably | Document as limitation. V2 if needed |
| **Overlapping pill handling** | Requires 3D reasoning or ML — out of scope for classical CV | Document as limitation. Accept ±1 error on overlap |
| **Image format conversion** | Not the tool's job — use ImageMagick/Pillow | Focus on counting, not image manipulation |
| **Model download / first-run setup** | Offline-first, zero-config after `pip install` | Pure OpenCV, no model files |
| **Plugin system** | Premature abstraction for a focused tool | Hardcode pipeline, refactor later if needed |
| **Database / history** | Stateless is simpler — JSON files are the "database" | Output JSON per run, user manages files |
| **GUI preview / viewer** | Opens a can of worms — windowing, event loops | Annotated images are the preview. Open with OS viewer |
| **Image cropping / rotation** | Pre-processing is user's responsibility | Document expected input: top-down, centered, good lighting |

## Feature Dependencies

```
folder-scanning → per-image-count → aggregate-total
                                    → annotated-output
                                    → error-handling-per-file

output-directory (required by all output features)

debug-mode → intermediate-images (threshold, morphology, watershed)

configurable-params → background-auto-detect (--bg-color overrides auto)

verbose/quiet → progress-bar (progress only in verbose mode)

json-output → csv-export (csv is derived from json data)

recursive-scanning → folder-scanning (extends it)
```

## MVP Recommendation

### Prioritize (v0.1 — get counting working)

1. **Folder scanning** — core loop, must work first
2. **Per-image pill count** — the actual counting
3. **Annotated output images** — visual proof it works
4. **Output directory** — don't corrupt inputs
5. **Error handling per file** — one bad image ≠ total failure
6. **JSON report** — structured output for downstream use
7. **`--help`** — basic usability

### Add next (v0.2 — make it usable)

8. **Debug mode** — essential for tuning CV pipeline
9. **Verbose/quiet** — UX polish
10. **Progress bar** — UX polish for large batches
11. **Background auto-detect** — white paper vs silver tray
12. **`--min-area` / `--max-area`** — tune for pill size

### Defer (v0.3+ — nice to have)

13. CSV export — easy to add, low priority
14. Summary statistics — easy to add
15. Recursive scanning — rarely needed for single batch
16. `--dry-run` — rarely needed
17. Timing report — rarely needed

### Explicitly NOT building

- ML models, real-time mode, web UI, interactive wizards
- Image format conversion, model downloads, database
- Multiple pill types, overlapping pills, GUI preview

## Sources

- **batch_img** (PyPI) — batch image processing CLI patterns, subcommand structure
- **bat-img** (PyPI) — multithreaded batch processor, CLI flag conventions
- **py-image-toolkit** (GitHub) — batch resize/crop/OCR CLI patterns
- **imgeda** (PyPI) — image dataset analysis CLI, JSONL output, progress bars
- **E-Shelter_ObjectCount** (GitHub) — OpenCV object counting CLI, CSV/JSON export, folder-based processing
- **ultralytics/ultralytics** — YOLO CLI conventions, solutions pattern
- **Project context**: `.planning/PROJECT.md` — requirements, constraints, out-of-scope items
- **CV research**: `plans/research_pill_cv.md` — pipeline options, edge cases, OpenCV functions
