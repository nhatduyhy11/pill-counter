---
phase: 01-core-pipeline
verified: 2026-05-28T06:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 1: Core Pipeline + CLI Verification Report

**Phase Goal:** User can run CLI on a folder and get accurate pill count with annotated output images
**Verified:** 2026-05-28T06:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pipeline returns correct pill count for synthetic images with known pill positions | ✓ VERIFIED | 12 tests pass: single circle=1, three circles=3, touching circles=2, center within 10px |
| 2 | Pipeline separates touching pills via watershed when two circles overlap at edge | ✓ VERIFIED | `TestTouchingPills::test_two_touching_circles_returns_count_2` passes (400x400 canvas, radius-40 circles at (160,200) and (240,200)) |
| 3 | Pipeline detects light background (white paper) and uses THRESH_BINARY_INV | ✓ VERIFIED | `TestBackgroundThresholding::test_light_background_with_dark_pills` passes; `detect_background()` returns 'light' for median>128 |
| 4 | Pipeline detects dark background (silver tray) and uses THRESH_BINARY | ✓ VERIFIED | `TestBackgroundThresholding::test_dark_background_with_light_pills` passes; `detect_background()` returns 'dark' for median≤128 |
| 5 | Pipeline rejects contours that fail area, circularity, or solidity filters | ✓ VERIFIED | 3 noise filtering tests pass: small specks filtered, large blobs filtered, non-circular shapes filtered |
| 6 | User can run `pill-counter <folder>` and see pill count per image in terminal | ✓ VERIFIED | CLI test: valid folder → exit 0, prints "{filename}: {count} pills" per image, "Total: N pills across M images" |
| 7 | Annotated images in output folder show red dot + sequence number on each detected pill | ✓ VERIFIED | `annotate_image()` draws red filled circle (BGR 0,0,255) at centroid + sequence number; 472 red pixels verified in memory at correct centers; JPEG compression causes minor value drift on disk (expected) |
| 8 | Invalid/corrupt images are skipped with error message, batch continues | ✓ VERIFIED | `TestProcessFolder::test_corrupt_image_does_not_kill_batch` passes; corrupt file returns status='error', good file returns status='ok' |
| 9 | Empty folder shows clear error message and exits with code 1 | ✓ VERIFIED | `process_folder()` raises `ValueError("No image files found in ...")`; CLI catches and exits 1 |
| 10 | Output directory is created automatically if it does not exist | ✓ VERIFIED | `TestProcessFolder::test_creates_output_directory` passes; `output_dir.mkdir(parents=True, exist_ok=True)` in batch.py |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pill_counter/pipeline.py` | Pure CV pipeline function count_pills(image) -> PipelineResult | ✓ VERIFIED | 170 lines; exports `count_pills`, `detect_background`; imports DEFAULT_CONFIG from config.py. Note: plan specified `PipelineConfig` class export — implementation uses `DEFAULT_CONFIG` dict instead (valid alternative, all tests pass) |
| `pill_counter/config.py` | Default pipeline parameters and PipelineResult dataclass | ✓ VERIFIED | 27 lines; DEFAULT_CONFIG has 10 keys with correct defaults; PipelineResult dataclass with count, centers, bounding_boxes, debug_images |
| `tests/test_pipeline.py` | Unit tests with synthetic images validating pipeline accuracy | ✓ VERIFIED | 156 lines (min: 80); 12 tests covering single/multi/touching/background/noise |
| `pill_counter/cli.py` | argparse CLI entry point | ✓ VERIFIED | 80 lines; exports `main`; positional input arg, -o/--output optional arg |
| `pill_counter/annotator.py` | Draw red dots + sequence numbers on images | ✓ VERIFIED | 44 lines; exports `annotate_image`; red circle radius 5, text offset (+10,-10), green bounding boxes optional |
| `pill_counter/batch.py` | Folder scanning and per-image orchestration | ✓ VERIFIED | 90 lines; exports `process_folder`, `process_single_image`, `scan_images` |
| `tests/test_cli.py` | Integration tests for CLI and annotator | ✓ VERIFIED | 228 lines (min: 50); 19 tests covering annotator, batch, CLI |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pill_counter/pipeline.py` | `pill_counter/config.py` | `from.*config.*import` | ✓ WIRED | Line 6: `from .config import DEFAULT_CONFIG, PipelineResult` |
| `tests/test_pipeline.py` | `pill_counter/pipeline.py` | `from.*pipeline.*import.*count_pills` | ✓ WIRED | Line 7: `from pill_counter.pipeline import count_pills, detect_background` |
| `pill_counter/cli.py` | `pill_counter/batch.py` | `from.*batch.*import` | ✓ WIRED | Line 7: `from .batch import process_folder` |
| `pill_counter/batch.py` | `pill_counter/pipeline.py` | `from.*pipeline.*import.*count_pills` | ✓ WIRED | Line 7: `from .pipeline import count_pills` |
| `pill_counter/batch.py` | `pill_counter/annotator.py` | `from.*annotator.*import.*annotate_image` | ✓ WIRED | Line 8: `from .annotator import annotate_image` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `pill_counter/pipeline.py` | `count` field in PipelineResult | `len(centers)` from contour filtering | ✓ Yes — real contour detection | ✓ FLOWING |
| `pill_counter/batch.py` | `result["count"]` | `count_pills(image)` → PipelineResult.count | ✓ Yes — pipeline returns real counts | ✓ FLOWING |
| `pill_counter/annotator.py` | `centers` parameter | Passed from batch.py `result.centers` | ✓ Yes — centers from pipeline | ✓ FLOWING |
| `pill_counter/cli.py` | `results` list | `process_folder()` → list of dicts | ✓ Yes — batch returns real results | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Pipeline smoke test | `count_pills(single_circle)` → count=1 | count=1, center=(100,100) | ✓ PASS |
| Background detection | `detect_background(white)` → 'light' | 'light'; `detect_background(black)` → 'dark' | ✓ PASS |
| Batch processing | `process_folder(tmpdir)` with 2 images | 2 results, output dir created, annotated files saved | ✓ PASS |
| Annotator | `annotate_image(img, [(100,100)])` → red pixel at center | BGR=(0,0,255) at (100,100) | ✓ PASS |
| CLI exit codes | valid→0, nonexistent→1, empty→1 | 0, 1, 1 as expected | ✓ PASS |
| Full test suite | `pytest tests/ -v` | 31/31 passed in 0.33s | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| PIPE-01 | 01-02 | CLI accepts folder path as input and scans all JPG/PNG/WEBP images | ✓ SATISFIED | `scan_images()` in batch.py: case-insensitive extension matching for .jpg/.jpeg/.png/.webp/.bmp |
| PIPE-02 | 01-01 | Each image processed through OpenCV pipeline (grayscale→threshold→morphology→distance transform→watershed→contour filtering) | ✓ SATISFIED | `count_pills()` in pipeline.py: full 13-step pipeline implementation |
| PIPE-03 | 01-01 | Detected pills filtered by area, circularity, and solidity to reject noise | ✓ SATISFIED | Lines 120-144 in pipeline.py: min_area, max_area, circularity, solidity filters |
| PIPE-04 | 01-01 | Pipeline handles white paper and silver medical tray backgrounds (auto-detect from corners) | ✓ SATISFIED | `detect_background()`: corner sampling with median; `auto_threshold()`: BGR_INV for light, BGR for dark |
| PIPE-05 | 01-01 | Pipeline handles touching pills via watershed separation | ✓ SATISFIED | Lines 74-98 in pipeline.py: distance transform → markers → watershed |
| OUT-01 | 01-02 | Each detected pill gets a red dot at centroid + sequence number on annotated image | ✓ SATISFIED | `annotate_image()`: red circle (BGR 0,0,255) radius 5, putText with 1-indexed sequence |
| OUT-02 | 01-02 | Annotated images saved to output directory (separate from input) | ✓ SATISFIED | `process_single_image()`: `cv2.imwrite(output_path, annotated)` |
| ERR-01 | 01-02 | Invalid/corrupt images skipped with error logged, batch continues | ✓ SATISFIED | `process_single_image()`: try/except wraps entire function, returns error status dict |
| ERR-02 | 01-02 | Empty folder produces clear error message | ✓ SATISFIED | `process_folder()`: `raise ValueError(f"No image files found in {input_dir}")` |
| DBG-02 | 01-01 | Background auto-detection from image corners (white vs silver vs other) | ✓ SATISFIED | `detect_background()`: samples 4 corners, returns 'light' or 'dark' based on median brightness |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No anti-patterns detected |

