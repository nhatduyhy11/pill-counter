# Phase 1: Core Pipeline + CLI - Research

**Researched:** 2026-05-28
**Domain:** Classical computer vision (OpenCV) for pill counting
**Confidence:** HIGH

## Summary

Phase 1 implements the core CV pipeline and CLI for batch pill counting. The pipeline follows Option B from research: grayscale → CLAHE → threshold → morphology → distance transform → watershed → contour filtering. The critical technical challenge is watershed over-segmentation and distance transform sensitivity — these are the #1 causes of wrong counts in every OpenCV pill-counting implementation reviewed.

The existing TypeScript pipeline (`lib/pill-cv.ts`) uses a 7-candidate mask scoring approach that tries multiple thresholding strategies and picks the best one. For the Python prototype, we simplify to a single pipeline with auto-detected threshold direction (BINARY vs BINARY_INV based on corner pixel brightness). The pipeline is a pure function: `numpy.ndarray → PipelineResult` with no file I/O inside CV logic.

**Primary recommendation:** Implement marker-based watershed with distance transform for touching pill separation. Use corner-sampling for background detection with fallback to try-both-thresholds strategy.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opencv-python | 4.13.0 | All CV functions (watershed, morphology, distance transform, contours) | Mature Python bindings, all needed functions included |
| numpy | 2.4.6 | Array operations, OpenCV images are numpy arrays | Required dependency for OpenCV |
| tqdm | 4.67.3 | Progress bars for batch processing | Standard CLI progress indicator |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| argparse | stdlib | CLI argument parsing | Always — built-in, sufficient for single-command CLI |
| pathlib | stdlib | File path handling | Always — modern Python path operations |
| json | stdlib | JSON report output | Always — for structured output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| argparse | click/typer | Overkill for single-command CLI, adds dependency |
| opencv-python | scikit-image | Slower, less complete for our use case |
| tqdm | rich.progress | Heavier dependency, tqdm is sufficient |

**Installation:**
```bash
pip install opencv-python numpy tqdm
```

**Version verification:**
```bash
pip index versions opencv-python  # Latest: 4.13.0.92
pip index versions numpy          # Latest: 2.4.6
pip index versions tqdm           # Latest: 4.67.3
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CLI Entry  │────▶│  Batch Loop │────▶│  Pipeline   │
│  (cli.py)    │     │ (batch.py)  │     │(pipeline.py)│
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Annotator  │     │  Config     │
                    │(annotator.py│     │(config.py)  │
                    └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Reporter   │
                    │(reporter.py)│
                    └─────────────┘
```

### Recommended Project Structure
```
pill_counter/
├── __init__.py
├── cli.py           # argparse entry point
├── batch.py         # folder scanning, error handling, orchestration
├── pipeline.py      # pure CV logic (no file I/O)
├── annotator.py     # draws red dots + numbers on images
├── reporter.py      # JSON report + terminal summary
└── config.py        # flat dict of pipeline parameters
tests/
├── test_pipeline.py # unit tests with synthetic images
└── test_cli.py      # integration tests
pyproject.toml       # PEP 621 project metadata
```

### Pattern 1: Pure Function Pipeline

**What:** Pipeline takes numpy array in, returns pill count + center coordinates out. No file I/O inside CV logic.

**When to use:** Always — keeps pipeline testable with synthetic images, separates concerns cleanly.

**Example:**
```python
from dataclasses import dataclass
from typing import List, Tuple
import numpy as np

@dataclass
class PipelineResult:
    count: int
    centers: List[Tuple[int, int]]  # (x, y) pixel coordinates
    debug_images: dict  # intermediate images for debug mode

def count_pills(image: np.ndarray, config: dict) -> PipelineResult:
    """
    Pure function: numpy array in, pill count out.
    No file I/O, no side effects.
    """
    # 1. Grayscale conversion
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 2. Background detection from corners
    bg_type = detect_background(gray)
    
    # 3. Blur + threshold
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = auto_threshold(blurred, bg_type)
    
    # 4. Morphology cleanup
    cleaned = morphology_cleanup(binary)
    
    # 5. Distance transform + watershed
    markers = distance_transform_watershed(cleaned)
    
    # 6. Contour filtering
    centers = filter_contours(markers, config)
    
    return PipelineResult(
        count=len(centers),
        centers=centers,
        debug_images={}
    )
```

