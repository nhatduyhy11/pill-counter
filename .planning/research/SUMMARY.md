# Project Research Summary

**Project:** Pill Counter CLI
**Domain:** Computer vision batch image processing (classical CV, no ML)
**Researched:** 2026-05-28
**Confidence:** HIGH

## Executive Summary

Pill Counter is a Python CLI tool that batch-processes images to count pills using classical OpenCV computer vision. The research consensus is clear: use a minimal stack (Python 3.12+, opencv-python, numpy, argparse, tqdm) with a pure-function CV pipeline architecture. The pipeline takes numpy arrays in, returns pill counts and center coordinates out — no file I/O inside the CV logic. This keeps the pipeline testable with synthetic images and separates concerns cleanly across 6 modules: cli, batch, pipeline, annotator, reporter, config.

The critical technical risk is watershed over-segmentation and distance transform sensitivity — these are the #1 causes of wrong counts in every OpenCV pill-counting implementation reviewed. The research identifies 8 critical pitfalls (marker label confusion, threshold direction, Otsu failures on non-bimodal images, etc.) that must be handled correctly in Phase 1 to avoid rewriting the pipeline later. Background auto-detection from corner sampling is fragile when pills are at edges; a robust fallback strategy is essential.

The recommended approach is a 4-phase build: (1) core pipeline with synthetic test images, (2) single-image CLI validation on real photos, (3) batch mode with JSON reporting, (4) polish features (debug mode, progress bars, config overrides). Each phase has clear deliverables and specific pitfalls to avoid. The existing TypeScript pipeline (`lib/pill-cv.ts`) has portable logic worth adapting, particularly the 7-candidate mask scoring approach for handling varied backgrounds.

## Key Findings

### Recommended Stack

Minimal dependencies, zero bloat. The research strongly recommends against adding click/typer (overkill for single-command CLI), scikit-image (slower than OpenCV), or Pillow (unnecessary — OpenCV handles all common formats).

**Core technologies:**
- **Python 3.12+**: Current stable, best OpenCV/numpy compatibility — use 3.12 as the floor
- **opencv-python 4.13.x**: All CV functions needed (watershed, morphology, distance transform, contours) — do NOT use contrib package
- **numpy 2.4.x**: Required dependency, OpenCV images are numpy arrays
- **argparse (stdlib)**: Built-in CLI parsing, sufficient for `--input`, `--output`, `--verbose` flags
- **tqdm 4.67.x**: Progress bars for batch processing — use from day 1
- **uv**: Fast pip replacement (10-100x faster), use for dependency management
- **pyproject.toml (PEP 621)**: Modern project metadata, replaces setup.py/requirements.txt

### Expected Features

**Must have (table stakes):**
- Folder scanning — core batch processing loop
- Per-image pill count — primary output (filename, count, status)
- Aggregate total — sum across all images
- Annotated output images — red dot + sequence number on each pill for visual verification
- Output directory — never modify input files
- Exit codes — 0=success, 1=error, 2=partial failure for scriptability
- Error handling per file — one bad image doesn't kill the batch
- Standard image formats — JPG, PNG, BMP, TIFF via OpenCV imread

**Should have (differentiators):**
- Debug mode (`--debug`) — save intermediate images (threshold, morphology, watershed markers) for pipeline tuning
- Verbose/quiet (`-v/-q`) — progress for humans, silence for scripts
- JSON output — structured report per run
- Configurable CV params (`--min-area`, `--max-area`, `--circularity`)
- Background auto-detect — sample corners to determine white paper vs silver tray
- Progress bar — visual feedback for large batches

**Defer (v2+):**
- CSV export, summary statistics, recursive scanning, `--dry-run`, timing report

**Explicitly NOT building:**
- ML/AI models, real-time/webcam mode, web UI, interactive wizards, plugin system, database/history

### Architecture Approach

Six-module separation with the CV pipeline as a pure function (`numpy.ndarray → PipelineResult`). The batch orchestrator owns all file I/O; the pipeline never touches the filesystem. Config is a flat dict with descriptive keys, not nested objects. Each image processed in try/except for fault isolation.

**Major components:**
1. **cli.py** — argparse entry point, validates inputs, invokes batch
2. **batch.py** — discovers images, loops with error handling, coordinates pipeline+annotate+report
3. **pipeline.py** — pure CV logic: grayscale → CLAHE → threshold → morphology → distance transform → watershed → contour filtering → count + centers
4. **annotator.py** — draws red dots + sequence numbers on images (separate from pipeline for reuse)
5. **reporter.py** — generates JSON report + terminal summary
6. **config.py** — flat dict of named pipeline parameters with sensible defaults

### Critical Pitfalls

1. **Watershed over-segmentation** — ALWAYS use marker-based watershed; apply Gaussian blur before thresholding; use morphological OPEN after thresholding; use distance transform for sure foreground markers
2. **Distance transform threshold sensitivity** — the #1 parameter to tune; try multiple thresholds (0.58, 0.48, 0.38) and pick best marker count; normalize to [0,1] before thresholding
3. **Marker label confusion (background=0 bug)** — MUST shift labels after connectedComponents: `markers = markers + 1; markers[unknown == 255] = 0` — skip this and watershed merges pills with background
4. **THRESH_BINARY vs THRESH_BINARY_INV** — auto-detect from corner pixel brightness: median > 128 → light background → use BINARY_INV; otherwise BINARY
5. **Background detection fails when pills at edges** — sample multiple small regions (not single pixels), use median, add fallback: try both threshold directions and pick reasonable foreground ratio

