import { Jimp } from "jimp";
import type { Mat } from "@techstark/opencv-js";
import { DEFAULT_PILL_CV_CONFIG, type PillCVConfig } from "./pill-cv-config";
import { getCV, type OpenCVRuntime } from "./opencv-init";
import type {
  PillCountDebug,
  PillCountResult,
  PillPoint,
} from "./pill-common";

interface CountOptions {
  debug?: boolean;
  config?: Partial<PillCVConfig>;
}

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

interface MaskCandidate {
  name: string;
  mask: Mat;
  debug: MaskCandidateDebug;
}

interface MaskCandidateDebug {
  name: string;
  score: number;
  foregroundRatio: number;
  borderForegroundRatio: number;
  componentCount: number;
  smallComponentRatio: number;
}

interface MarkerPoint {
  x: number;
  y: number;
  area: number;
}

interface CountMaskDebug {
  sourceComponents: number;
  rejectedComponents: number;
  clustersSplit: number;
}

export async function countPillsWithCV(
  imageBase64: string,
  options: CountOptions = {}
): Promise<PillCountResult> {
  const config: PillCVConfig = {
    ...DEFAULT_PILL_CV_CONFIG,
    ...options.config,
    debug: Boolean(options.debug),
  };

  let cv: OpenCVRuntime;
  try {
    cv = await getCV();
  } catch (error) {
    console.error("OpenCV init error:", error);
    throw new Error("Không thể khởi tạo bộ xử lý ảnh");
  }

  const decoded = await decodeBase64Image(imageBase64);
  const source = createRgbaMat(cv, decoded);
  let processed: Mat = source;
  let resized: Mat | null = null;

  try {
    const resize = resizeIfNeeded(cv, source, config.maxDimension);
    processed = resize.mat;
    resized = resize.owned ? resize.mat : null;

    const candidates = createMaskCandidates(cv, processed, config);
    if (candidates.length === 0) {
      return { count: 0, points: [] };
    }

    candidates.sort((a, b) => b.debug.score - a.debug.score);
    const selected = candidates[0];
    const warnings: string[] = [];

    if (selected.debug.score < 35) {
      warnings.push("Mask score thấp, ảnh có thể khó phân tích chính xác");
    }

    if (candidates[1] && selected.debug.score - candidates[1].debug.score < 8) {
      warnings.push("Nhiều segmentation candidate có điểm gần nhau");
    }

    try {
      const counted = countPillsInMask(cv, selected.mask, config);
      const points = counted.points
        .map((point) => ({
          x: clamp(point.x, 0, 1),
          y: clamp(point.y, 0, 1),
        }))
        .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

      const result: PillCountResult = {
        count: points.length,
        points,
      };

      if (config.debug) {
        result.debug = {
          image: {
            width: decoded.width,
            height: decoded.height,
            processedWidth: processed.cols,
            processedHeight: processed.rows,
          },
          selectedMode: selected.name,
          foregroundRatio: selected.debug.foregroundRatio,
          candidateScores: candidates.map((candidate) => candidate.debug),
          rejectedComponents: counted.debug.rejectedComponents,
          sourceComponents: counted.debug.sourceComponents,
          clustersSplit: counted.debug.clustersSplit,
          warnings,
        } satisfies PillCountDebug;
      }

      return result;
    } finally {
      candidates.forEach((candidate) => candidate.mask.delete());
    }
  } finally {
    resized?.delete();
    source.delete();
  }
}

async function decodeBase64Image(imageBase64: string): Promise<DecodedImage> {
  const match = imageBase64.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  const rawBase64 = match?.[1] ?? imageBase64;

  try {
    const buffer = Buffer.from(rawBase64, "base64");
    const image = await Jimp.read(buffer);

    return {
      width: image.bitmap.width,
      height: image.bitmap.height,
      data: new Uint8Array(image.bitmap.data),
    };
  } catch (error) {
    console.error("Image decode error:", error);
    throw new Error("Không thể đọc ảnh, vui lòng chọn ảnh khác");
  }
}

function createRgbaMat(cv: OpenCVRuntime, image: DecodedImage): Mat {
  const mat = new cv.Mat(image.height, image.width, cv.CV_8UC4);
  mat.data.set(image.data);
  return mat;
}

function resizeIfNeeded(
  cv: OpenCVRuntime,
  source: Mat,
  maxDimension: number
): { mat: Mat; owned: boolean } {
  const maxSide = Math.max(source.cols, source.rows);
  if (maxSide <= maxDimension) return { mat: source, owned: false };

  const scale = maxDimension / maxSide;
  const width = Math.max(1, Math.round(source.cols * scale));
  const height = Math.max(1, Math.round(source.rows * scale));
  const resized = new cv.Mat();
  cv.resize(source, resized, new cv.Size(width, height), 0, 0, cv.INTER_AREA);
  return { mat: resized, owned: true };
}