### Pattern 2: Background Auto-Detection from Corners

**What:** Sample pixel brightness from image corners to determine white paper vs silver tray background.

**When to use:** Every image — determines threshold direction (BINARY vs BINARY_INV).

**Example:**
```python
def detect_background(gray: np.ndarray, sample_size: int = 20) -> str:
    """
    Sample corners to detect background type.
    Returns 'light' or 'dark'.
    """
    h, w = gray.shape
    corners = [
        gray[0:sample_size, 0:sample_size],           # top-left
        gray[0:sample_size, w-sample_size:w],         # top-right
        gray[h-sample_size:h, 0:sample_size],         # bottom-left
        gray[h-sample_size:h, w-sample_size:w]        # bottom-right
    ]
    
    # Use median to avoid outlier pixels (pills at edges)
    all_pixels = np.concatenate([c.ravel() for c in corners])
    median_brightness = np.median(all_pixels)
    
    return 'light' if median_brightness > 128 else 'dark'
```

### Pattern 3: Marker-Based Watershed for Touching Pills

**What:** Use distance transform to find sure foreground markers, then watershed to separate touching pills.

**When to use:** Always — standard approach for separating touching objects.

**Example:**
```python
def distance_transform_watershed(binary: np.ndarray) -> np.ndarray:
    """
    Separate touching pills using distance transform + watershed.
    Returns marker image where each pill has unique label.
    """
    # 1. Morphology cleanup
    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # 2. Sure background (dilate)
    sure_bg = cv2.dilate(opening, kernel, iterations=3)
    
    # 3. Distance transform for sure foreground
    dist = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)
    
    # 4. Threshold distance map (critical parameter!)
    _, sure_fg = cv2.threshold(dist, 0.5 * dist.max(), 255, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg)
    
    # 5. Unknown region
    unknown = cv2.subtract(sure_bg, sure_fg)
    
    # 6. Connected components for markers
    _, markers = cv2.connectedComponents(sure_fg)
    
    # 7. CRITICAL: Shift labels so background is not 0
    markers = markers + 1
    markers[unknown == 255] = 0
    
    # 8. Watershed
    # Note: watershed needs 3-channel image
    img_3ch = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    markers = cv2.watershed(img_3ch, markers)
    
    return markers
```

### Anti-Patterns to Avoid

- **Skipping marker label shift:** After `connectedComponents`, background is labeled 0. Watershed treats 0 as unknown. MUST do `markers = markers + 1; markers[unknown == 255] = 0` or watershed merges pills with background.

- **Using wrong threshold direction:** For light background (white paper), use `THRESH_BINARY_INV` to make pills white. For dark background (silver tray), use `THRESH_BINARY`. Auto-detect from corner brightness.

- **Not normalizing distance transform:** Distance values vary widely by image. MUST normalize to [0,1] before thresholding.

- **Fixed distance transform threshold:** The threshold (0.4, 0.5, 0.7 × max) is the #1 parameter to tune. Start with 0.5, adjust based on test images.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance transform | Manual pixel distance calc | `cv2.distanceTransform()` | Optimized C++ implementation, handles edge cases |
| Connected components | Manual flood fill | `cv2.connectedComponents()` | Proper labeling, handles 8-connectivity |
| Watershed | Manual flooding algorithm | `cv2.watershed()` | Marker-based, handles over-segmentation |
| Contour finding | Manual boundary tracing | `cv2.findContours()` | Handles hierarchy, multiple methods |
| Image reading/writing | Manual JPEG/PNG decoding | `cv2.imread()`/`cv2.imwrite()` | Handles all formats, color spaces |

**Key insight:** OpenCV's implementations are optimized C++ with decades of edge-case handling. Custom Python implementations will be 100-1000x slower and miss edge cases.

## Common Pitfalls

### Pitfall 1: Watershed Over-Segmentation

**What goes wrong:** Watershed creates too many regions, counting one pill as multiple.

**Why it happens:** Noise in binary image creates false foreground markers.

