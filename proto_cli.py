#!/usr/bin/env python3
"""Simple pill counter - give it a folder or image, get count + annotated output."""

import cv2
import numpy as np
import sys
import os
import json
import glob


def count_pills_in_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None, 0

    output_img = img.copy()
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Glare-Resistant Preprocessing
    blur = cv2.GaussianBlur(gray, (11, 11), 0)
    thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 21, 4)

    # Clean Up Noise
    kernel = np.ones((3, 3), np.uint8)
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    # Distance Transform
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, 0.25 * dist_transform.max(), 255, 0)

    # Watershed
    sure_fg = np.uint8(sure_fg)
    unknown = cv2.subtract(sure_bg, sure_fg)
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(img, markers)

    # Filter and Annotate
    pill_count = 0
    for marker_id in np.unique(markers):
        if marker_id == -1 or marker_id == 1:
            continue

        mask = np.zeros(gray.shape, dtype="uint8")
        mask[markers == marker_id] = 255

        contours, _ = cv2.findContours(mask.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        c = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(c)

        if area < 150 or area > 6000:
            continue

        x, y, w, h = cv2.boundingRect(c)
        aspect_ratio = float(w) / max(h, 1)
        if aspect_ratio > 3.0 or aspect_ratio < 0.33:
            continue

        pill_count += 1

        M = cv2.moments(c)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
        else:
            cX, cY = 0, 0

        cv2.circle(output_img, (cX, cY), 6, (0, 0, 255), -1)
        cv2.putText(output_img, str(pill_count), (cX - 15, cY - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    return output_img, pill_count


def process_single(image_path, output_dir):
    """Process one image, save annotated result, return count."""
    filename = os.path.basename(image_path)
    result_img, count = count_pills_in_image(image_path)

    if result_img is None:
        print(f"  SKIP  {filename} (cannot read)")
        return {"file": filename, "count": 0, "status": "error"}

    out_path = os.path.join(output_dir, f"annotated_{filename}")
    cv2.imwrite(out_path, result_img)
    print(f"  {count:>3} pills  {filename}  ->  {out_path}")
    return {"file": filename, "count": count, "status": "ok"}


def main():
    if len(sys.argv) < 2:
        print("Usage: python proto_cli.py <image_or_folder> [output_folder]")
        print()
        print("Examples:")
        print("  python proto_cli.py photo.jpg")
        print("  python proto_cli.py ./my_photos/")
        print("  python proto_cli.py ./my_photos/ ./results/")
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./output"

    os.makedirs(output_dir, exist_ok=True)

    # Collect images
    if os.path.isfile(input_path):
        images = [input_path]
    elif os.path.isdir(input_path):
        images = sorted(glob.glob(os.path.join(input_path, "*.[jJpP][pPnN][gG]"))
                        + glob.glob(os.path.join(input_path, "*.jpeg"))
                        + glob.glob(os.path.join(input_path, "*.webp")))
    else:
        print(f"Error: '{input_path}' not found")
        sys.exit(1)

    if not images:
        print(f"No images found in '{input_path}'")
        sys.exit(1)

    print(f"Processing {len(images)} image(s)...\n")

    results = []
    for img_path in images:
        results.append(process_single(img_path, output_dir))

    # Summary
    ok_results = [r for r in results if r["status"] == "ok"]
    total = sum(r["count"] for r in ok_results)

    print(f"\n{'='*40}")
    print(f"Total: {total} pills across {len(ok_results)} images")
    print(f"Output: {os.path.abspath(output_dir)}/")

    # Save JSON report
    report_path = os.path.join(output_dir, "report.json")
    with open(report_path, "w") as f:
        json.dump({"total_pills": total, "images": results}, f, indent=2)
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
