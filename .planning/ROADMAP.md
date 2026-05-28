# Roadmap: Pill Counter CLI

## Overview

Standalone Python CLI for batch pill counting using classical OpenCV computer vision. Three phases deliver increasing capability: first the core CV pipeline that counts pills accurately, then batch processing with JSON reporting, then debug mode for pipeline tuning. Each phase builds on the previous without requiring rewrites.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Pipeline + CLI** - CV pipeline counts pills accurately on single images with annotated output (completed 2026-05-28)
- [ ] **Phase 2: Batch Processing + Reporting** - Process folders of images with JSON report, progress bar, and exit codes
- [ ] **Phase 3: Debug Mode** - Save intermediate CV images for pipeline tuning and troubleshooting

## Phase Details

### Phase 1: Core Pipeline + CLI

**Mode:** mvp
**Goal**: User can run CLI on a folder and get accurate pill count with annotated output images
**Depends on**: Nothing (first phase)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, OUT-01, OUT-02, ERR-01, ERR-02, DBG-02
**Success Criteria** (what must be TRUE):

  1. User can run `pill-counter <folder>` and see pill count for each image in terminal output
  2. Annotated images in output folder show red dot + sequence number on each detected pill
  3. Pipeline correctly counts pills on white paper background (0-1 off)
  4. Pipeline correctly counts pills on silver medical tray background (0-1 off)
  5. Touching pills at edges are separated and counted individually via watershed

**Plans**: 2 plans

Plans:

- [x] 01-01-PLAN.md — CV Pipeline Core: pure function pipeline with background detection, watershed, contour filtering
- [x] 01-02-PLAN.md — CLI + Annotation + Output: argparse CLI, red dot annotation, batch processing, error handling

### Phase 2: Batch Processing + Reporting

**Mode:** mvp
**Goal**: User can process a folder of images and get structured JSON report with progress feedback
**Depends on**: Phase 1
**Requirements**: OUT-03, OUT-04, ERR-03, DBG-03
**Success Criteria** (what must be TRUE):

  1. User can run `pill-counter <folder> -o <output>` and get JSON report with per-image counts, status, filenames, and aggregate total
  2. Progress bar shows current/total images during batch processing
  3. CLI exits with code 0 on success, 1 on error, 2 on partial failure
  4. Invalid/corrupt images are skipped with error logged, batch continues processing remaining images

**Plans**: TBD

Plans:

- [ ] 02-01: TBD

### Phase 3: Debug Mode

**Mode:** mvp
**Goal**: User can inspect pipeline internals for tuning and troubleshooting
**Depends on**: Phase 2
**Requirements**: DBG-01
**Success Criteria** (what must be TRUE):

  1. User can run `pill-counter <folder> --debug` and see intermediate CV images (threshold, morphology, distance transform, watershed markers) saved to debug folder

**Plans**: TBD

Plans:

- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Pipeline + CLI | 2/2 | Complete   | 2026-05-28 |
| 2. Batch Processing + Reporting | 0/1 | Not started | - |
| 3. Debug Mode | 0/1 | Not started | - |
