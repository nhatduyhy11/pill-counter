import type { PillCountResult } from "../types";

export interface PillCountCandidateDebug {
  name: string;
  score: number;
  foregroundRatio: number;
  borderForegroundRatio: number;
  componentCount: number;
  smallComponentRatio: number;
}

export interface PillCountDebug {
  image: {
    width: number;
    height: number;
    processedWidth: number;
    processedHeight: number;
  };
  selectedMode: string;
  foregroundRatio: number;
  candidateScores: PillCountCandidateDebug[];
  rejectedComponents: number;
  sourceComponents: number;
  clustersSplit: number;
  warnings: string[];
}

export interface PillCVResult extends PillCountResult {
  debug?: PillCountDebug;
}
