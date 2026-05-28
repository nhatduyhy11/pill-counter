# Architecture Patterns — Python CLI Pill Counter

**Domain:** CLI batch image processing with OpenCV
**Researched:** 2026-05-28
**Confidence:** HIGH

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI ENTRY POINT                           │
│                     cli.py (argparse)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ --input dir  │  │ --output dir │  │ --debug/--config  │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   BATCH ORCHESTRATOR                         │
│                     batch.py                                 │
│                                                             │
│  1. Discover images (glob *.jpg, *.png, ...)                │
│  2. For each image:                                         │
│     a. Load → numpy array                                   │
│     b. Run pipeline → (count, centers, debug)               │
│     c. Annotate → save output image                         │
│     d. Collect result → append to report                    │
│  3. Write JSON report                                       │
│  4. Print summary to stdout                                 │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    CV PIPELINE                               │
│                    pipeline.py                               │
│                                                             │
│  Input: numpy.ndarray (BGR)                                 │
│  Output: PipelineResult(count, centers[], debug)            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Preprocess     — grayscale, resize, CLAHE          │  │
│  │ 2. Segment        — threshold (Otsu/adaptive)         │  │
│  │ 3. Clean          — morphology (open + close)         │  │
│  │ 4. Separate       — distance transform + watershed    │  │
│  │ 5. Filter         — contour area, circularity         │  │
│  │ 6. Extract        — centers + bounding boxes          │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPPORT MODULES                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  annotator.py │  │  reporter.py │  │  config.py       │  │
│  │  Draw dots +  │  │  JSON report │  │  Pipeline params │  │
│  │  numbers      │  │  + summary   │  │  (hardcoded)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Boundaries

| Component | File | Responsibility | Reads From | Writes To | Depends On |
|-----------|------|---------------|------------|-----------|------------|
| **CLI** | `cli.py` | Parse args, validate inputs, invoke batch | `sys.argv` | stdout/stderr | `batch`, `config` |
| **Batch Orchestrator** | `batch.py` | Discover images, loop, coordinate pipeline+annotate+report | input folder | output folder, JSON | `pipeline`, `annotator`, `reporter` |
| **CV Pipeline** | `pipeline.py` | Pure CV logic: image → count + centers | numpy array | `PipelineResult` | `opencv-python`, `numpy` |
| **Annotator** | `annotator.py` | Draw red dots + sequence numbers on image | numpy array + centers | annotated numpy array | `opencv-python` |
| **Reporter** | `reporter.py` | Aggregate results → JSON + terminal summary | list of `ImageResult` | JSON file, stdout | `json` (stdlib) |
| **Config** | `config.py` | Pipeline parameters with clear names | nothing | params dict | nothing |

### Key Boundary Rules

1. **Pipeline is pure function:** `numpy.ndarray → PipelineResult`. No file I/O, no side effects. This makes it testable with synthetic images.
2. **Batch orchestrator owns I/O:** All file reading/writing lives in `batch.py`. Pipeline never touches the filesystem.
3. **Annotator is separate from pipeline:** Pipeline detects; annotator visualizes. This allows running pipeline without annotation (e.g., for benchmarking).
4. **Config is data, not logic:** Just a dict/dataclass of named parameters. No validation logic — keep it simple.

## Data Flow

