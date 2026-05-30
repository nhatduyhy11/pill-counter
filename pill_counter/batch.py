"""Batch processing — folder scanning, per-image orchestration, error handling."""

import cv2
import logging
from pathlib import Path
from tqdm import tqdm

from .pipeline import count_pills
from .annotator import annotate_image

logger = logging.getLogger(__name__)

# Supported image extensions (case-insensitive matching)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def scan_images(folder: Path) -> list[Path]:
    """Find all image files in folder (non-recursive).

    Returns sorted list of image paths matching supported extensions.
    Handles both .jpg and .JPG via case-insensitive extension check.
    """
    files: list[Path] = []
    for p in folder.iterdir():
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS:
            files.append(p)
    return sorted(files, key=lambda p: p.name.lower())


def process_single_image(image_path: Path, output_dir: Path) -> dict:
    """Process one image through the CV pipeline and save annotated result.

    Returns dict with keys: filename, count, centers, status ('ok' or 'error'), error_msg.
    Wraps entire function in try/except — on any exception returns error status.
    """
    try:
        # Load image
        image = cv2.imread(str(image_path))
        if image is None:
            return {
                "filename": image_path.name,
                "count": 0,
                "centers": [],
                "status": "error",
                "error_msg": f"Could not read image: {image_path.name}",
            }

        # Run pipeline
        result = count_pills(image)

        # Annotate and save
        annotated = annotate_image(image, result.centers, result.bounding_boxes)
        output_path = output_dir / image_path.name
        cv2.imwrite(str(output_path), annotated)

        return {
            "filename": image_path.name,
            "count": result.count,
            "centers": result.centers,
            "status": "ok",
        }

    except Exception as e:
        logger.error("Error processing %s: %s", image_path.name, e)
        return {
            "filename": image_path.name,
            "count": 0,
            "centers": [],
            "status": "error",
            "error_msg": str(e),
        }


def process_folder(input_dir: Path, output_dir: Path, progress: bool = False) -> list[dict]:
    """Scan folder for images, process each, return list of results.

    Args:
        input_dir: Folder containing images to process.
        output_dir: Folder for annotated output images.
        progress: If True, show tqdm progress bar during processing.

    Raises ValueError if no images found (ERR-02).
    Creates output_dir if it does not exist (OUT-02).
    """
    images = scan_images(input_dir)
    if not images:
        raise ValueError(f"No image files found in {input_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    results: list[dict] = []
    iterator = tqdm(images, desc="Processing", unit="img") if progress else images
    for img_path in iterator:
        result = process_single_image(img_path, output_dir)
        results.append(result)

    return results
