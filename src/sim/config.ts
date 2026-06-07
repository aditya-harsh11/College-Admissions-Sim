import type { SimConfig } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE FILE THAT MATTERS FOR TUNING THE STORY.
//
// All numbers below are deliberately MADE UP and chosen for directional effect,
// not realism. The point is only that the two extreme weightings produce two
// obviously different pies:
//
//   • Weight TEST SCORES heavily      → class skews toward School A / School B.
//   • Weight LIFE EXPERIENCE + SERVICE → class skews toward School C / School D,
//                                         and the first-gen share jumps.
//
// Relabel groups, recolor them, or nudge the `means` to retune. Nothing else in
// the codebase needs to change.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: SimConfig = {
  poolSize: 2400,
  classFraction: 0.15,
  attributeSpread: 0.14,

  firstGen: {
    // P(first-gen) = baseRate + lifeExperienceBoost * lifeExperience  (clamped 0..1)
    baseRate: 0.12,
    lifeExperienceBoost: 0.55,
  },

  criteria: [
    {
      key: 'testScore',
      label: 'Test Scores',
      blurb: 'SAT / ACT performance',
      defaultWeight: 20,
    },
    {
      key: 'communityService',
      label: 'Community Service',
      blurb: 'Volunteering & civic work',
      defaultWeight: 20,
    },
    {
      key: 'extracurriculars',
      label: 'Extracurriculars',
      blurb: 'Clubs, sports, the arts',
      defaultWeight: 20,
    },
    {
      key: 'leadership',
      label: 'Leadership & Character',
      blurb: 'Initiative and integrity',
      defaultWeight: 20,
    },
    {
      key: 'lifeExperience',
      label: 'Life Experience',
      blurb: 'Background & adversity overcome',
      defaultWeight: 20,
    },
  ],

  // Neutral placeholder group names (School A–E) so nothing reads as a real-world claim.
  // means are on a 0..1 scale per attribute.
  groups: [
    {
      id: 'apex',
      label: 'School A',
      color: '#2d5f8a', // editorial blue
      poolShare: 0.2,
      means: {
        testScore: 0.84,
        communityService: 0.5,
        extracurriculars: 0.74,
        leadership: 0.56,
        lifeExperience: 0.32,
      },
    },
    {
      id: 'northgate',
      label: 'School B',
      color: '#5ba39b', // teal
      poolShare: 0.34,
      means: {
        testScore: 0.78,
        communityService: 0.52,
        extracurriculars: 0.68,
        leadership: 0.67,
        lifeExperience: 0.4,
      },
    },
    {
      id: 'riverside',
      label: 'School C',
      color: '#d99a2b', // gold ochre
      poolShare: 0.22,
      means: {
        testScore: 0.5,
        communityService: 0.69,
        extracurriculars: 0.52,
        leadership: 0.56,
        lifeExperience: 0.73,
      },
    },
    {
      id: 'eastside',
      label: 'School D',
      color: '#bf4a36', // terracotta
      poolShare: 0.16,
      means: {
        testScore: 0.45,
        communityService: 0.72,
        extracurriculars: 0.5,
        leadership: 0.61,
        lifeExperience: 0.78,
      },
    },
    {
      id: 'meadowbrook',
      label: 'School E',
      color: '#7d9150', // sage
      poolShare: 0.08,
      means: {
        testScore: 0.62,
        communityService: 0.6,
        extracurriculars: 0.58,
        leadership: 0.58,
        lifeExperience: 0.58,
      },
    },
  ],
};