```
INPUT FOLDER                         OUTPUT FOLDER
  image1.jpg ──┐                   ┌── image1_annotated.jpg
  image2.jpg ──┤                   ├── image2_annotated.jpg
  image3.jpg ──┤                   ├── image3_annotated.jpg
  ...          │                   ├── ...
               ▼                   ▼
  ┌─────────────────────────────────────────────────┐
  │              batch.py (orchestrator)              │
  │                                                  │
  │  for each image_path in discover(input_dir):     │
  │    ┌──────────────────────────────────────────┐  │
  │    │ 1. LOAD                                  │  │
  │    │    img = cv2.imread(image_path)          │  │
  │    │    → numpy.ndarray (BGR, H×W×3)         │  │
  │    └──────────────┬───────────────────────────┘  │
  │                   ▼                              │
  │    ┌──────────────────────────────────────────┐  │
  │    │ 2. PIPELINE (pipeline.py)                │  │
  │    │    gray = cvtColor(img, BGR2GRAY)        │  │
  │    │    gray = resize_if_large(gray, 1024)    │  │
  │    │    enhanced = CLAHE(gray)                │  │
  │    │    binary = otsu_or_adaptive(enhanced)   │  │
  │    │    cleaned = morphology(binary)          │  │
  │    │    markers = distance_transform(cleaned) │  │
  │    │    labels = watershed(markers)           │  │
  │    │    contours = find_contours(labels)      │  │
  │    │    pills = filter_contours(contours)     │  │
  │    │    → PipelineResult(count, centers, boxes)│  │
  │    └──────────────┬───────────────────────────┘  │
  │                   ▼                              │
  │    ┌──────────────────────────────────────────┐  │
  │    │ 3. ANNOTATE (annotator.py)               │  │
  │    │    annotated = img.copy()                │  │
  │    │    for i, (cx, cy) in enumerate(centers):│  │
  │    │      circle(annotated, (cx,cy), RED)     │  │
  │    │      putText(annotated, str(i+1))        │  │
  │    │    → numpy.ndarray (annotated)           │  │
  │    └──────────────┬───────────────────────────┘  │
  │                   ▼                              │
  │    ┌──────────────────────────────────────────┐  │
  │    │ 4. SAVE                                  │  │
  │    │    cv2.imwrite(output_path, annotated)   │  │
  │    │    results.append(ImageResult(...))       │  │
  │    └──────────────────────────────────────────┘  │
  │                                                  │
  │  report = reporter.generate(results)             │
  │  write_json(output_dir / "report.json", report)  │
  │  reporter.print_summary(report)                  │
  └─────────────────────────────────────────────────┘
```

### Data Types Flowing Through System

```python
# pipeline.py output
@dataclass
class PipelineResult:
    count: int                    # number of pills detected
    centers: list[tuple[int, int]]  # (x, y) pixel coordinates
    boxes: list[tuple[int, int, int, int]]  # (x, y, w, h) bounding rects
    debug: dict | None            # intermediate images/metrics if --debug

# batch.py intermediate
@dataclass
class ImageResult:
    filename: str
    count: int
    centers: list[tuple[int, int]]
    boxes: list[tuple[int, int, int, int]]
    processing_time_ms: float
    error: str | None

# reporter.py output (JSON)
{
    "total_images": 5,
    "total_pills": 42,
    "images": [
        {
            "filename": "image1.jpg",
            "count": 12,
            "centers": [[100, 200], ...],
            "processing_time_ms": 340
        }
    ]
}
```

## Patterns to Follow

### Pattern 1: Pipeline as Pure Function

**What:** CV pipeline takes numpy array in, returns dataclass out. No file I/O, no global state.
**When:** Always — this is the core architectural decision.
**Why:** Testable with synthetic images (numpy.zeros), benchmarkable, reusable.
**Example:**
```python
# pipeline.py
import cv2
import numpy as np
from dataclasses import dataclass

@dataclass
class PipelineResult:
    count: int
    centers: list[tuple[int, int]]
    boxes: list[tuple[int, int, int, int]]

def count_pills(image: np.ndarray, config: dict | None = None) -> PipelineResult:
    """Pure function: BGR image → pill count + locations."""
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = resize_if_large(gray, cfg["max_dimension"])
    
    # ... pipeline steps ...
    
    return PipelineResult(count=len(pills), centers=centers, boxes=boxes)
```

### Pattern 2: Config as Flat Dict with Clear Names