function createMaskCandidates(
  cv: OpenCVRuntime,
  source: Mat,
  config: PillCVConfig
): MaskCandidate[] {
  const candidates: MaskCandidate[] = [];
  const gray = new cv.Mat();
  const blurred = new cv.Mat();

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(
      gray,
      blurred,
      new cv.Size(config.blurKernelSize, config.blurKernelSize),
      0
    );

    candidates.push(
      buildCandidate(cv, "otsu-light-foreground", () => {
        const mask = new cv.Mat();
        cv.threshold(
          blurred,
          mask,
          0,
          255,
          cv.THRESH_BINARY + cv.THRESH_OTSU
        );
        return mask;
      }, config)
    );

    candidates.push(
      buildCandidate(cv, "otsu-dark-foreground", () => {
        const mask = new cv.Mat();
        cv.threshold(
          blurred,
          mask,
          0,
          255,
          cv.THRESH_BINARY_INV + cv.THRESH_OTSU
        );
        return mask;
      }, config)
    );

    const blockSize = getAdaptiveBlockSize(
      Math.min(source.cols, source.rows),
      config.adaptiveBlockSize
    );

    candidates.push(
      buildCandidate(cv, "adaptive-light-foreground", () => {
        const mask = new cv.Mat();
        cv.adaptiveThreshold(
          blurred,
          mask,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          blockSize,
          config.adaptiveC
        );
        return mask;
      }, config)
    );

    candidates.push(
      buildCandidate(cv, "adaptive-dark-foreground", () => {
        const mask = new cv.Mat();
        cv.adaptiveThreshold(
          blurred,
          mask,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY_INV,
          blockSize,
          config.adaptiveC
        );
        return mask;
      }, config)
    );
  } finally {
    gray.delete();
    blurred.delete();
  }

  const backgroundThreshold = estimateBackgroundThreshold(source, config);
  for (const scale of [0.85, 1, 1.25]) {
    candidates.push(
      buildCandidate(cv, `background-distance-${scale}`, () => {
        return createBackgroundDistanceMask(cv, source, backgroundThreshold * scale);
      }, config)
    );
  }

  return candidates;
}

function buildCandidate(
  cv: OpenCVRuntime,
  name: string,
  createRawMask: () => Mat,
  config: PillCVConfig
): MaskCandidate {
  const rawMask = createRawMask();

  try {
    const mask = cleanupMask(cv, rawMask, config);
    const debug = analyzeMask(cv, name, mask, config);
    return { name, mask, debug };
  } finally {
    rawMask.delete();
  }
}

function cleanupMask(
  cv: OpenCVRuntime,
  mask: Mat,
  config: PillCVConfig
): Mat {
  const kernel = cv.getStructuringElement(
    cv.MORPH_ELLIPSE,
    new cv.Size(config.morphologyKernelSize, config.morphologyKernelSize)
  );
  const opened = new cv.Mat();
  const cleaned = new cv.Mat();

  try {
    cv.morphologyEx(
      mask,
      opened,
      cv.MORPH_OPEN,
      kernel,
      new cv.Point(-1, -1),
      config.openIterations
    );
    cv.morphologyEx(
      opened,
      cleaned,
      cv.MORPH_CLOSE,
      kernel,
      new cv.Point(-1, -1),
      config.closeIterations
    );
    return cleaned;
  } catch (error) {
    cleaned.delete();
    throw error;
  } finally {
    opened.delete();
    kernel.delete();
  }
}

function estimateBackgroundThreshold(
  source: Mat,
  config: PillCVConfig
): number {
  const samples = sampleBorderRgb(source, config.backgroundBorderRatio);
  if (samples.length === 0) return 45;

  const medianColor = {
    r: median(samples.map((sample) => sample.r)),
    g: median(samples.map((sample) => sample.g)),
    b: median(samples.map((sample) => sample.b)),
  };

  const distances = samples.map((sample) => colorDistance(sample, medianColor));
  return clamp(median(distances) * 3 + 28, 30, 105);
}

function createBackgroundDistanceMask(
  cv: OpenCVRuntime,
  source: Mat,
  threshold: number
): Mat {
  const width = source.cols;
  const height = source.rows;
  const samples = sampleBorderRgb(source, 0.06);
  const medianColor = {
    r: median(samples.map((sample) => sample.r)),
    g: median(samples.map((sample) => sample.g)),
    b: median(samples.map((sample) => sample.b)),
  };
  const sourceData = source.data8U;
  const mask = new cv.Mat(height, width, cv.CV_8UC1);
  const maskData = mask.data8U;

  for (let i = 0, pixel = 0; i < sourceData.length; i += 4, pixel++) {
    const distance = colorDistance(
      { r: sourceData[i], g: sourceData[i + 1], b: sourceData[i + 2] },
      medianColor
    );
    maskData[pixel] = distance > threshold ? 255 : 0;
  }

  return mask;
}

