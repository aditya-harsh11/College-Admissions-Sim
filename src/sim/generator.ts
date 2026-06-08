import type { Applicant, AttributeKey, SimConfig } from './types';
import { clamp01, gaussian, mulberry32 } from './rng';

const ATTRIBUTE_KEYS: AttributeKey[] = [
  'grades',
  'testScore',
  'communityService',
  'extracurriculars',
  'leadership',
  'lifeExperience',
];

/**
 * Build a deterministic applicant pool. Each applicant is assigned to a group
 * (weighted by poolShare), then every attribute is drawn from that group's mean
 * plus gaussian noise. First-gen status is correlated with the drawn life-experience
 * value (see config.firstGen), so it isn't independent of the attributes.
 */
export function generateApplicantPool(config: SimConfig, seed = 1337): Applicant[] {
  const rand = mulberry32(seed);

  const totalShare = config.groups.reduce((sum, g) => sum + g.poolShare, 0);
  // Cumulative thresholds for weighted group selection.
  const cumulative: { id: string; threshold: number }[] = [];
  let acc = 0;
  for (const g of config.groups) {
    acc += g.poolShare / totalShare;
    cumulative.push({ id: g.id, threshold: acc });
  }
  const groupById = new Map(config.groups.map((g) => [g.id, g]));

  const applicants: Applicant[] = [];
  for (let i = 0; i < config.poolSize; i++) {
    const roll = rand();
    const groupId = cumulative.find((c) => roll <= c.threshold)?.id ?? config.groups[0].id;
    const group = groupById.get(groupId)!;

    const attributes = {} as Record<AttributeKey, number>;
    for (const key of ATTRIBUTE_KEYS) {
      attributes[key] = clamp01(group.means[key] + gaussian(rand) * config.attributeSpread);
    }

    const firstGenProb = clamp01(
      config.firstGen.baseRate + config.firstGen.lifeExperienceBoost * attributes.lifeExperience,
    );
    const firstGen = rand() < firstGenProb;

    applicants.push({ id: i, groupId, firstGen, attributes });
  }

  return applicants;
}