**What:** Pipeline parameters stored in a flat dict with descriptive keys. No nested config, no env vars.
**When:** Prototype stage — refactor to dataclass/file later if needed.
**Why:** Easy to override from CLI args, easy to tune, no abstraction overhead.
**Example:**
```python
# config.py
DEFAULT_CONFIG = {
    "max_dimension": 1024,         # resize large images before processing
    "blur_kernel": 5,              # Gaussian blur kernel size
    "clahe_clip_limit": 2.0,       # CLAHE contrast enhancement
    "morph_kernel": 3,             # morphology kernel size
    "open_iterations": 1,          # erosion then dilation passes
    "close_iterations": 2,         # dilation then erosion passes
    "min_pill_area": 100,          # minimum contour area (pixels)
    "max_pill_area_ratio": 0.3,    # max area as fraction of image
    "min_circularity": 0.4,        # shape filter (1.0 = perfect circle)
    "distance_threshold": 0.5,     # watershed separation sensitivity
}
```

### Pattern 3: Batch Loop with Per-Image Error Handling

**What:** Each image processed in try/except; one failure doesn't stop the batch.
**When:** Always in batch mode.
**Why:** User may have 100 images; stopping at image 3 because of a corrupt file is frustrating.
**Example:**
```python
# batch.py
def run_batch(input_dir: Path, output_dir: Path, config: dict) -> list[ImageResult]:
    results = []
    images = discover_images(input_dir)
    
    for img_path in images:
        try:
            img = cv2.imread(str(img_path))
            if img is None:
                results.append(ImageResult(img_path.name, 0, [], [], 0, "Failed to load"))
                continue
            
            t0 = time.perf_counter()
            result = count_pills(img, config)
            elapsed = (time.perf_counter() - t0) * 1000
            
            annotated = annotate(img, result.centers)
            cv2.imwrite(str(output_dir / img_path.name), annotated)
            
            results.append(ImageResult(img_path.name, result.count, result.centers, result.boxes, elapsed, None))
        except Exception as e:
            results.append(ImageResult(img_path.name, 0, [], [], 0, str(e)))
    
    return results
```

### Pattern 4: Debug Mode with Intermediate Image Saving

**What:** `--debug` flag saves intermediate pipeline stages as images (grayscale, binary, markers, etc.).
**When:** During development and tuning. Always optional.
**Why:** Visual debugging is essential for CV — seeing why a threshold failed is faster than reading logs.
**Example:**
```python
def count_pills(image: np.ndarray, config: dict, debug_dir: Path | None = None) -> PipelineResult:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if debug_dir:
        cv2.imwrite(str(debug_dir / "01_gray.jpg"), gray)
    
    enhanced = apply_clahe(gray, config)
    if debug_dir:
        cv2.imwrite(str(debug_dir / "02_clahe.jpg"), enhanced)
    
    binary = threshold(enhanced, config)
    if debug_dir:
        cv2.imwrite(str(debug_dir / "03_binary.jpg"), binary)
    # ... etc
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Script

**What:** Everything in one file — CLI parsing, image loading, CV logic, annotation, reporting.
**Why bad:** Untestable, hard to tune parameters, can't reuse pipeline separately.
**Instead:** Separate into `cli.py`, `batch.py`, `pipeline.py`, `annotator.py`, `reporter.py`, `config.py`.

### Anti-Pattern 2: Pipeline Does I/O

**What:** `cv2.imread()` / `cv2.imwrite()` calls inside the pipeline function.
**Why bad:** Can't test with synthetic images, can't benchmark without files, couples logic to filesystem.
**Instead:** Pipeline receives numpy array, returns result. I/O stays in batch orchestrator.

### Anti-Pattern 3: Global Mutable State

**What:** Module-level variables that pipeline reads/writes (e.g., global counters, cached results).
**Why bad:** Breaks when processing multiple images, can't parallelize later, hard to debug.
**Instead:** All state passed through function arguments and return values.

### Anti-Pattern 4: Magic Numbers

**What:** `cv2.threshold(gray, 127, 255, ...)` with unnamed constants scattered through code.
**Why bad:** Can't tune without understanding entire flow. Each number needs a name.
**Instead:** All thresholds in `config.py` with descriptive names. Pipeline references `config["min_pill_area"]` not `100`.

### Anti-Pattern 5: Premature Optimization

**What:** Multiprocessing, GPU acceleration, memory-mapped files before validating pipeline accuracy.
**Why bad:** Adds complexity before knowing if the pipeline even works correctly.
**Instead:** Single-threaded, simple loop first. Optimize after accuracy is validated.

## Build Order (Dependencies)

```
Phase 1: Core Pipeline (no I/O)
  └─ pipeline.py — pure CV logic, testable with synthetic images
  └─ config.py — parameter definitions
  
