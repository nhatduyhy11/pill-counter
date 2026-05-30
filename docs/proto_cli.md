# Proto CLI - How to Run

## Setup

```bash
# Install uv (one time)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Usage

```bash
# Single image
uv run proto_cli.py photo.jpg

# Folder of images
uv run proto_cli.py ./my_photos/

# Custom output folder
uv run proto_cli.py ./my_photos/ ./results/
```

That's it — `uv run` auto-creates venv and installs dependencies from `pyproject.toml`.

## What happens

1. Each image is processed through the CV pipeline
2. Annotated images (red dots + numbers) are saved to `./output/` (or your custom folder)
3. A `report.json` is generated with per-image counts and total

## Output structure

```
output/
  annotated_photo1.jpg    # image with red dots on each pill
  annotated_photo2.jpg
  report.json             # {"total_pills": 42, "images": [...]}
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No module named 'cv2'` | Run `uv sync` first |
| `No images found` | Check folder path, supported formats: jpg, jpeg, png, webp |
| Count is wrong | Adjust thresholds in the script (see below) |

## Tuning the detection

If pills aren't being detected correctly, edit these values in `proto_cli.py`:

```python
# Area filter (line ~65): min and max pill size in pixels
if area < 150 or area > 6000:    # increase max for bigger pills

# Aspect ratio filter (line ~70): reject non-round shapes
if aspect_ratio > 3.0 or aspect_ratio < 0.33:

# Distance transform threshold (line ~42): lower = more sensitive to touching pills
_, sure_fg = cv2.threshold(dist_transform, 0.25 * dist_transform.max(), 255, 0)
```

## Jupyter Notebook

You can also use the same logic in Jupyter:

```python
import cv2
import numpy as np

# Copy the count_pills_in_image() function from proto_cli.py
result_img, count = count_pills_in_image("photo.jpg")
print(f"Found {count} pills")

# Display in notebook
from google.colab.patches import cv2_imshow  # if using Colab
# or
from IPython.display import Image, display
cv2.imwrite("/tmp/result.jpg", result_img)
display(Image("/tmp/result.jpg"))
```
