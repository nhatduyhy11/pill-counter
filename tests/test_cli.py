"""Tests for CLI, annotator, and batch processing."""

import cv2
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch

from pill_counter.annotator import annotate_image
from pill_counter.batch import scan_images, process_single_image, process_folder


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


# --- Batch processing tests ---


def _save_test_image(path: Path, circles: list[tuple[int, int, int]] | None = None, size: tuple = (200, 200)):
    """Save a synthetic test image with optional circles to disk.

    Args:
        path: File path to save image.
        circles: List of (cx, cy, radius) tuples.
        size: Image (width, height).
    """
    w, h = size
    img = np.zeros((h, w, 3), dtype=np.uint8)
    if circles:
        for cx, cy, r in circles:
            cv2.circle(img, (cx, cy), r, (255, 255, 255), -1)
    cv2.imwrite(str(path), img)


class TestScanImages:
    def test_finds_jpg_png_files(self, tmp_path: Path):
        """scan_images finds .jpg and .png files in folder."""
        _save_test_image(tmp_path / "a.jpg")
        _save_test_image(tmp_path / "b.png")
        (tmp_path / "notes.txt").write_text("not an image")
        result = scan_images(tmp_path)
        names = [p.name for p in result]
        assert "a.jpg" in names
        assert "b.png" in names
        assert "notes.txt" not in names

    def test_returns_sorted_list(self, tmp_path: Path):
        """scan_images returns files in sorted order."""
        _save_test_image(tmp_path / "c.jpg")
        _save_test_image(tmp_path / "a.jpg")
        _save_test_image(tmp_path / "b.jpg")
        result = scan_images(tmp_path)
        names = [p.name for p in result]
        assert names == sorted(names)

    def test_case_insensitive_extension(self, tmp_path: Path):
        """scan_images handles .JPG and .jpg extensions."""
        _save_test_image(tmp_path / "upper.JPG")
        _save_test_image(tmp_path / "lower.jpg")
        result = scan_images(tmp_path)
        assert len(result) == 2


class TestProcessSingleImage:
    def test_returns_result_dict_with_count(self, tmp_path: Path):
        """process_single_image returns dict with filename, count, status."""
        img_path = tmp_path / "test.jpg"
        _save_test_image(img_path, circles=[(100, 100, 30)])
        out_dir = tmp_path / "output"
        out_dir.mkdir()
        result = process_single_image(img_path, out_dir)
        assert result["filename"] == "test.jpg"
        assert result["count"] == 1
        assert result["status"] == "ok"

    def test_saves_annotated_image(self, tmp_path: Path):
        """process_single_image saves annotated image to output directory."""
        img_path = tmp_path / "test.jpg"
        _save_test_image(img_path, circles=[(100, 100, 30)])
        out_dir = tmp_path / "output"
        out_dir.mkdir()
        process_single_image(img_path, out_dir)
        assert (out_dir / "test.jpg").exists()

    def test_corrupt_image_returns_error(self, tmp_path: Path):
        """Corrupt image file returns error status, does not crash."""
        corrupt_path = tmp_path / "bad.jpg"
        corrupt_path.write_bytes(b"not a real image file")
        out_dir = tmp_path / "output"
        out_dir.mkdir()
        result = process_single_image(corrupt_path, out_dir)
        assert result["status"] == "error"
        assert "error_msg" in result


class TestProcessFolder:
    def test_returns_list_of_results(self, tmp_path: Path):
        """process_folder returns list of result dicts for each image."""
        _save_test_image(tmp_path / "a.jpg", circles=[(100, 100, 30)])
        _save_test_image(tmp_path / "b.jpg", circles=[(100, 100, 30), (150, 150, 25)])
        out_dir = tmp_path / "output"
        results = process_folder(tmp_path, out_dir)
        assert len(results) == 2
        counts = {r["filename"]: r["count"] for r in results}
        assert counts["a.jpg"] == 1
        assert counts["b.jpg"] == 2

    def test_empty_folder_raises_value_error(self, tmp_path: Path):
        """Empty folder raises ValueError with clear message."""
        out_dir = tmp_path / "output"
        with pytest.raises(ValueError, match="No image"):
            process_folder(tmp_path, out_dir)

    def test_creates_output_directory(self, tmp_path: Path):
        """Output directory is created if it does not exist."""
        _save_test_image(tmp_path / "a.jpg", circles=[(100, 100, 30)])
        out_dir = tmp_path / "new_output"
        assert not out_dir.exists()
        process_folder(tmp_path, out_dir)
        assert out_dir.exists()

    def test_corrupt_image_does_not_kill_batch(self, tmp_path: Path):
        """One corrupt image is skipped, rest of batch continues."""
        _save_test_image(tmp_path / "good.jpg", circles=[(100, 100, 30)])
        (tmp_path / "bad.jpg").write_bytes(b"not an image")
        out_dir = tmp_path / "output"
        results = process_folder(tmp_path, out_dir)
        assert len(results) == 2
        statuses = {r["filename"]: r["status"] for r in results}
        assert statuses["good.jpg"] == "ok"
        assert statuses["bad.jpg"] == "error"


class TestCLI:
    def test_main_valid_folder_exits_zero(self, tmp_path: Path):
        """CLI with valid folder path processes images and exits 0."""
        _save_test_image(tmp_path / "a.jpg", circles=[(100, 100, 30)])
        out_dir = tmp_path / "output"
        with patch("sys.argv", ["pill-counter", str(tmp_path), "-o", str(out_dir)]):
            from pill_counter.cli import main
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 0

    def test_main_nonexistent_path_exits_one(self):
        """CLI with non-existent path prints error and exits 1."""
        with patch("sys.argv", ["pill-counter", "/nonexistent/path"]):
            from pill_counter.cli import main
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1

    def test_main_empty_folder_exits_one(self, tmp_path: Path):
        """CLI with empty folder prints error and exits 1."""
        with patch("sys.argv", ["pill-counter", str(tmp_path)]):
            from pill_counter.cli import main
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1
