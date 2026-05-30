"""Pure CV pipeline for pill counting — no file I/O inside logic."""

import cv2
import numpy as np

from .config import DEFAULT_CONFIG, PipelineResult


def detect_background(gray: np.ndarray, sample_size: int = 20) -> str:
    """Sample corners to detect background type.

    Returns 'light' if median corner brightness > 128, else 'dark'.
    Uses median (not mean) to reject outlier pixels from pills at edges.
    """
    h, w = gray.shape
    corners = [
        gray[0:sample_size, 0:sample_size],           # top-left
        gray[0:sample_size, w - sample_size : w],     # top-right
        gray[h - sample_size : h, 0:sample_size],     # bottom-left
        gray[h - sample_size : h, w - sample_size : w],  # bottom-right
    ]
    all_pixels = np.concatenate([c.ravel() for c in corners])
    median_brightness = np.median(all_pixels)
    return "light" if median_brightness > 128 else "dark"


def auto_threshold(gray: np.ndarray, bg_type: str) -> np.ndarray:
    """Apply threshold with correct direction for background type.

    Light background (white paper): THRESH_BINARY_INV (pills are dark → become white)
    Dark background (silver tray): THRESH_BINARY (pills are light → stay white)
    """
    if bg_type == "light":
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def count_pills(image: np.ndarray, config: dict | None = None) -> PipelineResult:
    """Pure function: numpy array in, pill count out.

    Pipeline: grayscale → background detect → blur → threshold → morphology
    → distance transform → watershed → contour filtering → result.
    """
    if config is None:
        config = DEFAULT_CONFIG

    h, w = image.shape[:2]
    image_area = h * w

    # Step 1: Grayscale conversion (handle both BGR and grayscale input)
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Step 2: Background detection
    bg_type = detect_background(gray, config.get("background_sample_size", 20))

    # Step 3: Gaussian blur
    ksize = config.get("blur_kernel_size", 5)
    blurred = cv2.GaussianBlur(gray, (ksize, ksize), 0)

    # Step 4: Threshold (auto-detect direction)
    binary = auto_threshold(blurred, bg_type)

    # Step 5: Morphology cleanup
    mk = config.get("morphology_kernel_size", 3)
    kernel = np.ones((mk, mk), np.uint8)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=config.get("open_iterations", 2))
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=config.get("close_iterations", 2))

    # Step 6: Distance transform + watershed to separate touching pills
    dist = cv2.distanceTransform(closed, cv2.DIST_L2, 5)
    cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)

    # Step 7: Find pill contours and compute centroids directly
    # Use RETR_EXTERNAL to get only outer contours (each blob = one pill)
    contours_info = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = contours_info[0] if len(contours_info) == 2 else contours_info[1]

    min_area = config.get("min_area", max(50, image_area * 0.0005))
    max_area_ratio = config.get("max_area_ratio", 0.15)
    max_area = image_area * max_area_ratio
    min_circularity = config.get("min_circularity", 0.3)

    raw_centers: list[tuple[int, int]] = []
    bounding_boxes: list[tuple[int, int, int, int]] = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        if circularity < min_circularity:
            continue
        M = cv2.moments(cnt)
        if M["m00"] == 0:
            continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        x, y, w, h = cv2.boundingRect(cnt)
        raw_centers.append((cx, cy))
        bounding_boxes.append((x, y, w, h))

    # Merge centers that are too close (overlapping pills may produce duplicate contours)
    merge_distance = config.get("merge_distance", 40)
    merged: list[tuple[int, int]] = []
    used = [False] * len(raw_centers)
    for i in range(len(raw_centers)):
        if used[i]:
            continue
        group = [raw_centers[i]]
        used[i] = True
        for j in range(i + 1, len(raw_centers)):
            if used[j]:
                continue
            dx = raw_centers[i][0] - raw_centers[j][0]
            dy = raw_centers[i][1] - raw_centers[j][1]
            if dx * dx + dy * dy < merge_distance * merge_distance:
                group.append(raw_centers[j])
                used[j] = True
        avg_x = int(np.mean([c[0] for c in group]))
        avg_y = int(np.mean([c[1] for c in group]))
        merged.append((avg_x, avg_y))

    centers = merged

    return PipelineResult(
        count=len(centers),
        centers=centers,
        bounding_boxes=bounding_boxes,
        debug_images={
            "gray": gray,
            "binary": binary,
            "opened": opened,
            "closed": closed,
            "distance": dist,
        },
    )
