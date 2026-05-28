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
        # Red filled circle at centroid (BGR: 0, 0, 255), radius 5
        cv2.circle(annotated, (cx, cy), 5, (0, 0, 255), -1)

        # Sequence number offset from center (+10, -10)
        cv2.putText(
            annotated,
            str(i),
            (cx + 10, cy - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 0, 255),
            2,
        )

    # Draw green bounding boxes if provided
    if bounding_boxes:
        for x, y, w, h in bounding_boxes:
            cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 2)

    return annotated