function analyzeMask(
  cv: OpenCVRuntime,
  name: string,
  mask: Mat,
  config: PillCVConfig
): MaskCandidateDebug {
  const totalPixels = mask.rows * mask.cols;
  const foregroundPixels = cv.countNonZero(mask);
  const foregroundRatio = foregroundPixels / totalPixels;
  const borderForegroundRatio = getBorderForegroundRatio(mask, 0.03);
  const minArea = Math.max(12, Math.round(totalPixels * config.minComponentAreaRatio));
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();

  try {
    const labelCount = cv.connectedComponentsWithStats(
      mask,
      labels,
      stats,
      centroids,
      8,
      cv.CV_32S
    );
    const statsData = stats.data32S;
    let componentCount = 0;
    let smallArea = 0;

    for (let label = 1; label < labelCount; label++) {
      const area = statsData[label * stats.cols + cv.CC_STAT_AREA];
      if (area < minArea) {
        smallArea += area;
      } else {
        componentCount++;
      }
    }

    const smallComponentRatio = foregroundPixels > 0 ? smallArea / foregroundPixels : 1;
    const score = scoreMask({
      foregroundRatio,
      borderForegroundRatio,
      componentCount,
      smallComponentRatio,
      config,
    });

    return {
      name,
      score,
      foregroundRatio,
      borderForegroundRatio,
      componentCount,
      smallComponentRatio,
    };
  } finally {
    labels.delete();
    stats.delete();
    centroids.delete();
  }
}

function scoreMask(input: {
  foregroundRatio: number;
  borderForegroundRatio: number;
  componentCount: number;
  smallComponentRatio: number;
  config: PillCVConfig;
}): number {
  const {
    foregroundRatio,
    borderForegroundRatio,
    componentCount,
    smallComponentRatio,
    config,
  } = input;
  let score = 100;

  if (foregroundRatio < config.minForegroundRatio) {
    score -= 90;
  } else if (foregroundRatio > config.maxForegroundRatio) {
    score -= 120 * Math.min(1, foregroundRatio - config.maxForegroundRatio + 0.2);
  }

  score -= borderForegroundRatio * 140;
  score -= smallComponentRatio * 80;

  if (componentCount === 0) score -= 100;
  score += Math.min(componentCount, 40) * 0.4;

  return score;
}

function countPillsInMask(
  cv: OpenCVRuntime,
  mask: Mat,
  config: PillCVConfig
): { points: PillPoint[]; debug: CountMaskDebug } {
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();
  const points: PillPoint[] = [];
  const minArea = Math.max(
    16,
    Math.round(mask.rows * mask.cols * config.minComponentAreaRatio)
  );
  let rejectedComponents = 0;
  let clustersSplit = 0;

  try {
    const labelCount = cv.connectedComponentsWithStats(
      mask,
      labels,
      stats,
      centroids,
      8,
      cv.CV_32S
    );
    const labelsData = labels.data32S;
    const statsData = stats.data32S;
    const centroidsData = centroids.data64F;

    for (let label = 1; label < labelCount; label++) {
      const offset = label * stats.cols;
      const area = statsData[offset + cv.CC_STAT_AREA];
      const x = statsData[offset + cv.CC_STAT_LEFT];
      const y = statsData[offset + cv.CC_STAT_TOP];
      const width = statsData[offset + cv.CC_STAT_WIDTH];
      const height = statsData[offset + cv.CC_STAT_HEIGHT];

      if (area < minArea || width < 2 || height < 2) {
        rejectedComponents++;
        continue;
      }

      const roiMask = createComponentRoiMask(
        cv,
        labelsData,
        mask.cols,
        label,
        x,
        y,
        width,
        height
      );

      try {
        const markers = findDistanceMarkers(cv, roiMask, area, config);

        if (markers.length > 0) {
          if (markers.length > 1) clustersSplit++;
          for (const marker of markers) {
            points.push({
              x: (x + marker.x) / mask.cols,
              y: (y + marker.y) / mask.rows,
            });
          }
        } else {
          points.push({
            x: centroidsData[label * centroids.cols] / mask.cols,
            y: centroidsData[label * centroids.cols + 1] / mask.rows,
          });
        }
      } finally {
        roiMask.delete();
      }
    }

    return {
      points,
      debug: {
        sourceComponents: Math.max(0, labelCount - 1),
        rejectedComponents,
        clustersSplit,
      },
    };
  } finally {
    labels.delete();
    stats.delete();
    centroids.delete();
  }
}

