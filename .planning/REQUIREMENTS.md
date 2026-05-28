# Requirements: Pill Counter CLI

**Defined:** 2026-05-28
**Core Value:** Exact pill count accuracy (0-1 off) on controlled-environment images

## v1 Requirements

### Core Pipeline

- [ ] **PIPE-01**: CLI accepts folder path as input and scans all JPG/PNG/WEBP images
- [ ] **PIPE-02**: Each image processed through OpenCV pipeline (grayscale → threshold → morphology → distance transform → watershed → contour filtering)
- [ ] **PIPE-03**: Detected pills filtered by area, circularity, and solidity to reject noise
- [ ] **PIPE-04**: Pipeline handles white paper and silver medical tray backgrounds (auto-detect from corners)
- [ ] **PIPE-05**: Pipeline handles touching pills via watershed separation

### Output

- [ ] **OUT-01**: Each detected pill gets a red dot at centroid + sequence number on annotated image
- [ ] **OUT-02**: Annotated images saved to output directory (separate from input)
- [ ] **OUT-03**: JSON report with per-image count, status, filenames, and aggregate total
- [ ] **OUT-04**: Output directory is configurable via `-o/--output` flag (default: `./output/`)

### Error Handling

- [ ] **ERR-01**: Invalid/corrupt images skipped with error logged, batch continues
- [ ] **ERR-02**: Empty folder produces clear error message
- [ ] **ERR-03**: Exit codes: 0=success, 1=error, 2=partial failure

### Debug & Usability

- [ ] **DBG-01**: `--debug` flag saves intermediate CV images (threshold, morphology, distance transform, watershed markers) to debug folder
- [ ] **DBG-02**: Background auto-detection from image corners (white vs silver vs other)
- [ ] **DBG-03**: Progress bar shows current/total images during batch processing

## v2 Requirements

### Usability

- **UX-01**: Verbose/quiet modes (`-v/-q`)
- **UX-02**: Configurable CV params via CLI flags (`--min-area`, `--max-area`, `--circularity`)
- **UX-03**: `--background` hint flag to override auto-detection
- **UX-04**: `--dry-run` to preview files without processing

### Output

- **OUT-05**: CSV export alongside JSON
- **OUT-06**: Summary statistics (min/max/avg count, outlier detection)
- **OUT-07**: Timing report per image + total

### Input

- **IN-01**: Recursive folder scanning (`-R/--recursive`)
- **IN-02**: Accept image list from stdin

## Out of Scope

| Feature | Reason |
|---------|--------|
| ML/AI models | Controlled environment = classical CV is sufficient |
| Multiple pill types per image | Classical CV can't distinguish types reliably |
| Overlapping pills (stacked) | Requires 3D reasoning or ML |
| Web UI / interactive mode | Standalone CLI dev tool only |
| Real-time / webcam mode | Different tool, different UX |
| Image format conversion | Not the tool's job |
| Model downloads | Offline-first, zero-config after pip install |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1 | Pending |
| PIPE-02 | Phase 1 | Pending |
| PIPE-03 | Phase 1 | Pending |
| PIPE-04 | Phase 1 | Pending |
| PIPE-05 | Phase 1 | Pending |
| OUT-01 | Phase 1 | Pending |
| OUT-02 | Phase 1 | Pending |
| OUT-03 | Phase 2 | Pending |
| OUT-04 | Phase 2 | Pending |
| ERR-01 | Phase 1 | Pending |
| ERR-02 | Phase 1 | Pending |
| ERR-03 | Phase 2 | Pending |
| DBG-01 | Phase 3 | Pending |
| DBG-02 | Phase 1 | Pending |
| DBG-03 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 after roadmap creation*
