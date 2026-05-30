"""CLI entry point for pill-counter — argparse interface."""

import argparse
import json
import sys
from pathlib import Path

from .batch import process_folder


def main(argv: list[str] | None = None) -> None:
    """Main CLI entry point.

    Usage: pill-counter <folder> [-o OUTPUT]

    Exit codes:
        0 — success (all images processed)
        1 — error (no valid images, invalid path, empty folder)
        2 — partial failure (some images failed)
    """
    parser = argparse.ArgumentParser(
        description="Count pills in images using computer vision"
    )
    parser.add_argument(
        "input",
        help="Input folder containing images",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="./output",
        help="Output directory for annotated images (default: ./output)",
    )

    args = parser.parse_args(argv)

    # Validate input path
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input path does not exist: {input_path}", file=sys.stderr)
        sys.exit(1)

    if not input_path.is_dir():
        print(f"Error: Input path is not a directory: {input_path}", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)

    # Process folder
    try:
        results = process_folder(input_path, output_path, progress=True)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Build JSON report (D-01 shape)
    total_pills = sum(r["count"] for r in results if r["status"] == "ok")
    report = {
        "total_pills": total_pills,
        "total_images": len(results),
        "results": results,
    }
    report_path = output_path / "report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))

    # Print per-image results
    error_count = 0
    total_pills = 0
    for r in results:
        if r["status"] == "error":
            print(f"{r['filename']}: ERROR - {r.get('error_msg', 'unknown error')}")
            error_count += 1
        else:
            print(f"{r['filename']}: {r['count']} pills")
            total_pills += r["count"]

    # Print summary
    image_count = len(results)
    print(f"\nTotal: {total_pills} pills across {image_count} images")

    # Exit code
    if error_count == image_count:
        sys.exit(1)  # All failed
    elif error_count > 0:
        sys.exit(2)  # Partial failure
    else:
        sys.exit(0)  # All success


if __name__ == "__main__":
    main()
