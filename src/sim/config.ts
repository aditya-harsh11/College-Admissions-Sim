import type { SimConfig } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE FILE THAT MATTERS FOR TUNING THE STORY.
//
// All numbers below are deliberately MADE UP and chosen for directional effect,
// not realism. The point is only that the two extreme weightings produce two
// obviously different pies:
//
//   • Weight TEST SCORES heavily      → class skews toward Group A / Group B.
//   • Weight LIFE EXPERIENCE + SERVICE → class skews toward Group C / Group D,
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

  ui: {
    // Preset rubrics: handy for demos, but flip to false for the survey version so they
    // don't anchor how participants allocate.
    showPresets: true,
  },

  criteria: [
    {
      key: 'grades',
      label: 'Grades & Coursework',
      blurb: 'GPA & rigor of classes',
      defaultWeight: 17,
    },
    {
      key: 'testScore',
      label: 'Test Scores',
      blurb: 'SAT / ACT performance',
      defaultWeight: 17,
    },
    {
      key: 'communityService',
      label: 'Community Service',
      blurb: 'Volunteering & civic work',
      defaultWeight: 17,
    },
    {
      key: 'extracurriculars',
      label: 'Extracurriculars',
      blurb: 'Clubs, sports, the arts',
      defaultWeight: 17,
    },
    {
      key: 'leadership',
      label: 'Leadership & Character',
      blurb: 'Initiative and integrity',
      defaultWeight: 16,
    },
    {
      key: 'lifeExperience',
      label: 'Life Experience',
      blurb: 'Background & adversity overcome',
      defaultWeight: 16,
    },
  ],

  // Neutral placeholder group names (Group A–E) so nothing reads as a real-world claim.
  // means are on a 0..1 scale per attribute.
  groups: [
    {
      id: 'groupA',
      label: 'Group A',
      color: '#2d5f8a', // editorial blue
      poolShare: 0.2,
      means: {
        testScore: 0.84,
        grades: 0.8,
        communityService: 0.5,
        extracurriculars: 0.74,
        leadership: 0.56,
        lifeExperience: 0.32,
      },
    },
    {
      id: 'groupB',
      label: 'Group B',
      color: '#5ba39b', // teal
      poolShare: 0.34,
      means: {
        testScore: 0.78,
        grades: 0.76,
        communityService: 0.52,
        extracurriculars: 0.68,
        leadership: 0.67,
        lifeExperience: 0.4,
      },
    },
    {
      id: 'groupC',
      label: 'Group C',
      color: '#d99a2b', // gold ochre
      poolShare: 0.22,
      means: {
        testScore: 0.5,
        grades: 0.55,
        communityService: 0.69,
        extracurriculars: 0.52,
        leadership: 0.56,
        lifeExperience: 0.73,
      },
    },
    {
      id: 'groupD',
      label: 'Group D',
      color: '#bf4a36', // terracotta
      poolShare: 0.16,
      means: {
        testScore: 0.45,
        grades: 0.52,
        communityService: 0.72,
        extracurriculars: 0.5,
        leadership: 0.61,
        lifeExperience: 0.78,
      },
    },
    {
      id: 'groupE',
      label: 'Group E',
      color: '#7d9150', // sage
      poolShare: 0.08,
      means: {
        testScore: 0.62,
        grades: 0.63,
        communityService: 0.6,
        extracurriculars: 0.58,
        leadership: 0.58,
        lifeExperience: 0.58,
      },
    },
  ],
};
