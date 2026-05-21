export interface PillCVConfig {
  maxDimension: number;
  blurKernelSize: number;
  adaptiveBlockSize: number;
  adaptiveC: number;
  backgroundBorderRatio: number;
  morphologyKernelSize: number;
  openIterations: number;
  closeIterations: number;
  minForegroundRatio: number;
  maxForegroundRatio: number;
  minComponentAreaRatio: number;
  distanceThresholds: number[];
  distMaskSize: 3 | 5;
  debug: boolean;
}

export const DEFAULT_PILL_CV_CONFIG: PillCVConfig = {
  maxDimension: 1024,
  blurKernelSize: 5,
  adaptiveBlockSize: 31,
  adaptiveC: 5,
  backgroundBorderRatio: 0.06,
  morphologyKernelSize: 3,
  openIterations: 1,
  closeIterations: 2,
  minForegroundRatio: 0.002,
  maxForegroundRatio: 0.7,
  minComponentAreaRatio: 0.00004,
  distanceThresholds: [0.58, 0.48, 0.38],
  distMaskSize: 5,
  debug: false,
};
