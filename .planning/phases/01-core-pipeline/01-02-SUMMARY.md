---
phase: 01-core-pipeline
plan: 02
subsystem: cv-pipeline
tags: [opencv, cli, argparse, batch-processing, annotation, tqdm]

# Dependency graph
requires:
  - phase: 01-core-pipeline-plan-01
    provides: "Pure CV pipeline function count_pills(image) -> PipelineResult"
provides:
  - "CLI entry point pill-counter <folder> with argparse"
  - "Batch processing loop with per-image error handling"
  - "Image annotator with red dots + sequence numbers"
  - "Automatic output directory creation"
affects: [01-core-pipeline-plan-03]

# Tech tracking
tech-stack:
  added: [argparse, pathlib, logging]
  patterns: [batch-orchestrator, error-resilient-loop, image-annotation]

key-files:
  created:
    - pill_counter/cli.py
    - pill_counter/annotator.py
    - pill_counter/batch.py
    - tests/test_cli.py
  modified: []

key-decisions:
  - "Used Python 3.12+ type hints (list[tuple] not List[Tuple]) consistent with 01-01"
  - "logging module for error messages in batch.py (not print to stderr)"
  - "Exit codes: 0=success, 1=all failed, 2=partial failure"

patterns-established:
  - "Batch orchestrator: scan → process_single → annotate → save, with try/except per image"
  - "CLI: argparse with positional input, optional -o/--output, sys.exit with codes"

requirements-completed: [PIPE-01, OUT-01, OUT-02, ERR-01, ERR-02]

# Metrics
duration: 4min
completed: 2026-05-28
---

# Phase 01 Plan 02: CLI + Batch + Annotator Summary

**CLI entry point with argparse, batch processing loop with per-image error resilience, and image annotator drawing red dots + sequence numbers on detected pills**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-28T05:35:32Z
- **Completed:** 2026-05-28T05:39:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CLI entry point with `pill-counter <folder>` command, argparse, and exit codes 0/1/2
- Batch processing loop that scans images, processes each through CV pipeline, saves annotated output
- Image annotator drawing red filled circles + sequence numbers at pill centroids
- Corrupt images skipped with error status — batch never crashes (ERR-01)
- Empty folder raises clear ValueError (ERR-02)
- Output directory auto-created if missing (OUT-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Annotator module (TDD RED)** - `ca6fa17` (test)
2. **Task 1: Annotator module (TDD GREEN)** - `f6fbedb` (feat)
3. **Task 2: CLI + batch processing (TDD RED)** - `c155704` (test)
4. **Task 2: CLI + batch processing (TDD GREEN)** - `288dc4c` (feat)

## Files Created/Modified
- `pill_counter/annotator.py` — Red dot + sequence number annotation on BGR images
- `pill_counter/batch.py` — Folder scanning, per-image processing, batch orchestration
- `pill_counter/cli.py` — argparse CLI entry point with input validation and exit codes
- `tests/test_cli.py` — 19 tests covering annotator, batch, and CLI

## Decisions Made
- Used Python 3.12+ native type hints consistent with 01-01 pattern
- logging module for error messages in batch.py (standard practice, configurable)
- Exit codes: 0=all success, 1=all failed or fatal error, 2=partial failure
- Bounding boxes optional in annotate_image (default None) — pipeline provides them but annotator works without

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CLI, batch, and annotator all working end-to-end
- `pill-counter <folder>` processes images, prints counts, saves annotated output
- Ready for JSON reporter integration (plan 03 if exists)
- All public APIs importable: main, process_folder, process_single_image, scan_images, annotate_image

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (annotator) | `ca6fa17` — test(01-02): add failing tests for annotator module | ✓ Pass |
| GREEN (annotator) | `f6fbedb` — feat(01-02): implement annotator with red dots | ✓ Pass |
| RED (batch/CLI) | `c155704` — test(01-02): add failing tests for batch processing and CLI | ✓ Pass |
| GREEN (batch/CLI) | `288dc4c` — feat(01-02): implement batch processing and CLI entry point | ✓ Pass |

## Known Stubs

None — all functions are fully implemented with real logic.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-01-03 mitigated | pill_counter/cli.py | Input path validated: exists + is_dir check before processing |
| T-01-04 accepted | pill_counter/batch.py | Error messages include file paths — acceptable for dev tool |

## Self-Check: PASSED

All 4 created files verified present. All 4 task commits verified in git log. 31 tests passing (19 new + 12 existing).

---
*Phase: 01-core-pipeline*
*Completed: 2026-05-28*
