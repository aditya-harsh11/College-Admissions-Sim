import { scoreApplicant } from './scoring';
import type { Applicant, SchoolProfile, SimConfig, Weights } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// "Where do YOU rank?" — the self-ranking engine (v5).
//
// Drops a synthetic "you" applicant into the same scored pool the rest of the app
// uses, then for each school asks: would you make the admit cutoff (top admitRate
// of the pool)? Returns a per-school admit probability + reach/target/safety bucket,
// modeled loosely on the 7sage / CollegeVine "chance me" tools (Notes/Research.md).
//
// Selectivity does the work Randy wanted: more selective schools have a higher
// cutoff, so the same profile flips from "Safety" at UW–Madison to "Hard reach" at
// Harvard. Test-blind schools (UCLA) zero out the Test Scores contribution.
// ─────────────────────────────────────────────────────────────────────────────

export interface SelfProfile {
  /** 0..4 unweighted-ish GPA. */
  gpa: number;
  /** Which standardized test the score refers to. */
  testType: 'SAT' | 'ACT';
  /** 400..1600 SAT. */
  sat: number;
  /** 1..36 ACT. */
  act: number;
  /** Self-rated 0..1 for the "soft" criteria. */
  extracurriculars: number;
  leadership: number;
  communityService: number;
  lifeExperience: number;
  /** Underrepresented / first-gen background — applies a modest boost (à la 7sage's URM checkbox). */
  urm?: boolean;
  /** Legacy applicant (family attended) — applies a modest admissions boost. */
  legacy?: boolean;
}

export type Bucket = 'Safety' | 'Target' | 'Reach' | 'Hard reach';

export interface SchoolChance {
  school: SchoolProfile;
  /** Your percentile within the applicant pool (0..100). */
  percentile: number;
  /** Modeled admit probability (0..1). */
  probability: number;
  admitted: boolean;
  bucket: Bucket;
}

// Self-rank weighting. Unlike the rubric tool (where the participant chooses the weights), here we
// fix a realistic split so chances feel right: academics (GPA + test) carry ~60%, the soft criteria
// share the remaining ~40%. So a very low GPA can't read as a Safety. (Randy, 06-24.)
const HOLISTIC: Weights = {
  grades: 30,
  testScore: 30,
  communityService: 10,
  extracurriculars: 10,
  leadership: 10,
  lifeExperience: 10,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const logistic = (x: number) => 1 / (1 + Math.exp(-x));

function bucketFor(probability: number): Bucket {
  if (probability >= 0.8) return 'Safety';
  if (probability >= 0.5) return 'Target';
  if (probability >= 0.2) return 'Reach';
  return 'Hard reach';
}

/** Turn the entered profile into a pool-compatible applicant (all attributes on 0..1). */
export function profileToApplicant(p: SelfProfile): Applicant {
  return {
    id: -1,
    groupId: 'you',
    firstGen: false,
    attributes: {
      grades: clamp01(p.gpa / 4),
      // SAT 400–1600 and ACT 1–36 both normalize to 0..1 (concordance-ish).
      testScore: clamp01(p.testType === 'ACT' ? (p.act - 1) / 35 : (p.sat - 400) / 1200),
      communityService: clamp01(p.communityService),
      extracurriculars: clamp01(p.extracurriculars),
      leadership: clamp01(p.leadership),
      lifeExperience: clamp01(p.lifeExperience),
    },
  };
}

function stddev(xs: number[], mean: number): number {
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

export function computeChances(
  config: SimConfig,
  pool: Applicant[],
  profile: SelfProfile,
): SchoolChance[] {
  const you = profileToApplicant(profile);
  const n = pool.length;

  return config.schools.map((school) => {
    // Test-blind schools ignore the Test Scores attribute entirely.
    const weights: Weights = school.testBlind ? { ...HOLISTIC, testScore: 0 } : HOLISTIC;

    const rawScore = scoreApplicant(you, weights);
    const poolScores = pool.map((a) => scoreApplicant(a, weights));
    const sorted = [...poolScores].sort((a, b) => b - a);

    // Admit cutoff = the score at the admitRate-th percentile of the pool.
    const cutoffIdx = Math.min(n - 1, Math.max(0, Math.floor(n * school.admitRate) - 1));
    const cutoff = sorted[cutoffIdx];

    const mean = poolScores.reduce((s, x) => s + x, 0) / n;
    const scale = Math.max(1e-4, stddev(poolScores, mean) * 0.6);

    // URM and legacy each apply a modest upward shift to the effective score (they can stack).
    const youScore =
      rawScore + (profile.urm ? scale * 0.8 : 0) + (profile.legacy ? scale * 0.7 : 0);

    const below = poolScores.reduce((c, s) => c + (s <= youScore ? 1 : 0), 0);
    const percentile = (below / n) * 100;
    const probability = clamp01(logistic((youScore - cutoff) / scale));

    return {
      school,
      percentile,
      probability,
      admitted: youScore >= cutoff,
      bucket: bucketFor(probability),
    };
  });
}
