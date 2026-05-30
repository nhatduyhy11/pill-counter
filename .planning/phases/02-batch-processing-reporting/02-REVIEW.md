---
phase: 02-batch-processing-reporting
reviewed: 2026-05-30T16:20:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - pill_counter/batch.py
  - pill_counter/cli.py
  - tests/test_cli.py
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-30T16:20:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed batch processing (`batch.py`), CLI entry point (`cli.py`), and their tests (`test_cli.py`). The overall design is clean -- batch processing wraps errors gracefully, the CLI has clear exit codes, and tests cover happy paths plus edge cases. However, there is a fragile variable shadowing bug in the CLI that will produce divergent behavior if the underlying batch logic changes, and two defensive-coding gaps (input validation, exception scope). No security issues found.

## Warnings

### WR-01: `total_pills` double-computed in CLI with divergent semantics

**File:** `pill_counter/cli.py:57-75`

**Issue:** `total_pills` is computed twice with different logic:
- Line 57: `total_pills = sum(r["count"] for r in results if r["status"] == "ok")` -- used for JSON report
- Line 68: `total_pills = 0`, then accumulated on line 75 only when `r["status"] != "error"` -- used for terminal output

Both currently produce the same value because `batch.py` sets `count=0` for error results (line 67). But if that default ever changes, the JSON report and terminal output will silently diverge. The duplicate computation is also confusing for maintainers.

**Fix:** Compute `total_pills` once and reuse it for both the report and terminal output:

```python
total_pills = sum(r["count"] for r in results if r["status"] == "ok")
error_count = sum(1 for r in results if r["status"] == "error")

report = {
    "total_pills": total_pills,
    "total_images": len(results),
    "results": results,
}
report_path = output_path / "report.json"
report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))

# Print per-image results
for r in results:
    if r["status"] == "error":
        print(f"{r['filename']}: ERROR - {r.get('error_msg', 'unknown error')}")
    else:
        print(f"{r['filename']}: {r['count']} pills")

# Print summary
image_count = len(results)
print(f"\nTotal: {total_pills} pills across {image_count} images")

# Exit code
if error_count == image_count:
    sys.exit(1)
elif error_count > 0:
    sys.exit(2)
else:
    sys.exit(0)
```

---

### WR-02: `process_folder` does not validate `input_dir` before use

**File:** `pill_counter/batch.py:85`

**Issue:** `process_folder` calls `scan_images(input_dir)` which calls `input_dir.iterdir()` without first checking `input_dir.exists()` or `input_dir.is_dir()`. When called via the CLI, the CLI validates the path (cli.py lines 39-45). But `process_folder` is a public function imported directly by tests and potentially other callers. A non-existent path raises `FileNotFoundError`; a file path raises `NotADirectoryError`. These produce opaque tracebacks instead of the clean `ValueError` the function documents.

**Fix:** Add input validation at the top of `process_folder`:

```python
def process_folder(input_dir: Path, output_dir: Path, progress: bool = False) -> list[dict]:
    if not input_dir.exists():
        raise ValueError(f"Input directory does not exist: {input_dir}")
    if not input_dir.is_dir():
        raise ValueError(f"Input path is not a directory: {input_dir}")

    images = scan_images(input_dir)
    ...
```

---

### WR-03: CLI catches only `ValueError` from `process_folder`; other exceptions produce raw tracebacks

**File:** `pill_counter/cli.py:52-54`

**Issue:** The `try/except` on line 52 only catches `ValueError`. If `process_folder` raises `PermissionError` (e.g., cannot create output directory), `OSError`, or any other exception, the user sees a raw Python traceback instead of a user-friendly error message and controlled exit.

**Fix:** Catch a broader set of expected exceptions:

```python
try:
    results = process_folder(input_path, output_path, progress=True)
except ValueError as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
except OSError as e:
    print(f"Error: File system error: {e}", file=sys.stderr)
    sys.exit(1)
```

## Info

### IN-01: Repeated `from pill_counter.cli import main` inside test methods

**File:** `tests/test_cli.py:239, 247, 255, 267, 278, 290, 303, 315, 330, 345, 358`

**Issue:** Every test method inside `TestCLI` and `TestCLIReport` re-imports `main` inside the `with patch("sys.argv", ...)` block. Since `main` reads `sys.argv` at call time (via `argparse.parse_args(None)`), not at import time, the import can safely be moved to module level or class level. The repeated imports add noise without benefit.

**Fix:** Move the import to module level (it is already imported indirectly via `from pill_counter.batch import ...`, but adding an explicit `from pill_counter.cli import main` at the top of the test file and removing the inline imports would be cleaner).

---

### IN-02: Silent overwrite of existing files in output directory

**File:** `pill_counter/batch.py:53`

**Issue:** `output_path = output_dir / image_path.name` writes the annotated image directly into the output directory with the original filename. If the output directory already contains files with the same names (e.g., from a previous run), they are silently overwritten. This is acceptable for a CLI tool but worth documenting.

**Fix:** No code change needed. Consider adding a note in the CLI `--help` text: "Output directory is created if missing; existing files with the same names will be overwritten."

---

_Reviewed: 2026-05-30T16:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
