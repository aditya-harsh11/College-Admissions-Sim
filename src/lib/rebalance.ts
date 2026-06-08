import type { AttributeKey, Weights } from '../sim/types';

const KEYS: AttributeKey[] = [
  'grades',
  'testScore',
  'communityService',
  'extracurriculars',
  'leadership',
  'lifeExperience',
];

/**
 * The "magic" 100-point constraint. When the user sets one criterion to `rawValue`,
 * the remaining points are redistributed across the other criteria proportionally to
 * their current values, so the total always lands on exactly 100 (integers).
 *
 * Edge cases:
 *  - All other criteria at 0 → distribute the remainder evenly.
 *  - Rounding → the leftover point(s) go to the criteria with the largest fractional
 *    remainder, guaranteeing an exact sum of 100.
 */
export function rebalance(weights: Weights, changed: AttributeKey, rawValue: number): Weights {
  const value = Math.max(0, Math.min(100, Math.round(rawValue)));
  const others = KEYS.filter((k) => k !== changed);
  const remaining = 100 - value;

  const next = { ...weights, [changed]: value } as Weights;
  if (others.length === 0) return next;

  const otherSum = others.reduce((sum, k) => sum + weights[k], 0);

  if (otherSum === 0) {
    const base = Math.floor(remaining / others.length);
    others.forEach((k) => (next[k] = base));
    const leftover = remaining - base * others.length;
    for (let i = 0; i < leftover; i++) next[others[i]] += 1;
    return next;
  }

  // Proportional scale, floor, then hand out leftover by largest fractional part.
  const scaled = others.map((k) => ({ k, exact: (weights[k] * remaining) / otherSum }));
  let assigned = 0;
  for (const s of scaled) {
    next[s.k] = Math.floor(s.exact);
    assigned += next[s.k];
  }
  const leftover = remaining - assigned;
  scaled.sort((a, b) => (b.exact % 1) - (a.exact % 1));
  for (let i = 0; i < leftover; i++) next[scaled[i].k] += 1;

  return next;
}
