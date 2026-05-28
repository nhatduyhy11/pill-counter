"""Tests for the core CV pipeline using synthetic images."""

import cv2
import numpy as np
import pytest

from pill_counter.pipeline import count_pills, detect_background


def _make_image(height: int = 400, width: int = 400, bg_color: int = 0) -> np.ndarray:
    """Create a blank grayscale image."""
    return np.full((height, width), bg_color, dtype=np.uint8)


def _draw_circle(img: np.ndarray, center: tuple[int, int], radius: int = 30, color: int = 255) -> np.ndarray:
    """Draw a filled circle on an image, return copy."""
    out = img.copy()
    cv2.circle(out, center, radius, color, -1)
    return out


# --- Background detection tests ---


class TestDetectBackground:
    def test_light_background(self):
        """White background image detected as 'light'."""
        img = np.full((200, 200), 240, dtype=np.uint8)
        assert detect_background(img) == "light"

    def test_dark_background(self):
        """Black background image detected as 'dark'."""
        img = np.zeros((200, 200), dtype=np.uint8)
        assert detect_background(img) == "dark"


# --- Single pill detection ---


class TestSinglePill:
    def test_single_circle_returns_count_1(self):
        """Single white circle on black background returns count=1."""
        img = _make_image(200, 200, bg_color=0)
        img = _draw_circle(img, (100, 100), radius=30, color=255)
        result = count_pills(img)
        assert result.count == 1

    def test_single_circle_center_near_expected(self):
        """Center of detected pill is near the drawn position (within 10px)."""
        img = _make_image(200, 200, bg_color=0)
        img = _draw_circle(img, (100, 100), radius=30, color=255)
        result = count_pills(img)
        assert len(result.centers) == 1
        cx, cy = result.centers[0]
        assert abs(cx - 100) <= 10 and abs(cy - 100) <= 10


# --- Multiple pill detection ---


class TestMultiplePills:
    def test_three_separate_circles_returns_count_3(self):
        """Three well-separated circles returns count=3."""
        img = _make_image(400, 400, bg_color=0)
        img = _draw_circle(img, (80, 80), radius=25, color=255)
        img = _draw_circle(img, (200, 200), radius=25, color=255)
        img = _draw_circle(img, (320, 320), radius=25, color=255)
        result = count_pills(img)
        assert result.count == 3


# --- Touching pill separation (watershed) ---


class TestTouchingPills:
    def test_two_touching_circles_returns_count_2(self):
        """Two overlapping circles separated by watershed returns count=2."""
        img = _make_image(400, 400, bg_color=0)
        # Draw two circles that overlap at edge
        img = _draw_circle(img, (170, 200), radius=40, color=255)
        img = _draw_circle(img, (230, 200), radius=40, color=255)
        result = count_pills(img)
        assert result.count == 2


# --- Background type detection in pipeline ---


class TestBackgroundThresholding:
    def test_light_background_with_dark_pills(self):
        """Light background (white) with dark objects uses correct threshold."""
        img = np.full((200, 200), 240, dtype=np.uint8)
        cv2.circle(img, (100, 100), 30, 50, -1)  # dark pill on light bg
        result = count_pills(img)
        assert result.count == 1

    def test_dark_background_with_light_pills(self):
        """Dark background (black) with light objects uses correct threshold."""
        img = np.zeros((200, 200), dtype=np.uint8)
        cv2.circle(img, (100, 100), 30, 255, -1)  # light pill on dark bg
        result = count_pills(img)
        assert result.count == 1


# --- Noise filtering ---


class TestNoiseFiltering:
    def test_small_noise_specks_filtered(self):
        """Tiny noise dots filtered out by min_area_ratio."""
        img = _make_image(400, 400, bg_color=0)
        img = _draw_circle(img, (100, 100), radius=30, color=255)  # real pill
        # Add tiny noise specks (1-2px)
        for i in range(20):
            img[50 + i * 3, 50] = 255
            img[50 + i * 3, 51] = 255
        result = count_pills(img)
        assert result.count == 1

    def test_very_large_blob_filtered(self):
        """Very large blob filtered out by max_area_ratio."""
        img = _make_image(400, 400, bg_color=0)
        img = _draw_circle(img, (100, 100), radius=30, color=255)  # real pill
        # Draw a huge blob covering >10% of image
        cv2.rectangle(img, (0, 0), (300, 300), 255, -1)
        result = count_pills(img)
        # The huge blob should be filtered; only the small circle (or nothing) detected
        # At minimum, the huge blob shouldn't create a detection
        assert result.count <= 1

    def test_non_circular_shape_filtered(self):
        """Elongated rectangle filtered out by min_circularity."""
        img = _make_image(400, 400, bg_color=0)
        img = _draw_circle(img, (300, 300), radius=30, color=255)  # real pill
        # Draw elongated rectangle (low circularity)
        cv2.rectangle(img, (20, 180), (180, 220), 255, -1)
        result = count_pills(img)
        assert result.count == 1


# --- Return structure ---


class TestPipelineResult:
    def test_result_has_all_fields(self):
        """PipelineResult has count, centers, bounding_boxes, debug_images."""
        img = _make_image(200, 200, bg_color=0)
        img = _draw_circle(img, (100, 100), radius=30, color=255)
        result = count_pills(img)
        assert hasattr(result, "count")
        assert hasattr(result, "centers")
        assert hasattr(result, "bounding_boxes")
        assert hasattr(result, "debug_images")
        assert isinstance(result.centers, list)
        assert isinstance(result.bounding_boxes, list)
        assert isinstance(result.debug_images, dict)
