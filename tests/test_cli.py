"""Tests for CLI, annotator, and batch processing."""

import cv2
import numpy as np
import pytest
from pathlib import Path

from pill_counter.annotator import annotate_image


# --- Helper to create synthetic BGR images ---


def _make_bgr_image(height: int = 400, width: int = 400, bg_color: tuple = (0, 0, 0)) -> np.ndarray:
    """Create a blank BGR image."""
    img = np.full((height, width, 3), bg_color, dtype=np.uint8)
    return img


def _draw_circle_bgr(img: np.ndarray, center: tuple, radius: int = 30, color: tuple = (255, 255, 255)) -> np.ndarray:
    """Draw a filled circle on a BGR image, return copy."""
    out = img.copy()
    cv2.circle(out, center, radius, color, -1)
    return out


# --- Annotator tests ---


class TestAnnotate:
    def test_annotate_preserves_dimensions(self):
        """Annotated image has same dimensions as original."""
        img = _make_bgr_image(300, 400)
        centers = [(100, 100), (200, 150), (300, 250)]
        result = annotate_image(img, centers)
        assert result.shape == img.shape

    def test_annotate_changes_pixels_at_centers(self):
        """Annotated image differs from original at center positions."""
        img = _make_bgr_image(400, 400, bg_color=(50, 50, 50))
        centers = [(200, 200)]
        result = annotate_image(img, centers)
        # The pixel at center should be red (BGR: 0, 0, 255)
        b, g, r = result[200, 200]
        assert r == 255
        assert b == 0
        assert g == 0

    def test_annotate_empty_centers_returns_unchanged(self):
        """Empty centers list returns image identical to original."""
        img = _make_bgr_image(200, 200)
        result = annotate_image(img, [])
        np.testing.assert_array_equal(result, img)

    def test_annotate_multiple_centers_all_marked(self):
        """All centers get red dots in annotated image."""
        img = _make_bgr_image(400, 400, bg_color=(50, 50, 50))
        centers = [(50, 50), (150, 150), (250, 250)]
        result = annotate_image(img, centers)
        for cx, cy in centers:
            b, g, r = result[cy, cx]
            assert r == 255, f"Center ({cx},{cy}) not marked red"

    def test_annotate_does_not_modify_original(self):
        """Original image is not modified by annotate_image."""
        img = _make_bgr_image(200, 200, bg_color=(50, 50, 50))
        original_pixel = img[100, 100].copy()
        annotate_image(img, [(100, 100)])
        np.testing.assert_array_equal(img[100, 100], original_pixel)

    def test_annotate_with_bounding_boxes(self):
        """Bounding boxes are drawn as green rectangles when provided."""
        img = _make_bgr_image(400, 400, bg_color=(50, 50, 50))
        centers = [(200, 200)]
        bboxes = [(180, 180, 40, 40)]
        result = annotate_image(img, centers, bounding_boxes=bboxes)
        # Check that some green pixels exist in the bounding box region
        roi = result[180:220, 180:220]
        green_pixels = np.sum((roi[:, :, 1] == 255) & (roi[:, :, 0] == 0) & (roi[:, :, 2] == 0))
        assert green_pixels > 0, "No green pixels found in bounding box region"