## Implications for Roadmap

### Phase 1: Core Pipeline (Foundation)
**Rationale:** Everything depends on the CV pipeline working correctly. Must establish proper preprocessing chain (blur → threshold → morphology → distance transform → watershed) before adding any I/O complexity. Testable immediately with synthetic images.
**Delivers:** `pipeline.py` + `config.py` — pure function `count_pills(image) → PipelineResult`
**Addresses:** Per-image pill count (core requirement)
**Avoids:** Watershed over-segmentation (Pitfall 1), marker label bug (Pitfall 3), data type mismatch (Pitfall 14), morphology kernel errors (Pitfall 4)

### Phase 2: Single Image CLI
**Rationale:** Validate pipeline on real photos before building batch loop. Faster feedback loop during CV parameter tuning. Must solve background detection and threshold direction here.
**Delivers:** `cli.py` + `annotator.py` — single image input → annotated output + count
**Uses:** argparse (stdlib), opencv-python imread/imwrite
**Implements:** CLI entry point, annotator module, background auto-detection
**Avoids:** THRESH_BINARY confusion (Pitfall 5), Otsu failures (Pitfall 6), corner sampling failures (Pitfall 7)

### Phase 3: Batch Mode
**Rationale:** The actual user workflow — process folders of images. Add once single-image works reliably. Introduces batch orchestrator and JSON reporting.
**Delivers:** `batch.py` + `reporter.py` — folder input → annotated outputs + JSON report
**Uses:** tqdm for progress bars
**Implements:** Batch orchestrator, per-image error handling, JSON report generation
**Avoids:** Parameters tuned for one image failing on others (Pitfall 13)

### Phase 4: Polish & Tuning
**Rationale:** Nice-to-haves that improve usability and debugging but don't affect correctness. Debug mode is essential for iterating on CV params with real images.
**Delivers:** Debug mode, verbose/quiet flags, configurable CV params, config overrides via CLI
**Uses:** OpenCV imwrite for debug intermediate images
**Implements:** Debug image saving, CLI flag expansion

### Phase Ordering Rationale

- Pipeline must come first because batch, annotation, and reporting all depend on it
- Single-image before batch because tuning CV params on one image is 10x faster than debugging batch output
- Batch mode is the core user workflow but only makes sense after the pipeline is validated
- Polish features are independent and can be added without touching core logic
- Each phase builds on the previous without requiring rewrites

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** CV parameter tuning — the distance transform threshold, morphology kernel sizes, and CLAHE settings need experimentation with real test images. The parameter ranges in PITFALLS.md provide starting points but actual values depend on the specific pill images.
- **Phase 2:** Background auto-detection robustness — the corner-sampling approach has known failure modes. May need the 7-candidate mask scoring from the existing TypeScript pipeline as a fallback.

Phases with standard patterns (skip research-phase):
- **Phase 3:** Batch loop with per-image error handling is a well-documented pattern. tqdm integration is trivial.
- **Phase 4:** Debug image saving, CLI flags, and config overrides are standard patterns with no domain complexity.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via PyPI, strong rationale for each choice, clear "why not" for alternatives |
| Features | HIGH | Based on 10+ CLI tool patterns, clear MVP/defer/not-building tiers, dependency graph defined |
| Architecture | HIGH | Pure-function pipeline pattern is well-established, matches existing TypeScript implementation, multiple reference implementations exist |
| Pitfalls | HIGH | All verified against official OpenCV docs, Stack Overflow solutions, and real GitHub pill-counting implementations |

**Overall confidence:** HIGH

### Gaps to Address

- **Real test images needed:** CV parameter tuning (distance transform threshold, morphology kernel, CLAHE clip limit) requires actual pill photos. Synthetic images validate the pipeline structure but not accuracy.
- **Existing TypeScript pipeline porting:** The 7-candidate mask scoring from `lib/pill-cv.ts` may be needed if single-threshold approach fails. Decision deferred to Phase 2 testing.
- **Performance baseline:** No benchmarks yet. Single-threaded is fine for prototype, but batch of 100+ high-res images may need resize strategy. Validate in Phase 3.

## Sources

### Primary (HIGH confidence)
- OpenCV Watershed Tutorial — https://docs.opencv.org/4.x/d3/db4/tutorial_py_watershed.html
- OpenCV Distance Transform — https://docs.opencv.org/4.x/d2/dbd/tutorial_distance_transform.html
- OpenCV Thresholding — https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html
- OpenCV Morphological Ops — https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html
- PyPI version verification — opencv-python 4.13.0.92, numpy 2.4.6, tqdm 4.67.3

### Secondary (HIGH confidence)
- PyImageSearch Watershed guide — practical watershed implementation patterns
- Rishita-Rao/Automatic-pill-counter — Python watershed pipeline reference
- celankannan/Pill-Detection — HSV segmentation + connected components
- rembg architecture (DeepWiki) — modular CLI + core function separation
- Existing `lib/pill-cv.ts` — portable pipeline logic with 7-candidate mask scoring

### Tertiary (MEDIUM confidence)
- Stack Overflow pill counting threads — edge cases and workarounds
- JMIR Medical Informatics — lighting impact on pill detection
- CLI tool analysis (batch_img, bat-img, imgeda) — feature conventions

---
*Research completed: 2026-05-28*
*Ready for roadmap: yes*