**How to avoid:**
1. Apply Gaussian blur before thresholding
2. Use morphological OPEN after thresholding to remove noise
3. Use distance transform (not erosion) for sure foreground markers
4. Apply minimum marker area threshold

**Warning signs:** Count is much higher than expected, debug images show many small regions.

### Pitfall 2: Marker Label Confusion (Background=0 Bug)

**What goes wrong:** Watershed merges pills with background, count is too low.

**Why it happens:** `connectedComponents` labels background as 0. Watershed treats 0 as unknown region.

**How to avoid:**
```python
_, markers = cv2.connectedComponents(sure_fg)
markers = markers + 1  # Shift all labels up by 1
markers[unknown == 255] = 0  # Now 0 means "unknown" to watershed
```

**Warning signs:** Count is 0 or much lower than expected, watershed output shows large merged regions.

### Pitfall 3: Distance Transform Threshold Sensitivity

**What goes wrong:** Threshold too high → pills merge. Threshold too low → over-segmentation.

**Why it happens:** The threshold is relative to max distance, which varies by image.

**How to avoid:**
1. Normalize distance to [0,1] first: `cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)`
2. Use threshold 0.4-0.7 × max as starting point
3. Try multiple thresholds and pick best (like existing TypeScript pipeline does with `[0.58, 0.48, 0.38]`)

**Warning signs:** Count varies wildly with small threshold changes.

### Pitfall 4: THRESH_BINARY vs THRESH_BINARY_INV Confusion

**What goes wrong:** Threshold produces inverted image, pills become background.

**Why it happens:** Using wrong threshold direction for background type.

**How to avoid:**
- Light background (white paper): Use `THRESH_BINARY_INV` (pills are dark → become white in binary)
- Dark background (silver tray): Use `THRESH_BINARY` (pills are light → stay white in binary)
- Auto-detect from corner brightness: median > 128 → light background

**Warning signs:** Binary image shows pills as black on white (should be white on black).

### Pitfall 5: Otsu Fails on Non-Bimodal Images

**What goes wrong:** Otsu threshold produces poor separation.

**Why it happens:** Otsu assumes bimodal histogram (two peaks). Images with complex backgrounds may not be bimodal.

**How to avoid:**
1. Use adaptive thresholding as fallback: `cv2.adaptiveThreshold()`
2. Try both Otsu and adaptive, pick result with better foreground ratio
3. Existing TypeScript pipeline tries 7 candidates and scores them

**Warning signs:** Foreground ratio is very low (<0.2%) or very high (>70%).

### Pitfall 6: Corner Sampling Fails When Pills at Edges

**What goes wrong:** Background detection picks pill pixels instead of background.

**Why it happens:** Pills touching image edges corrupt corner samples.

**How to avoid:**
1. Sample multiple small regions, not single pixels
2. Use median (not mean) to reject outlier pixels
3. Add fallback: try both threshold directions, pick one with reasonable foreground ratio (2-70%)

**Warning signs:** Background detection returns inconsistent results for similar images.

## Code Examples

### Complete Pipeline Implementation

