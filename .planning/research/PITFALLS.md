# Domain Pitfalls: Python CLI Batch Pill Counting with OpenCV

**Domain:** Computer vision pill counting (classical CV, no ML)
**Researched:** 2026-05-28
**Overall confidence:** HIGH (verified against OpenCV docs, Stack Overflow, GitHub implementations, academic papers)

---

## Critical Pitfalls

Mistakes that cause incorrect counts or require pipeline rewrites.

### Pitfall 1: Watershed Over-segmentation from Noise

**What goes wrong:** Watershed treats intensity as topographic surface. Minor noise, texture variations, or pill imprints create false local minima → algorithm "floods" from noise points → produces dozens of tiny regions instead of one per pill.

**Why it happens:** Classical watershed (without markers) treats every local minimum as a separate flooding origin. Even with marker-based watershed, insufficient preprocessing leaves noise that creates false markers.

**Consequences:** Count inflated by 2-10x. Debug output shows many tiny colored regions inside each pill.

**Prevention:**
- ALWAYS use marker-based watershed (OpenCV's implementation), never classical
- Apply Gaussian blur (5×5 or 7×7) BEFORE thresholding to suppress texture noise
- Apply morphological OPEN (erosion → dilation) AFTER thresholding to remove small noise blobs
- Use distance transform to find sure foreground markers (not raw erosion)

**Detection:** Visual inspection of debug images. If `connectedComponents` returns >2x expected count, over-segmentation is occurring.

**Phase:** Phase 1 (pipeline setup) — establish correct preprocessing chain from start.

---

### Pitfall 2: Distance Transform Threshold Sensitivity

**What goes wrong:** The threshold applied to distance transform output controls how many foreground markers are generated. Too low → over-segmentation (multiple markers per pill). Too high → under-segmentation (no markers for touching pills, they merge).

**Why it happens:** OpenCV tutorials use `0.7 * dist_transform.max()` which works for coins but fails for:
- Elongated pills (distance transform peak is off-center)
- Small pills (distance values are low, threshold misses them)
- Touching pills (peak shifts toward the contact point)

**Consequences:** Either count too high (over-segmented) or too low (under-segmented). No single threshold works for all images.

**Prevention:**
- Use adaptive thresholding on distance transform: try multiple thresholds (e.g., [0.58, 0.48, 0.38]) and pick the one that produces the best marker count
- Normalize distance transform to [0, 1] before thresholding (required for Otsu compatibility)
- For elongated pills: consider using erosion instead of distance transform for sure foreground

**Detection:** Compare marker count to expected count. If markers < expected pills, threshold is too high. If markers > 2× expected, threshold is too low.

**Phase:** Phase 1 (pipeline tuning) — this is the #1 parameter to tune with real test images.

---

### Pitfall 3: Marker Label Confusion (Background = 0 Bug)

**What goes wrong:** `cv2.connectedComponents()` labels background as 0. Watershed treats label 0 as "unknown region" (to be decided). If you don't shift labels, watershed treats sure background as unknown → merges background with objects.

**Why it happens:** OpenCV's watershed documentation shows `markers = markers + 1` but many implementations skip this step.

**Consequences:** Watershed merges pills with background, or produces strange boundary artifacts. Count may be 0 or wildly wrong.

**Prevention:**
```python
ret, markers = cv2.connectedComponents(sure_fg)
markers = markers + 1  # CRITICAL: shift so background=1, not 0
markers[unknown == 255] = 0  # Only unknown regions get label 0
```

**Detection:** After watershed, check `markers.min()`. If it's -1 everywhere, labels are wrong. Visualize markers before watershed — background should be label 1, objects label 2+, unknown label 0.

**Phase:** Phase 1 (pipeline setup) — implement correctly from start, easy to miss.

---

### Pitfall 4: Morphology Kernel Size Must Be Odd

**What goes wrong:** OpenCV morphology operations (erode, dilate, open, close) require kernel size to be positive odd number (3, 5, 7...). Even sizes or 1×1 cause errors or no effect.

**Why it happens:** Developers try kernel sizes like 2×2 or 4×4, or use 1×1 kernel which has zero morphological effect.

**Consequences:** `cv2.error: bad kernel size for morphological operation` crash, or silently wrong results with 1×1 kernel.

**Prevention:**
- Always use `cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))` or `np.ones((3,3), np.uint8)`
- For round pills, use `cv2.MORPH_ELLIPSE` instead of `MORPH_RECT` — matches pill shape better
- Start with 3×3 kernel, increase only if noise isn't removed

**Detection:** Runtime error or visual inspection showing no morphological effect.

**Phase:** Phase 1 (pipeline setup) — basic OpenCV requirement.

---

### Pitfall 5: THRESH_BINARY vs THRESH_BINARY_INV Confusion

**What goes wrong:** Using wrong threshold type inverts foreground/background. Pills become background, background becomes pills.

**Why it happens:** The correct choice depends on whether pills are darker or lighter than background. White paper background → pills are darker → need `THRESH_BINARY_INV` (or `THRESH_OTSU` with `THRESH_BINARY_INV`). Dark tray → pills are lighter → need `THRESH_BINARY`.

**Consequences:** Count is 0 (no pills detected) or count equals "background blobs" instead of pills.

**Prevention:**
- Auto-detect: sample corner pixels to determine background brightness
- If corner median > 128 → light background → use `THRESH_BINARY_INV`
- If corner median ≤ 128 → dark background → use `THRESH_BINARY`
- Visualize binary output: pills should be WHITE, background should be BLACK

**Detection:** Visual inspection of thresholded image. If pills appear black on white, threshold is inverted.

**Phase:** Phase 1 (pipeline setup) — must handle both background types per PROJECT.md requirement.

---

### Pitfall 6: Otsu Thresholding Fails on Non-Bimodal Images

**What goes wrong:** Otsu's method assumes histogram has two clear peaks (foreground + background). If image has shadows, gradients, or multiple background colors, histogram isn't bimodal → Otsu picks wrong threshold.

**Why it happens:** Otsu minimizes intra-class variance. With 3+ peaks (foreground, background, shadow), it can't find optimal split.

**Consequences:** Threshold too high or too low. Parts of pills merge with background or vice versa.

**Prevention:**
- Use Otsu only after Gaussian blur (reduces noise, makes histogram more bimodal)
- Fall back to adaptive thresholding (`cv2.adaptiveThreshold`) when Otsu produces poor results
- For varying lighting: always use adaptive thresholding instead of global Otsu

**Detection:** Compare Otsu result with adaptive threshold result. If they differ significantly, Otsu is unreliable for that image.

**Phase:** Phase 1 — implement fallback strategy. Phase 2 — auto-select based on image characteristics.

---

### Pitfall 7: Background Detection from Corners Fails When Pills Are at Edges

**What goes wrong:** Many implementations sample corner pixels to detect background color. If a pill is in the corner, the "background" color is actually pill color → wrong threshold direction.

**Why it happens:** User places pills that extend to image edges, or crops image tightly around pills.

**Consequences:** Threshold inverted → count is 0 or wildly wrong.

**Prevention:**
- Sample multiple small regions near corners (not just single pixel)
- Use median of corner region, not single value
- Add fallback: if corner sampling gives ambiguous result (e.g., high variance), try both threshold directions and pick the one that produces more reasonable foreground ratio
- Consider sampling along all 4 edges, not just corners

**Detection:** Check `foregroundRatio` after thresholding. If < 0.002 or > 0.7, background detection likely failed.

**Phase:** Phase 1 — implement robust background detection. Critical for batch processing different images.

---

### Pitfall 8: findContours Retrieval Mode Confusion

**What goes wrong:** Using `cv2.RETR_TREE` returns all contours (including nested holes). Using `cv2.RETR_EXTERNAL` returns only outermost contours. Wrong choice either misses pills (treating holes as objects) or counts internal features.

**Why it happens:** Documentation shows both modes without clear guidance on when to use which.

**Consequences:** With `RETR_TREE`: count inflated by internal pill features. With `RETR_EXTERNAL`: may miss pills that have internal holes (rare but possible with translucent pills).

**Prevention:**
- For pill counting: use `cv2.RETR_EXTERNAL` — we want outermost boundary of each pill
- After finding contours, filter by area to remove noise
- If pills have internal features (imprints, scores), those are inside the outer contour and won't be counted separately

**Detection:** Compare contour count with `RETR_EXTERNAL` vs `RETR_TREE`. If significantly different, internal features are being detected.

**Phase:** Phase 1 — standard choice, implement once correctly.

---

## Moderate Pitfalls

### Pitfall 9: CLAHE Over-Enhancement Amplifies Noise

**What goes wrong:** CLAHE (Contrast Limited Adaptive Histogram Equalization) with high `clipLimit` amplifies noise along with contrast. Texture on pill surfaces, paper grain, and sensor noise all get enhanced.

**Why it happens:** Developers set `clipLimit=4.0` or higher trying to improve contrast, but this creates more problems than it solves.

**Consequences:** More noise in thresholded image → more false contours → inflated count.

**Prevention:**
- Use `clipLimit=2.0` (default) or lower
- Apply CLAHE BEFORE blur, not after (blur will smooth the enhanced noise)
- For controlled environments with good lighting, CLAHE may not be needed at all
- Test with and without CLAHE on your actual images

**Detection:** Compare contour count with and without CLAHE. If CLAHE increases count significantly, it's amplifying noise.

**Phase:** Phase 1 — decide if CLAHE is needed based on actual test images.

---

### Pitfall 10: Glossy/Translucent Pills Create False Edges

**What goes wrong:** Pills with glossy surfaces or translucent material reflect light, creating bright spots that threshold interprets as separate objects or holes in pills.

**Why it happens:** Specular reflections have higher intensity than pill surface. Threshold separates reflection from pill body.

**Consequences:** Single pill detected as 2+ objects (pill + reflection). Or pill has hole where reflection was, breaking contour.

**Prevention:**
- Use diffuse lighting (not point source) during image capture
- Apply morphological CLOSE after thresholding to fill small holes
- Use median blur (3×3) which preserves edges better than Gaussian for this case
- For batch processing: accept that glossy pills will have higher error rate

**Detection:** Visual inspection of thresholded image. Look for holes inside pills or bright spots that become separate blobs.

**Phase:** Phase 2 — handle as edge case after basic pipeline works. May need to document as known limitation.

---

### Pitfall 11: Elongated Pills Break Distance Transform Assumptions

**What goes wrong:** Distance transform assumes objects are roughly circular. For elongated pills (oblong, capsule shape), the distance peak is not at the geometric center but shifted toward the wider part. Watershed cuts perpendicular to the long axis, potentially splitting a single pill.

**Why it happens:** Distance transform measures distance to nearest edge. For an ellipse, the peak is at the center of the major axis, not at the centroid.

**Consequences:** Single elongated pill split into 2+ pieces by watershed. Count inflated.

**Prevention:**
- Use `cv2.fitEllipse()` to check if contour is elongated (aspect ratio > 1.5)
- For elongated contours: use erosion-based sure foreground instead of distance transform
- Or: use convexity defects to find natural separation points between touching elongated pills
- Consider using `cv2.MORPH_ELLIPSE` kernel for morphology operations

**Detection:** Check aspect ratio of detected contours. If many contours have aspect ratio > 2, distance transform may be splitting them.

**Phase:** Phase 2 — handle after basic circular pill counting works.

---

### Pitfall 12: Touching Pills Not Separated (Under-segmentation)

**What goes wrong:** When pills touch at edges, they form a single blob. Without watershed (or with wrong parameters), they're counted as one pill.

**Why it happens:** Simple contour detection treats any connected region as one object. Watershed needs proper markers to separate touching objects.

**Consequences:** Count lower than actual. Error proportional to number of touching pairs.

**Prevention:**
- ALWAYS use watershed for touching pill separation
- Ensure distance transform threshold is low enough to create markers in each pill (see Pitfall 2)
- For area-based estimation: if blob area > 1.5× median pill area, it's likely multiple pills
- Use iterative watershed: after first pass, check for oversized blobs and re-run watershed on them

**Detection:** Compare blob area distribution. If some blobs are 2-3× median area, they're likely merged pills.

**Phase:** Phase 1 — core requirement per PROJECT.md. Must work from start.

---

### Pitfall 13: Batch Processing — Parameters Tuned for One Image Fail on Others

**What goes wrong:** Parameters tuned on one test image produce wrong results on other images with different lighting, pill count, or arrangement.

**Why it happens:** CV parameters are image-dependent. What works for 5 pills on white paper may fail for 20 pills on silver tray.

**Consequences:** Batch report shows wildly different accuracy across images. Some images 100% accurate, others 50% or 0%.

**Prevention:**
- Test with diverse images during development (different counts, backgrounds, lighting)
- Use adaptive parameters where possible (Otsu for threshold, adaptive for varying light)
- Implement confidence scoring: report when pipeline is uncertain (e.g., foreground ratio out of expected range)
- Consider multiple pipeline candidates and pick best result (as existing `pill-cv.ts` does)

**Detection:** Run batch on 10+ diverse images. Check variance in accuracy. High variance indicates overfitting to specific conditions.

**Phase:** Phase 2 — after basic pipeline works, optimize for batch robustness.

---

### Pitfall 14: Data Type Mismatches with Watershed

**What goes wrong:** Watershed requires:
- Input image: 8-bit 3-channel (CV_8UC3, i.e., BGR)
- Markers: 32-bit single-channel (CV_32SC1)

If markers are CV_8U or image is grayscale, watershed crashes or produces garbage.

**Why it happens:** Developers convert image to grayscale for processing but forget to convert back to BGR for watershed. Or use `np.uint8` for markers instead of `np.int32`.

**Consequences:** `cv2.error: Assertion failed` crash, or silent corruption of marker array.

**Prevention:**
```python
# Image must be 3-channel BGR
if len(img.shape) == 2:
    img_bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
else:
    img_bgr = img.copy()

# Markers must be int32
markers = np.zeros(img.shape[:2], dtype=np.int32)
```

**Detection:** Runtime error or check `markers.dtype` before watershed call.

**Phase:** Phase 1 — basic OpenCV requirement, easy to miss.

---

## Minor Pitfalls

### Pitfall 15: Contour Area Calculation Inaccurate for Self-Intersecting Contours

**What goes wrong:** `cv2.contourArea()` uses Green's formula which can give wrong results for self-intersecting contours.

**Why it happens:** Watershed boundaries can create complex contour shapes that self-intersect.

**Consequences:** Area-based filtering may incorrectly accept or reject contours.

**Prevention:**
- Use `cv2.contourArea()` only for simple (non-self-intersecting) contours
- For complex shapes, use `cv2.arcLength()` or count pixels in mask instead
- Filter contours by bounding box area as secondary check

**Detection:** Compare `cv2.contourArea()` with pixel count in contour mask. Large discrepancy indicates self-intersection.

**Phase:** Phase 2 — edge case, unlikely to be common with pill shapes.

---

### Pitfall 16: Median Pill Area Estimation Fails When Most Pills Touch

**What goes wrong:** Estimating single pill area by taking median of contour areas. If most pills are touching (forming 2-pill, 3-pill blobs), median is inflated.

**Why it happens:** With 10 pills where 8 are touching in pairs, median area is 2-pill area, not 1-pill area.

**Consequences:** All contours appear to be single pills (because 2-pill blob is "normal" size). Count is half of actual.

**Prevention:**
- Sort areas and look for natural breakpoint (e.g., using histogram of areas)
- Use minimum area as estimate of single pill (assuming at least one pill is isolated)
- Or: require user to provide single-pill area as calibration input
- Consider: if area distribution is bimodal, use the lower mode as single-pill area

**Detection:** Check area distribution. If it's a smooth curve without clear single-pill mode, estimation is unreliable.

**Phase:** Phase 2 — after basic counting works, improve area estimation.

---

### Pitfall 17: Image Resize Destroys Small Pills

**What goes wrong:** Resizing image to reduce processing time (e.g., maxDimension=1024) can make small pills disappear or merge.

**Why it happens:** If original image is 4000px wide with 20px pills, resizing to 1024px makes pills ~5px. At this size, they may be below minimum area threshold or merge with neighbors.

**Consequences:** Small pills not detected. Count lower than actual.

**Prevention:**
- Set `maxDimension` based on expected pill size in image
- Check if resize would make smallest expected pill < 10px across
- If so, don't resize (accept slower processing)
- Or: detect pills at full resolution, then annotate on resized image

**Detection:** Compare count at full resolution vs resized. If significantly different, resize is destroying information.

**Phase:** Phase 1 — decide resize strategy based on actual image sizes.

---

### Pitfall 18: Silver/Metallic Tray Background Reflects Differently

**What goes wrong:** Silver medical tray has mild reflections that vary across the surface. Some areas brighter, some darker. Adaptive threshold may treat reflections as foreground.

**Why it happens:** Metallic surfaces create specular highlights that are brighter than the average background.

**Consequences:** False positive detections on tray surface. Count inflated.

**Prevention:**
- Use higher morphological opening iterations to remove small bright spots
- Increase minimum area threshold to ignore small reflection artifacts
- Consider HSV-based segmentation: reflections have low saturation, pills have higher saturation
- Document as known limitation for metallic backgrounds

**Detection:** Visual inspection of thresholded image for bright spots on tray surface.

**Phase:** Phase 2 — handle after basic white-paper pipeline works.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Pipeline setup (Phase 1) | Watershed over-segmentation, marker label bug, data type mismatch | Follow OpenCV tutorial exactly, visualize every intermediate step |
| Background detection (Phase 1) | Corner sampling fails when pills at edges | Sample multiple regions, add fallback logic |
| Thresholding (Phase 1) | Otsu fails on non-bimodal, wrong THRESH_BINARY direction | Implement adaptive fallback, auto-detect background brightness |
| Touching pill separation (Phase 1-2) | Distance transform threshold too high/low | Try multiple thresholds, use iterative watershed |
| Batch robustness (Phase 2) | Parameters tuned for one image fail on others | Test with diverse images, implement confidence scoring |
| Elongated pills (Phase 2) | Distance transform splits single pills | Check aspect ratio, use erosion fallback for elongated shapes |
| Glossy pills (Phase 2) | Reflections create false edges | Median blur, morphological close, document limitation |
| Area estimation (Phase 2) | Median fails when most pills touch | Use minimum area or histogram-based estimation |
| Silver tray (Phase 2) | Reflections detected as pills | Higher min area, HSV segmentation, document limitation |
| Annotation (Phase 3) | Center point wrong for elongated pills | Use centroid of contour, not distance transform peak |

---

## Quick Reference: Parameter Ranges

| Parameter | Safe Range | Too Low → | Too High → |
|-----------|-----------|-----------|------------|
| Gaussian blur kernel | 3-7 (odd) | Noise remains | Pills blurred together |
| Morphology kernel | 3-7 (odd) | Noise remains | Pills eroded too much |
| Distance transform threshold | 0.3-0.6 × max | Over-segmentation | Under-segmentation |
| Adaptive block size | 11-51 (odd) | Follows noise | Acts like global threshold |
| Adaptive C | 2-15 | More noise | Lose thin features |
| Min area filter | 50-500 px | Noise accepted | Small pills rejected |
| CLAHE clip limit | 1.0-3.0 | No effect | Amplifies noise |

---

## Sources

- OpenCV Watershed Tutorial: https://docs.opencv.org/4.x/d3/db4/tutorial_py_watershed.html
- OpenCV Distance Transform: https://docs.opencv.org/4.x/d2/dbd/tutorial_distance_transform.html
- PyImageSearch Watershed: https://pyimagesearch.com/2015/11/02/watershed-opencv/
- OpenCV.org Watershed Guide: https://opencv.org/watershed-segmentation-using-opencv/
- Stack Overflow: "How to count tablets successfully" — touching pill separation
- Stack Overflow: "Watershed fails to properly segmented objects" — iterative watershed fix
- Stack Overflow: "Pill counting using only opencv" — CLAHE + median filtering approach
- Stack Overflow: "OpenCV watershed + otsu with distanceTransform" — data type issues
- GitHub: celankannan/Pill-Detection — green background + HSV approach
- GitHub: Rishita-Rao/Automatic-pill-counter — background auto-detection
- GitHub: jeunetoujour/PillCounter — lighting effects on pill detection
- JMIR Medical Informatics: "Effects of Background Colors, Flashes, and Exposure Values" — lighting impact study
- OpenCV Morphological Transformations: https://docs.opencv.org/4.x/d9/d61/tutorial_py_morphological_ops.html
- OpenCV Thresholding: https://docs.opencv.org/4.x/d7/d4d/tutorial_py_thresholding.html
- deadends.dev: Morphology kernel size errors — odd/even kernel issues

---

*Research confidence: HIGH — Pitfalls verified against official OpenCV documentation, multiple Stack Overflow discussions with working solutions, and real GitHub implementations of pill counting systems.*
