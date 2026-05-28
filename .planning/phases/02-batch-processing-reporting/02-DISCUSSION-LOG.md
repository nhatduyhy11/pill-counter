# Phase 2: Batch Processing + Reporting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 2-Batch Processing + Reporting
**Areas discussed:** JSON report structure

---

## JSON report structure

### Q1: JSON shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list + total | Simple: [{filename, count, status}, ...] + total at top level. Minimal, easy to pipe to jq. | ✓ |
| Detailed with metadata | Richer: per-image includes timing_ms, background_type, pipeline_config. Plus summary with min/max/avg counts. | |
| Summary + results array | Both a summary object and a results array. Summary has total_images, total_pills, success_count, error_count. | |

**User's choice:** Flat list + total (Recommended)
**Notes:** Keep it simple, easy to consume.

### Q2: Output destination

| Option | Description | Selected |
|--------|-------------|----------|
| File in output dir | JSON goes to a file (e.g., report.json in output dir). Terminal still shows human-readable text. | ✓ |
| Stdout (pipe-friendly) | JSON printed to stdout. Human-readable progress/errors go to stderr. | |
| Both stdout + file | Both: --json flag prints to stdout AND writes report.json in output dir. | |

**User's choice:** File in output dir (Recommended)
**Notes:** Keep terminal output human-readable.

### Q3: Always generate or opt-in

| Option | Description | Selected |
|--------|-------------|----------|
| Always generate | Always generate report.json in output dir. No extra flag. Simple, always there. | ✓ |
| Opt-in via --json-report | Only generate when --json-report flag is present. Opt-in, cleaner output dir. | |

**User's choice:** Always generate (Recommended)
**Notes:** No extra flag needed.

### Q4: Include centers in JSON

| Option | Description | Selected |
|--------|-------------|----------|
| Include centers | Include pill coordinates in per-image result. Useful for downstream analysis. | ✓ |
| Count only | Drop centers — only filename, count, status. | |
| More questions | More questions about JSON report structure. | |

**User's choice:** Include centers
**Notes:** Useful for downstream analysis.

### Q5: Report filename

| Option | Description | Selected |
|--------|-------------|----------|
| report.json | Simple, clear. | ✓ |
| pill-counter-report.json | Namespaced, avoids conflicts. | |
| Match folder name | <folder-name>-report.json. | |

**User's choice:** report.json (Recommended)

### Q6: More questions or move on

**User's choice:** "Done with JSON report"
**Notes:** Ready to move on.

---

## Agent's Discretion

- **Progress bar:** User deferred — "just select as you see appropriate"
- **Error reporting in JSON:** User deferred — focus on algorithm accuracy first
- **CLI flag design:** User deferred — not critical vs core counting

## Deferred Ideas

None — user prioritized algorithm accuracy over reporting polish. Reporting details are secondary.

> "The core is algorithm count, make it run first, count correctly, after that we care about these detail later."