**Debt markers:** None (no TBD/FIXME/XXX found in any modified files)
**Warning markers:** None (no TODO/HACK/placeholder found)
**Empty implementations:** None (no `return null`/`return {}`/`return []` stubs)
**Console.log:** None

### Human Verification Required

| # | Test | Expected | Why Human |
|---|------|----------|-----------|
| 1 | Run `pill-counter <folder>` on real pill photos (white paper background) | Count accurate within 0-1 of actual pills | Synthetic tests validate logic; real-world images test full pipeline robustness |
| 2 | Run `pill-counter <folder>` on real pill photos (silver medical tray background) | Count accurate within 0-1; background correctly detected as 'dark' | Real tray has reflections, uneven lighting not covered by synthetic tests |
| 3 | Visually inspect annotated output images | Red dots centered on each pill, sequence numbers readable, green bounding boxes visible | Automated checks verify pixel values; human confirms visual quality |
| 4 | Run `pill-counter <folder>` with mix of valid and corrupt images | Corrupt images show ERROR in terminal, valid images process correctly, exit code 2 | Exit code 2 (partial failure) behavior only testable with real corrupt files in real batch |

### Gaps Summary

No gaps found. All 10 observable truths verified. All 7 artifacts exist, are substantive, and are properly wired. All 5 key links verified. All 10 requirements satisfied. 31/31 tests pass. No anti-patterns or debt markers detected.

---

_Verified: 2026-05-28T06:00:00Z_
_Verifier: the agent (gsd-verifier)_
