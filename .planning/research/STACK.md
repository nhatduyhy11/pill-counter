# Technology Stack

**Project:** Pill Counter — CV Pipeline Prototype (Python CLI)
**Researched:** 2026-05-28
**Confidence:** HIGH (versions verified via PyPI)

## Recommended Stack

### Core Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.12+ | Runtime | Current stable, best OpenCV/numpy compatibility, pattern matching, improved error messages. 3.10+ works but 3.12 is the sweet spot. |

### Computer Vision & Numerics

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| opencv-python | 4.13.0.92 | Image processing, CV pipeline | The standard. All functions needed (watershed, distance transform, morphology, contours) are in this package. No need for contrib. |
| numpy | 2.4.6 | Array operations | OpenCV images are numpy arrays. Required dependency — not optional. |

**opencv-python vs opencv-contrib-python:** Use `opencv-python` only. The contrib package adds SIFT/SURF/extra modules you don't need for blob counting. It's larger and can cause conflicts. All watershed, morphology, distance transform, contour functions are in the main package.

### CLI Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| argparse | stdlib | CLI argument parsing | Built-in, zero dependencies, sufficient for `--input`, `--output`, `--verbose` flags. Use this. |

**Why NOT click/typer:** This is a single-command batch tool, not a multi-command CLI framework. argparse handles `prog --input dir --output dir --threshold 127` perfectly. Adding click/typer adds a dependency for zero benefit here. If the CLI grows to subcommands later, migrate to click.

### Progress & Output

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| tqdm | 4.67.3 | Progress bars for batch processing | Use from day 1 — batch processing 100+ images needs progress feedback |
| rich | 15.0.0 | Pretty terminal output, tables | Optional — use if you want colored summary tables in terminal. Skip for MVP. |

### Image I/O

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| Pillow | 12.2.0 | Fallback image loading | Only if OpenCV's `imread` fails on edge-case formats. OpenCV handles JPG/PNG/BMP/TIFF natively. |

**OpenCV `cv2.imread()` is sufficient** for this project. It handles all common formats. Pillow is insurance, not a requirement.

### Project Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pyproject.toml | PEP 621 | Project metadata & dependencies | Modern standard. Replaces setup.py, setup.cfg, requirements.txt. |
| uv | latest | Fast pip/venv replacement | 10-100x faster than pip. Use for `uv pip install` and `uv run`. |

**uv over pip:** Install with `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`. Then `uv pip install opencv-python numpy tqdm`. Dramatically faster dependency resolution.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CV library | opencv-python 4.13 | scikit-image | Slower, less mature for real-time CV, no watershed/contour API as comprehensive |
| CV library | opencv-python 4.13 | OpenCV.js (existing) | WASM overhead, slower, harder to debug, already has accuracy issues in Next.js app |
| CLI | argparse | click 8.4 | Overkill for single-command tool, adds dependency |
| CLI | argparse | typer 0.26 | Same — multi-command framework for single-command tool |
| Progress | tqdm 4.67 | alive-progress | tqdm is the standard, more ecosystem support |
| Package mgmt | uv | pip | uv is dramatically faster, same API |
| Package mgmt | uv | poetry | Poetry is for libraries with complex dependency trees, not simple tools |
| Package mgmt | uv | conda | Conda is for scientific environments with C deps. Overkill here. |

## Installation

```bash
# Install uv (if not installed)
pip install uv

# Create virtual environment
python -m venv .venv
# or: uv venv

# Activate
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
uv pip install opencv-python==4.13.0.92 numpy==2.4.6 tqdm==4.67.3

# Or from pyproject.toml:
uv pip install -e .
```

### pyproject.toml (minimal)

```toml
[project]
name = "pill-counter"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "opencv-python>=4.13,<5",
    "numpy>=2.4,<3",
    "tqdm>=4.67,<5",
]

[project.scripts]
pill-counter = "pill_counter.cli:main"
```

## Version Pinning Strategy

| Package | Pin | Rationale |
|---------|-----|-----------|
| opencv-python | `>=4.13,<5` | Major version lock. OpenCV 4.x API is stable. Pin minor for reproducibility. |
| numpy | `>=2.4,<3` | Major version lock. numpy 2.x has breaking changes from 1.x. Lock major. |
| tqdm | `>=4.67,<5` | Stable API, minor version flexible. |

**Don't pin exact versions** (e.g., `==4.13.0.92`) in pyproject.toml — that's for lockfiles. Use range pins for compatibility.

## Sources

- PyPI `pip index versions` — verified 2026-05-28
- opencv-python: https://pypi.org/project/opencv-python/
- numpy: https://pypi.org/project/numpy/
- tqdm: https://pypi.org/project/tqdm/
- argparse: Python stdlib (no version needed)
- uv: https://github.com/astral-sh/uv
