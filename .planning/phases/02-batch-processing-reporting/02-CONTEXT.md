# Phase 2: Batch Processing + Reporting - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add JSON report output and progress feedback to the existing batch pill-counting CLI. The core CV pipeline (Phase 1) is complete — this phase wraps it with structured reporting.

**Requirements in scope:** OUT-03, OUT-04, ERR-03, DBG-03

**Already implemented (carry-forward from Phase 1):**
- `-o/--output` flag for output directory (OUT-04 ✓)
- Exit codes 0/1/2 for success/error/partial failure (ERR-03 ✓)
- Error handling: invalid images skipped, batch continues (ERR-01 ✓)
- Folder scanning, per-image processing, annotated output images

</domain>

<decisions>
## Implementation Decisions

### JSON Report Structure
- **D-01:** Flat list + total. Shape: `{ "total_pills": N, "total_images": N, "results": [{ "filename": "...", "count": N, "status": "ok"|"error", "centers": [[x,y], ...], "error_msg": "..." }, ...] }`
- **D-02:** Always generate `report.json` in the output directory. No flag needed — it's always there.
- **D-03:** Include pill center coordinates (`centers`) in per-image results for downstream analysis.
- **D-04:** Report filename is `report.json` (simple, clear).

### Agent's Discretion
- **D-05:** Progress bar implementation — agent decides between `tqdm` (adds dependency) or simple `sys.stderr` line output. Not critical; algorithm accuracy is the priority.
- **D-06:** Error reporting in JSON — include failed images with `status: "error"` and `error_msg` field. Agent decides detail level.
- **D-07:** Whether terminal output and JSON coexist — agent decides. Recommend keeping human-readable terminal output alongside file-based JSON.

### User Priority Statement
> "The core is algorithm count, make it run first, count correctly, after that we care about these detail later."

This means: JSON report and progress bar are secondary to ensuring the CV pipeline counts accurately. If there's a tradeoff between reporting polish and pipeline correctness, pipeline correctness wins.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, requirement mapping
- `.planning/REQUIREMENTS.md` — OUT-03, OUT-04, ERR-03, DBG-03 definitions
- `.planning/PROJECT.md` — Core value, constraints, technical decisions

### Existing Code (Phase 1)
- `pill_counter/cli.py` — Current CLI with `-o/--output` flag and exit codes
- `pill_counter/batch.py` — Folder scanning, per-image processing, error handling
- `pill_counter/pipeline.py` — Pure CV pipeline (count_pills function)
- `pill_counter/config.py` — PipelineResult dataclass, DEFAULT_CONFIG
- `pill_counter/annotator.py` — Red dot + sequence number annotation

### Codebase Analysis
- `.planning/codebase/STACK.md` — Python + OpenCV stack, dependencies
- `.planning/codebase/ARCHITECTURE.md` — Pipeline architecture, data flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `batch.py:process_folder()` — Already returns list of result dicts with `filename`, `count`, `centers`, `status`, `error_msg`. Can be serialized directly to JSON.
- `batch.py:process_single_image()` — Returns dict with all fields needed for JSON report.
- `cli.py:main()` — Already handles exit codes. Add JSON report writing after results collection.
- `config.py:PipelineResult` — Dataclass with `count`, `centers`, `bounding_boxes`, `debug_images`.

### Established Patterns
- Result dicts are plain Python dicts (not dataclasses) — JSON serializable as-is.
- Error handling wraps entire processing in try/except, returns error status dict.
- Output directory created with `mkdir(parents=True, exist_ok=True)`.

### Integration Points
- `cli.py:main()` line 50: `results = process_folder(input_path, output_path)` — add JSON report writing after this call.
- `batch.py:process_folder()` returns `list[dict]` — serialize to JSON file in output_dir.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User prioritizes algorithm accuracy over reporting polish.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Batch Processing + Reporting*
*Context gathered: 2026-05-28*
