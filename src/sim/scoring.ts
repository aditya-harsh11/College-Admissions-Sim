import type {
  Applicant,
  AttributeKey,
  GroupSlice,
  SimConfig,
  SimResult,
  Weights,
} from './types';

/**
 * Composite score = Σ (weight_i * attribute_i). Weights are points out of 100;
 * we divide by 100 so the score lands on a 0..1 scale, but since admission only
 * cares about ranking, the divisor is purely cosmetic. The demographic label is
 * never read here — disparate impact emerges only from attribute correlations.
 */
export function scoreApplicant(applicant: Applicant, weights: Weights): number {
  let score = 0;
  for (const key in weights) {
    score += weights[key as AttributeKey] * applicant.attributes[key as AttributeKey];
  }
  return score / 100;
}

function breakdownOf(applicants: Applicant[], config: SimConfig): GroupSlice[] {
  const counts = new Map<string, number>();
  for (const a of applicants) counts.set(a.groupId, (counts.get(a.groupId) ?? 0) + 1);
  const total = applicants.length || 1;
  return config.groups.map((g) => {
    const count = counts.get(g.id) ?? 0;
    return {
      groupId: g.id,
      label: g.label,
      color: g.color,
      count,
      pct: (count / total) * 100,
    };
  });
}

function firstGenShare(applicants: Applicant[]): number {
  if (applicants.length === 0) return 0;
  return (applicants.filter((a) => a.firstGen).length / applicants.length) * 100;
}

function mean(applicants: Applicant[], key: AttributeKey): number {
  if (applicants.length === 0) return 0;
  return applicants.reduce((sum, a) => sum + a.attributes[key], 0) / applicants.length;
}

/**
 * Score the pool, admit the top `classFraction`, and summarize. Pure and cheap —
 * a dot product per applicant plus one sort — so it can run on every slider move.
 */
export function runSim(pool: Applicant[], weights: Weights, config: SimConfig): SimResult {
  const ranked = pool
    .map((applicant) => ({ applicant, score: scoreApplicant(applicant, weights) }))
    .sort((a, b) => b.score - a.score);

  const classSize = Math.max(1, Math.round(pool.length * config.classFraction));
  const admitted = ranked.slice(0, classSize).map((r) => r.applicant);

  return {
    admitted,
    classSize,
    breakdown: breakdownOf(admitted, config),
    poolBreakdown: breakdownOf(pool, config),
    firstGenPct: firstGenShare(admitted),
    poolFirstGenPct: firstGenShare(pool),
    avgTestScore: mean(admitted, 'testScore'),
    poolAvgTestScore: mean(pool, 'testScore'),
    avgLifeExperience: mean(admitted, 'lifeExperience'),
  };
}
