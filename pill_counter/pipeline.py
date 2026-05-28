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

    # Step 6: Distance transform — normalize to [0,1] before thresholding
    dist = cv2.distanceTransform(closed, cv2.DIST_L2, 5)
    cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)

    # Step 7: Threshold distance map for sure foreground
    _, sure_fg = cv2.threshold(dist, config.get("distance_threshold", 0.5) * dist.max(), 255, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg)

    # Step 8: Sure background (dilate)
    sure_bg = cv2.dilate(closed, kernel, iterations=3)

    # Step 9: Unknown region
    unknown = cv2.subtract(sure_bg, sure_fg)

    # Step 10: Connected components for markers
    _, markers = cv2.connectedComponents(sure_fg)

    # Step 11: CRITICAL — shift labels so background is not 0
    # connectedComponents labels background as 0, but watershed treats 0 as unknown
    markers = markers + 1
    markers[unknown == 255] = 0

    # Step 12: Watershed (needs 3-channel image)
    img_3ch = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    markers = cv2.watershed(img_3ch, markers)

    # Step 13: Extract contours from watershed output
    min_area = image_area * config.get("min_area_ratio", 0.0001)
    max_area = image_area * config.get("max_area_ratio", 0.1)
    min_circ = config.get("min_circularity", 0.3)
    min_sol = config.get("min_solidity", 0.5)

    centers: list[tuple[int, int]] = []
    bounding_boxes: list[tuple[int, int, int, int]] = []

    unique_labels = np.unique(markers)
    for label in unique_labels:
        if label <= 1:  # Skip background (1) and unknown (0), also -1 boundaries
            continue

        # Create mask for this region
        region_mask = np.uint8(markers == label) * 255

        # Find contours
        contours, _ = cv2.findContours(region_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)

            # Filter by area
            if area < min_area:
                continue
            if area > max_area:
                continue

            # Filter by circularity
            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * np.pi * area / (perimeter**2)
            if circularity < min_circ:
                continue

            # Filter by solidity (area / convex hull area)
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            if hull_area == 0:
                continue
            solidity = area / hull_area
            if solidity < min_sol:
                continue

            # Compute centroid via moments
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                continue
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            x, y, bw, bh = cv2.boundingRect(cnt)

            centers.append((cx, cy))
            bounding_boxes.append((x, y, bw, bh))

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
            "sure_fg": sure_fg,
            "markers": markers,
        },
    )