function createComponentRoiMask(
  cv: OpenCVRuntime,
  labelsData: Int32Array,
  imageWidth: number,
  label: number,
  x: number,
  y: number,
  width: number,
  height: number
): Mat {
  const roi = new cv.Mat(height, width, cv.CV_8UC1);
  const roiData = roi.data8U;
  roiData.fill(0);

  for (let row = 0; row < height; row++) {
    const sourceOffset = (y + row) * imageWidth + x;
    const targetOffset = row * width;

    for (let col = 0; col < width; col++) {
      if (labelsData[sourceOffset + col] === label) {
        roiData[targetOffset + col] = 255;
      }
    }
  }

  return roi;
}

function findDistanceMarkers(
  cv: OpenCVRuntime,
  roiMask: Mat,
  blobArea: number,
  config: PillCVConfig
): MarkerPoint[] {
  let bestMarkers: MarkerPoint[] = [];

  for (const threshold of config.distanceThresholds) {
    const markers = findMarkersAtThreshold(cv, roiMask, blobArea, threshold, config);
    if (markers.length > bestMarkers.length) bestMarkers = markers;
  }

  const minDistance = Math.max(
    4,
    Math.sqrt(blobArea / Math.max(bestMarkers.length, 1)) * 0.18
  );

  return suppressNearbyMarkers(bestMarkers, minDistance);
}

function findMarkersAtThreshold(
  cv: OpenCVRuntime,
  roiMask: Mat,
  blobArea: number,
  threshold: number,
  config: PillCVConfig
): MarkerPoint[] {
  const dist = new cv.Mat();
  const normalized = new cv.Mat();
  const peakFloat = new cv.Mat();
  const peaks = new cv.Mat();
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const centroids = new cv.Mat();
  const markers: MarkerPoint[] = [];
  const minMarkerArea = Math.max(2, Math.round(Math.sqrt(blobArea) * 0.12));

  try {
    cv.distanceTransform(roiMask, dist, cv.DIST_L2, config.distMaskSize);
    cv.normalize(dist, normalized, 0, 1, cv.NORM_MINMAX);
    cv.threshold(normalized, peakFloat, threshold, 255, cv.THRESH_BINARY);
    peakFloat.convertTo(peaks, cv.CV_8U);

    const labelCount = cv.connectedComponentsWithStats(
      peaks,
      labels,
      stats,
      centroids,
      8,
      cv.CV_32S
    );
    const statsData = stats.data32S;
    const centroidsData = centroids.data64F;

    for (let label = 1; label < labelCount; label++) {
      const area = statsData[label * stats.cols + cv.CC_STAT_AREA];
      if (area < minMarkerArea) continue;

      const x = centroidsData[label * centroids.cols];
      const y = centroidsData[label * centroids.cols + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      markers.push({ x, y, area });
    }

    return markers;
  } finally {
    dist.delete();
    normalized.delete();
    peakFloat.delete();
    peaks.delete();
    labels.delete();
    stats.delete();
    centroids.delete();
  }
}

function suppressNearbyMarkers(
  markers: MarkerPoint[],
  minDistance: number
): MarkerPoint[] {
  const accepted: MarkerPoint[] = [];
  const sorted = [...markers].sort((a, b) => b.area - a.area);

  for (const marker of sorted) {
    const tooClose = accepted.some((existing) => {
      const dx = existing.x - marker.x;
      const dy = existing.y - marker.y;
      return Math.hypot(dx, dy) < minDistance;
    });

    if (!tooClose) accepted.push(marker);
  }

  return accepted;
}

function getAdaptiveBlockSize(minSide: number, desired: number): number {
  const maxOdd = minSide % 2 === 1 ? minSide : minSide - 1;
  return clamp(makeOdd(desired), 3, Math.max(3, maxOdd));
}

function makeOdd(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 1 ? rounded : rounded + 1;
}

function getBorderForegroundRatio(mask: Mat, borderRatio: number): number {
  const width = mask.cols;
  const height = mask.rows;
  const border = Math.max(1, Math.round(Math.min(width, height) * borderRatio));
  const data = mask.data8U;
  let foreground = 0;
  let total = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= border && x < width - border && y >= border && y < height - border) {
        continue;
      }

      total++;
      if (data[y * width + x] > 0) foreground++;
    }
  }

  return total > 0 ? foreground / total : 0;
}

function sampleBorderRgb(
  source: Mat,
  borderRatio: number
): Array<{ r: number; g: number; b: number }> {
  const width = source.cols;
  const height = source.rows;
  const border = Math.max(1, Math.round(Math.min(width, height) * borderRatio));
  const step = Math.max(1, Math.round(Math.min(width, height) / 180));
  const data = source.data8U;
  const samples: Array<{ r: number; g: number; b: number }> = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (x >= border && x < width - border && y >= border && y < height - border) {
        continue;
      }

      const offset = (y * width + x) * 4;
      samples.push({ r: data[offset], g: data[offset + 1], b: data[offset + 2] });
    }
  }

  return samples;
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
