// Core simulation types. The engine is pure TypeScript — no React, no realism claims.
// Everything that controls behavior lives in config.ts.

export type AttributeKey =
  | 'grades'
  | 'testScore'
  | 'communityService'
  | 'extracurriculars'
  | 'leadership'
  | 'lifeExperience';

/** A criterion the admissions officer can weight. */
export interface Criterion {
  key: AttributeKey;
  label: string;
  blurb: string;
  /** Starting allocation, in points out of 100. */
  defaultWeight: number;
}

/**
 * A demographic group in the applicant pool. `means` are the (deliberately made-up)
 * average attribute values for this group, tuned for directional storytelling — they
 * are NOT meant to be realistic. Tweak them to change how the demo behaves.
 */
export interface DemographicGroup {
  id: string;
  label: string;
  color: string;
  /** Relative size in the pool. Normalized across groups, so these need not sum to 1. */
  poolShare: number;
  means: Record<AttributeKey, number>;
}

export interface SimConfig {
  poolSize: number;
  /** Fraction of the pool admitted (e.g. 0.15 = top 15%). */
  classFraction: number;
  /** Std-dev of each attribute around its group mean. */
  attributeSpread: number;
  criteria: Criterion[];
  groups: DemographicGroup[];
  /**
   * First-gen status is cross-cutting (not a pie slice). An applicant is first-gen with
   * probability `baseRate + lifeExperienceBoost * lifeExperience`, so weighting life
   * experience directly lifts the admitted first-gen share.
   */
  firstGen: { baseRate: number; lifeExperienceBoost: number };
  /**
   * UI feature flags. Toggle pieces on/off without touching components — e.g. hide the
   * preset rubrics for the survey version (they can anchor participants) but keep them
   * for the teaching sandbox.
   */
  ui: {
    showPresets: boolean;
  };
}

export interface Applicant {
  id: number;
  groupId: string;
  firstGen: boolean;
  attributes: Record<AttributeKey, number>;
}

/** Weight allocation, in points out of 100, keyed by attribute. */
export type Weights = Record<AttributeKey, number>;

export interface GroupSlice {
  groupId: string;
  label: string;
  color: string;
  count: number;
  pct: number;
}

export interface SimResult {
  admitted: Applicant[];
  classSize: number;
  /** Demographic makeup of the admitted class. */
  breakdown: GroupSlice[];
  /** Demographic makeup of the whole applicant pool (the baseline to compare against). */
  poolBreakdown: GroupSlice[];
  firstGenPct: number;
  poolFirstGenPct: number;
  avgTestScore: number;
  poolAvgTestScore: number;
  avgLifeExperience: number;
}