```python
# Source: Based on OpenCV watershed tutorial + research findings
import cv2
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class PipelineConfig:
    """Pipeline parameters with clear names for tuning."""
    blur_kernel_size: int = 5
    morphology_kernel_size: int = 3
    open_iterations: int = 2
    close_iterations: int = 2
    distance_threshold: float = 0.5  # 0.4-0.7 range, critical parameter
    min_area_ratio: float = 0.0001  # Min contour area as ratio of image area
    max_area_ratio: float = 0.1     # Max contour area as ratio of image area
    min_circularity: float = 0.3    # Circularity threshold (0-1)

@dataclass
class PipelineResult:
    """Pipeline output — no file I/O, pure data."""
    count: int
    centers: List[Tuple[int, int]]  # (x, y) pixel coordinates
    bounding_boxes: List[Tuple[int, int, int, int]]  # (x, y, w, h)
    debug_images: dict  # Intermediate images for debug mode

def count_pills(image: np.ndarray, config: PipelineConfig = PipelineConfig()) -> PipelineResult:
    """
    Pure function: numpy array in, pill count out.
    No file I/O, no side effects.
    """
    h, w = image.shape[:2]
    image_area = h * w
    
    # Step 1: Grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Step 2: Background detection
    bg_type = detect_background(gray)
    
    # Step 3: Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (config.blur_kernel_size, config.blur_kernel_size), 0)
    
    # Step 4: Threshold (auto-detect direction)
    binary = auto_threshold(blurred, bg_type)
    
    # Step 5: Morphology cleanup (remove noise, fill holes)
    kernel = np.ones((config.morphology_kernel_size, config.morphology_kernel_size), np.uint8)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=config.open_iterations)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=config.close_iterations)
    
    # Step 6: Distance transform for sure foreground
    dist = cv2.distanceTransform(closed, cv2.DIST_L2, 5)
    cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)
    
    # Step 7: Threshold distance map
    _, sure_fg = cv2.threshold(dist, config.distance_threshold * dist.max(), 255, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg)
    
    # Step 8: Sure background (dilate)
    sure_bg = cv2.dilate(closed, kernel, iterations=3)
    
    # Step 9: Unknown region
    unknown = cv2.subtract(sure_bg, sure_fg)
    
    # Step 10: Connected components for markers
    _, markers = cv2.connectedComponents(sure_fg)
    
    # Step 11: CRITICAL — shift labels so background is not 0
    markers = markers + 1
    markers[unknown == 255] = 0
    
    # Step 12: Watershed (needs 3-channel image)
    img_3ch = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    markers = cv2.watershed(img_3ch, markers)
    
    # Step 13: Extract contours from watershed output
    # Watershed marks boundaries as -1, regions with unique labels
    centers = []
    bounding_boxes = []
    
    # Get unique labels (exclude -1 for boundaries, 0 for unknown, 1 for background)
    unique_labels = np.unique(markers)
    for label in unique_labels:
        if label <= 1:  # Skip background and unknown
            continue
        
        # Create mask for this region
        region_mask = np.uint8(markers == label) * 255
        
        # Find contours
        contours, _ = cv2.findContours(region_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            
            # Filter by area
            if area < image_area * config.min_area_ratio:
                continue
            if area > image_area * config.max_area_ratio:
                continue
            
            # Filter by circularity
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * np.pi * area / (perimeter ** 2)
            if circularity < config.min_circularity:
                continue
            
            # Get centroid and bounding box
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            x, y, w, h = cv2.boundingRect(cnt)
            
            centers.append((cx, cy))
            bounding_boxes.append((x, y, w, h))
    
    return PipelineResult(
        count=len(centers),
        centers=centers,
        bounding_boxes=bounding_boxes,
        debug_images={
            'gray': gray,
            'binary': binary,
            'opened': opened,
            'closed': closed,
            'distance': dist,
            'sure_fg': sure_fg,
            'markers': markers
        }
    )

def detect_background(gray: np.ndarray, sample_size: int = 20) -> str:
    """Sample corners to detect background type."""
    h, w = gray.shape
    corners = [
        gray[0:sample_size, 0:sample_size],
        gray[0:sample_size, w-sample_size:w],
        gray[h-sample_size:h, 0:sample_size],
        gray[h-sample_size:h, w-sample_size:w]
    ]
    all_pixels = np.concatenate([c.ravel() for c in corners])
    median_brightness = np.median(all_pixels)
    return 'light' if median_brightness > 128 else 'dark'

def auto_threshold(gray: np.ndarray, bg_type: str) -> np.ndarray:
    """Apply threshold with correct direction for background type."""
    if bg_type == 'light':
        # Light background → pills are dark → use BINARY_INV
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        # Dark background → pills are light → use BINARY
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary
```

### Annotator Implementation

```python
import cv2
import numpy as np
from typing import List, Tuple

def annotate_image(
    image: np.ndarray,
    centers: List[Tuple[int, int]],
    bounding_boxes: List[Tuple[int, int, int, int]]
) -> np.ndarray:
    """
    Draw red dot + sequence number on each detected pill.
    Returns annotated copy of image.
    """
    annotated = image.copy()
    
    for i, ((cx, cy), (x, y, w, h)) in enumerate(zip(centers, bounding_boxes), 1):
        # Red dot at centroid
        cv2.circle(annotated, (cx, cy), 5, (0, 0, 255), -1)
        
        # Sequence number
        cv2.putText(
            annotated,
            str(i),
            (cx + 10, cy - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2
        )
        
        # Optional: bounding box
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 2)
    
    return annotated
```