Phase 2: Single Image CLI
  └─ cli.py — argparse, --input image.jpg
  └─ annotator.py — draw results on image
  └─ Integrate: load → pipeline → annotate → save
  
Phase 3: Batch Mode
  └─ batch.py — folder scanning, per-image loop, error handling
  └─ reporter.py — JSON output + terminal summary
  └─ cli.py update: --input dir, --output dir
  
Phase 4: Polish
  └─ Debug mode (--debug saves intermediate images)
  └─ Progress bar (tqdm)
  └─ Config override via CLI (--min-area, --threshold, etc.)
```

### Why This Order

| Phase | Rationale |
|-------|-----------|
| **1. Pipeline first** | Everything depends on it. Must work before adding I/O. Can test with `np.zeros((512,512,3), dtype=np.uint8)` immediately. |
| **2. Single image** | Validate pipeline on real images before building batch loop. Faster feedback loop during tuning. |
| **3. Batch mode** | Add once single-image works. This is the actual user workflow. |
| **4. Polish** | Nice-to-haves that don't affect correctness. |

## Porting from Existing TypeScript Pipeline

The existing `lib/pill-cv.ts` (760 lines) has patterns worth porting:

| TypeScript Pattern | Python Equivalent | Notes |
|-------------------|-------------------|-------|
| 7 mask candidates + scoring | Keep if accuracy needed | More complex but handles varied backgrounds |
| `PillCVConfig` interface | `DEFAULT_CONFIG` dict | Simplify to flat dict for prototype |
| Mat cleanup in try/finally | Not needed | Python OpenCV uses numpy arrays, GC handles memory |
| `getCV()` singleton | Not needed | `import cv2` is instant in Python |
| Base64 decode via jimp | `cv2.imread()` | Much simpler in Python |
| Connected components + distance transform | Same API | `cv2.connectedComponents()`, `cv2.distanceTransform()` |

**Recommendation:** Port the pipeline logic (steps 3-6 from `pill-cv.ts`) but simplify the structure. The 7-candidate mask scoring is clever — consider porting it if single-threshold approach doesn't work well on the actual images.

## Project File Structure

```
pill-counter-cli/
├── cli.py              # Entry point, argparse
├── batch.py            # Folder scanning, orchestration
├── pipeline.py         # Core CV logic (pure function)
├── annotator.py        # Draw results on images
├── reporter.py         # JSON report generation
├── config.py           # Pipeline parameters
├── requirements.txt    # opencv-python, numpy
├── README.md           # Usage instructions
└── tests/
    └── test_pipeline.py  # Synthetic image tests
```

## Sources

- **rembg architecture** (DeepWiki) — modular CLI + core function separation pattern [HIGH confidence]
- **Rishita-Rao/Automatic-pill-counter** — Python watershed pipeline reference implementation [HIGH confidence]
- **celankannan/Pill-Detection** — HSV segmentation + connected components pattern [HIGH confidence]
- **Real Python argparse guide** — CLI structure best practices [HIGH confidence]
- **Existing `lib/pill-cv.ts`** — portable pipeline logic [HIGH confidence]
- **Existing `lib/pill-cv-config.ts`** — parameter naming conventions [HIGH confidence]

---

*Architecture research: 2026-05-28*
