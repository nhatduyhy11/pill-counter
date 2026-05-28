"""Pipeline configuration and result types."""

from dataclasses import dataclass, field


DEFAULT_CONFIG: dict = {
    "blur_kernel_size": 5,
    "morphology_kernel_size": 3,
    "open_iterations": 2,
    "close_iterations": 2,
    "distance_threshold": 0.5,
    "min_area_ratio": 0.0001,
    "max_area_ratio": 0.1,
    "min_circularity": 0.3,
    "min_solidity": 0.5,
    "background_sample_size": 20,
}


@dataclass
class PipelineResult:
    """Pipeline output — no file I/O, pure data."""

    count: int
    centers: list[tuple[int, int]]
    bounding_boxes: list[tuple[int, int, int, int]]
    debug_images: dict = field(default_factory=dict)