### CLI Entry Point

```python
import argparse
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(
        description='Count pills in images using computer vision'
    )
    parser.add_argument(
        'input',
        help='Input folder or image path'
    )
    parser.add_argument(
        '-o', '--output',
        default='./output',
        help='Output directory for annotated images (default: ./output)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Save intermediate CV images for debugging'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Verbose output'
    )
    
    args = parser.parse_args()
    
    # Validate input
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input path does not exist: {input_path}", file=sys.stderr)
        sys.exit(1)
    
    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Process images
    if input_path.is_dir():
        from .batch import process_folder
        result = process_folder(input_path, output_path, args)
    else:
        from .batch import process_single_image
        result = process_single_image(input_path, output_path, args)
    
    # Exit code
    if result.errors > 0:
        sys.exit(2)  # Partial failure
    sys.exit(0)  # Success

if __name__ == '__main__':
    main()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Connected components only | Distance transform + watershed | Standard since 2010s | Properly separates touching objects |
| Manual threshold selection | Otsu auto-threshold | Standard since 1979 | Automatic, adapts to image |
| Single threshold try | Multiple candidates + scoring | Recent (existing TS pipeline) | More robust across varied images |

**Deprecated/outdated:**
- Classical watershed (without markers): Over-segments badly, never use
- Erosion for sure foreground: Less reliable than distance transform for touching objects

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Distance threshold 0.5 is good starting point | Pattern 3 | May need tuning to 0.4-0.7 range |
| A2 | Morphology kernel size 3×3 is sufficient | Pattern 3 | May need 5×5 for larger images |
| A3 | Min circularity 0.3 rejects noise but keeps pills | Code Examples | May need adjustment for non-round pills |
| A4 | Corner sample size 20px is sufficient for background detection | Pattern 2 | May need larger sample for high-res images |

## Open Questions (RESOLVED)

1. **Optimal distance transform threshold** — RESOLVED
   - Decision: Start with 0.5, expose as `DISTANCE_THRESHOLD` in config.py for easy tuning
   - Rationale: 0.5 is midpoint of recommended 0.4-0.7 range; existing TS pipeline uses 0.58
   - Will validate on test-img/ during execution

2. **Background detection robustness** — RESOLVED
   - Decision: Implement try-both-thresholds fallback — try BINARY_INV first, if foreground ratio outside 2-70%, try BINARY
   - Rationale: Research confirms corner sampling fails when pills touch edges; fallback is cheap insurance
   - Foreground ratio bounds from research: 2% min (reject noise), 70% max (reject inverted)

3. **Performance on high-res images** — RESOLVED
   - Decision: Add resize step if max dimension > 1024px before processing
   - Rationale: Matches existing TS pipeline behavior; 1024px is sufficient for pill counting accuracy
   - Saves processing time without meaningful accuracy loss

## Sources

### Primary (HIGH confidence)
- OpenCV Watershed Tutorial — https://docs.opencv.org/4.x/d3/db4/tutorial_py_watershed.html
- OpenCV Distance Transform — https://docs.opencv.org/4.x/d2/dbd/tutorial_distance_transform.html
- OpenCV Thresholding — https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html
- Existing `lib/pill-cv.ts` — 7-candidate mask scoring approach, distance threshold values [0.58, 0.48, 0.38]

### Secondary (HIGH confidence)
- PyImageSearch Watershed guide — practical watershed implementation patterns
- Rishita-Rao/Automatic-pill-counter — Python watershed pipeline reference

### Tertiary (MEDIUM confidence)
- Stack Overflow pill counting threads — edge cases and workarounds

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via PyPI, strong rationale for each choice
- Architecture: HIGH — pure-function pipeline pattern is well-established
- Pitfalls: HIGH — all verified against official OpenCV docs and real implementations

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (30 days — stable domain)
