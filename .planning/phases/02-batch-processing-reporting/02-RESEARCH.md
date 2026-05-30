# Phase 2: Batch Processing + Reporting - Research

**Researched:** 2026-05-28
**Domain:** Python CLI JSON reporting and progress feedback
**Confidence:** HIGH

## Summary

Phase 2 adds JSON report output and progress feedback to the existing batch pill-counting CLI. The core CV pipeline (Phase 1) is complete. The existing `batch.py:process_folder()` already returns `list[dict]` with all fields needed for JSON serialization (`filename`, `count`, `centers`, `status`, `error_msg`). The work is primarily wiring: wrap the loop with `tqdm` for progress, aggregate results into the D-01 report shape, and write `report.json` to the output directory.

**Primary recommendation:** Modify `cli.py` to construct the JSON report from existing `process_folder()` results and write it to `report.json`. Use `tqdm` (already in `pyproject.toml` dependencies) for progress bar. Minimal code changes required.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Flat list + total. Shape: `{ "total_pills": N, "total_images": N, "results": [{ "filename": "...", "count": N, "status": "ok"|"error", "centers": [[x,y], ...], "error_msg": "..." }, ...] }`
- **D-02:** Always generate `report.json` in the output directory. No flag needed.
- **D-03:** Include pill center coordinates (`centers`) in per-image results
- **D-04:** Report filename is `report.json`

### Claude's Discretion
- **D-05:** Progress bar implementation — agent decides between `tqdm` or simple `sys.stderr` output
- **D-06:** Error reporting in JSON — include failed images with `status: "error"` and `error_msg` field
- **D-07:** Terminal output and JSON coexist — keep human-readable terminal output alongside file-based JSON

### Deferred Ideas (OUT OF SCOPE)
None

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-03 | JSON report with per-image count, status, filenames, aggregate total | `batch.py` returns all needed fields; add JSON write to `cli.py` |
| OUT-04 | Output directory configurable via `-o/--output` flag | Already implemented in Phase 1 (`cli.py:32-34`) |
| ERR-03 | Exit codes: 0=success, 1=error, 2=partial failure | Already implemented in Phase 1 (`cli.py:71-76`) |
| DBG-03 | Progress bar shows current/total images during batch processing | Use `tqdm` (already in `pyproject.toml`) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tqdm` | >=4.67.0 | Progress bar for batch loop | Already in `pyproject.toml` dependencies; de facto standard for Python CLI progress |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `json` (stdlib) | — | JSON serialization | Always — for writing `report.json` |

### Installation
```bash
# tqdm already declared in pyproject.toml — just install the project
pip install -e .
```

**Version verification:** `tqdm>=4.67.0` is declared in `pyproject.toml` — no registry check needed, this is a project-owned decision.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Disposition |
|---------|----------|-----|-----------|-------------|-------------|
| tqdm | PyPI | ~10 yrs | ~50M/wk | github.com/tqdm/tqdm | Approved |

No new packages introduced. `tqdm` is already declared as a project dependency.

## Architecture Patterns

### Data Flow: Current vs. Target

```
CURRENT (Phase 1):
  cli.py:main()
    → batch.py:process_folder()
      → [process_single_image() for each image]
    → prints per-image results to stdout
    → prints summary to stdout
    → exits with code

TARGET (Phase 2):
  cli.py:main()
    → batch.py:process_folder()  [wrapped with tqdm for progress]
      → [process_single_image() for each image]
    → prints per-image results to stdout  [D-07: keep human output]
    → constructs report dict (D-01 shape)
    → writes report.json to output_dir
    → prints summary to stdout
    → exits with code
```

### JSON Report Structure (D-01)

```python
{
    "total_pills": int,      # sum of count across all "ok" results
    "total_images": int,     # len(results)
    "results": [
        {
            "filename": str,
            "count": int,
            "status": "ok" | "error",
            "centers": [[x, y], ...],  # list of [int, int] pairs
            "error_msg": str | None    # only present for "error" status
        },
        ...
    ]
}
```

**Serialization note:** `centers` in result dicts are `list[tuple[int, int]]` from `batch.py:process_single_image()`. Python's `json.dumps` serializes tuples as JSON arrays — no conversion needed. The `error_msg` key is absent for successful results (not `null`); this is fine for JSON consumers.

### Progress Bar Pattern (tqdm)

```python
from tqdm import tqdm

# Option A: Wrap the image list in batch.py's loop
for img_path in tqdm(images, desc="Processing", unit="img"):
    result = process_single_image(img_path, output_dir)
    results.append(result)

