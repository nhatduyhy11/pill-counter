"""Image annotator — draws red dots and sequence numbers on detected pills."""

import cv2
import numpy as np


def annotate_image(
    image: np.ndarray,
    centers: list[tuple[int, int]],
    bounding_boxes: list[tuple[int, int, int, int]] | None = None,
) -> np.ndarray:
    """Draw red dot + sequence number on each detected pill.

    Args:
        image: BGR image (numpy array).
        centers: List of (x, y) pixel coordinates for each pill centroid.
        bounding_boxes: Optional list of (x, y, w, h) rectangles to draw in green.

    Returns:
        Annotated copy of the image. Original is never modified.
    """
    annotated = image.copy()

    for i, (cx, cy) in enumerate(centers, 1):
        cv2.circle(annotated, (cx, cy), 3, (0, 0, 255), -1)
        cv2.putText(
            annotated,
            str(i),
            (cx + 4, cy - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.35,
            (0, 0, 255),
            1,
        )

    return annotated