# Option B: Wrap in cli.py (cleaner separation)
# Requires batch.py to accept a callback or return an iterator
```

**Recommendation:** Option A — modify `batch.py:process_folder()` to accept an optional `progress: bool = False` parameter. When `True`, wrap the loop with `tqdm`. This keeps `cli.py` clean and makes progress optional for programmatic use.

### Recommended Changes

**`pill_counter/batch.py`** — Add progress bar to `process_folder()`:
- Add `progress: bool = False` parameter
- When `True`, wrap `images` with `tqdm(images, desc="Processing", unit="img")`
- No other changes needed

**`pill_counter/cli.py`** — Add JSON report writing:
- After `results = process_folder(...)`, construct report dict
- Write `report.json` to `output_path / "report.json"`
- Keep existing terminal output (D-07)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bar | Custom `sys.stderr` spinner | `tqdm` | Handles terminal resize, ETA, rate display, non-TTY detection — already a dependency |
| JSON serialization | Manual string building | `json.dumps(indent=2)` | Correct escaping, Unicode handling, pretty-print |

## Common Pitfalls

### Pitfall 1: tqdm in Non-TTY Environments
**What goes wrong:** tqdm outputs escape codes when piped or run in CI, producing garbled output
**Why it happens:** tqdm defaults to rich terminal output
**How to avoid:** `tqdm` auto-detects TTY — but if issues arise, pass `disable=None` to let it auto-detect, or `disable=True` to suppress
**Warning signs:** CI logs show `[?25l` escape sequences

### Pitfall 2: JSON Serialization of numpy Types
**What goes wrong:** `TypeError: Object of type int64 is not JSON serializable`
**Why it happens:** OpenCV/numpy operations may return numpy integers instead of Python ints
**How to avoid:** The current code uses `int(M["m10"] / M["m00"])` in `pipeline.py:149-150` which produces Python ints. But if `count` comes from `len(centers)`, it's always a Python int. Safe as-is.
**Warning signs:** TypeError when calling `json.dumps()`

### Pitfall 3: Report Written Before Output Dir Exists
**What goes wrong:** FileNotFoundError when writing `report.json`
**Why it happens:** If `process_folder()` is not called (e.g., early exit), output dir may not exist
**How to avoid:** `batch.py` already calls `output_dir.mkdir(parents=True, exist_ok=True)` — safe as long as report writing happens after `process_folder()`
**Warning signs:** FileNotFoundError in tests

### Pitfall 4: Empty Centers List Serialization
**What goes wrong:** `centers: []` vs `centers: null` inconsistency
**Why it happens:** Error results have `centers: []` (empty list), not `null`
**How to avoid:** Current code already returns `[]` for errors — serialize as-is
**Warning signs:** Downstream consumers checking `if result["centers"]` would get truthy `[]`

## Code Examples

### JSON Report Construction
```python
import json

def build_report(results: list[dict]) -> dict:
    """Construct D-01 report shape from process_folder() results."""
    total_pills = sum(r["count"] for r in results if r["status"] == "ok")
    return {
        "total_pills": total_pills,
        "total_images": len(results),
        "results": results,
    }

# In cli.py after process_folder():
report = build_report(results)
report_path = output_path / "report.json"
report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
```

### Progress Bar in batch.py
```python
from tqdm import tqdm

def process_folder(input_dir: Path, output_dir: Path, progress: bool = False) -> list[dict]:
    images = scan_images(input_dir)
    if not images:
        raise ValueError(f"No image files found in {input_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    iterator = tqdm(images, desc="Processing", unit="img") if progress else images
    results: list[dict] = []
    for img_path in iterator:
        result = process_single_image(img_path, output_dir)
        results.append(result)
    return results
```

### CLI Call with Progress
```python
# In cli.py:
results = process_folder(input_path, output_path, progress=True)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No JSON output | `report.json` in output dir | Phase 2 | Machine-readable results for downstream tools |
| No progress feedback | tqdm progress bar | Phase 2 | User sees processing rate and ETA |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tqdm` is not yet installed but declared in `pyproject.toml` — running `pip install -e .` will install it | Standard Stack | Low — pyproject.toml is the source of truth |
| A2 | Python's `json.dumps` handles `tuple` → array conversion transparently | Architecture Patterns | Very low — documented stdlib behavior |
| A3 | `len(centers)` in `PipelineResult` and `int(M["m10"]/M["m00"])` produce Python ints, not numpy ints | Pitfalls | Low — explicit `int()` cast in pipeline.py |

## Open Questions

1. **Should `process_folder()` accept `progress` parameter or should CLI handle tqdm wrapping?**
   - What we know: Both approaches work; tqdm wrapping in `batch.py` keeps the loop in one place
   - What's unclear: Whether programmatic callers want progress control
   - Recommendation: Add `progress: bool = False` to `process_folder()` — backward compatible, CLI passes `True`

2. **Should `report.json` be written even on exit code 1 (all failed)?**
   - What we know: D-02 says "always generate report.json"
   - What's unclear: Whether an all-error report is useful
   - Recommendation: Yes, write it — the report documents what went wrong, useful for debugging

## Sources

### Primary (HIGH confidence)
- `pill_counter/batch.py` — Direct code inspection of `process_folder()` and `process_single_image()` return structures
- `pill_counter/cli.py` — Direct code inspection of exit code logic and terminal output
- `pill_counter/config.py` — Direct code inspection of `PipelineResult` dataclass
- `pill_counter/pipeline.py` — Direct code inspection of int conversion in centroid calculation
- `pyproject.toml` — `tqdm>=4.67.0` declared as dependency

### Tertiary (LOW confidence)
- tqdm TTY auto-detection behavior — based on training knowledge, not verified in this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already declared in project
- Architecture: HIGH — existing code structure directly supports the target shape
- Pitfalls: HIGH — all pitfalls are well-known Python/JSON behaviors

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable — no fast-moving dependencies)
