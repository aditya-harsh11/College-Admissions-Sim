// ─────────────────────────────────────────────────────────────────────────────
// v6 "Shifting Demographics" stimulus data.
//
// REAL numbers (not the made-up sim groups): undergraduate racial composition of
// UW–Madison over time, from the lab's "College UNDERGRAD Demographics" sheet
// (source: data.wisc.edu / UW Box CDS files). These drive the interactive
// shift visual in the experimental condition.
//
// The two framing blocks (`STIMULUS`) are the finalized copy from
// "College Admission Stimuli (6.28.2026).docx" - render verbatim.
// ─────────────────────────────────────────────────────────────────────────────

export const SCHOOL = 'University of Wisconsin–Madison';

/** The four snapshots we scrub through. 1999 is the earliest the registrar reports. */
export const YEARS = [1999, 2005, 2015, 2025] as const;
export type Year = (typeof YEARS)[number];

export interface RaceCategory {
  key: string;
  label: string;
  short: string;
  color: string;
}

// Earthy, editorial palette that sits inside the paper theme (no loaded symbolism -
// just distinct, muted hues like the sim's Group A–E colors).
export const RACE_CATEGORIES: RaceCategory[] = [
  { key: 'white', label: 'White', short: 'White', color: '#2d5f8a' },
  { key: 'hispanic', label: 'Hispanic / Latino', short: 'Hispanic', color: '#d99a2b' },
  { key: 'black', label: 'Black / African-American', short: 'Black', color: '#bf4a36' },
  { key: 'asian', label: 'Asian, Native Hawaiian & Pacific Islander', short: 'Asian / NHPI', color: '#5ba39b' },
  { key: 'amind', label: 'American Indian', short: 'Am. Indian', color: '#7d9150' },
  { key: 'multi', label: 'Two or more races', short: 'Two+ races', color: '#8f6b86' },
  { key: 'unknown', label: 'Unknown', short: 'Unknown', color: '#b8ac97' },
];

// Percent of undergrads in each category, indexed to YEARS (1999, 2005, 2015, 2025).
// "--" in the source (a category not yet reported) is recorded as 0.
export const UW_SERIES: Record<string, number[]> = {
  white: [86.51, 85.43, 75.06, 58.3],
  hispanic: [2.22, 2.83, 4.6, 9.22],
  black: [1.98, 2.52, 2.09, 2.78],
  asian: [4.3, 5.39, 5.58, 11.22],
  amind: [0.49, 0.58, 0.21, 0.21],
  multi: [0, 0, 2.88, 4.84],
  unknown: [0, 0, 0.83, 3.65],
};

/** Total reported for a year (categories don't always sum to 100 in the source). */
export function yearTotal(yearIndex: number): number {
  return RACE_CATEGORIES.reduce((s, c) => s + (UW_SERIES[c.key][yearIndex] ?? 0), 0);
}

// ── Control condition: the admissions PROCESS over the same span (no demographics) ──
// Generic, web-plausible milestones - the parallel "things changed" framing that
// isolates the demographic reveal. (AI-assisted copy, per Randy; tune freely.)
export const PROCESS_STEPS: { head: string; body: string }[] = [
  {
    head: 'Mostly paper, mostly local',
    body: 'Applications and test scores arrive by mail. Each one is read by hand, and most students apply to only a handful of schools close to home.',
  },
  {
    head: 'The application moves online',
    body: 'The Common Application goes widely digital. Submitting to many schools at once gets far easier, and application volume starts to climb.',
  },
  {
    head: 'Test-optional and holistic review spread',
    body: 'More schools stop requiring SAT/ACT scores and lean on “holistic” review: essays, activities, and context weigh more heavily than a single number.',
  },
  {
    head: 'High-volume, tech-assisted admissions',
    body: 'Test-optional is the norm, applicants apply to more schools than ever, and offices use new tools (and applicants use AI) across a record number of applications.',
  },
];

// ── Finalized stimulus copy - VERBATIM from "College Admission Stimuli (6.28.2026).docx" ──
// Page 1 (shared) → Page 2 (per-condition preview) → Page 3a/3b (per-condition stimulus).
export const STIMULUS = {
  // Page 1 - shown to everyone before condition assignment.
  intro: [
    'We are researchers at the University of Wisconsin. We are interested in learning more about how community members think universities should make admissions decisions.',
    'In particular, we are interested in what factors people think universities should consider when evaluating applicants.',
    'There are no right or wrong answers.',
    'We are interested in your honest opinions about what factors universities should consider when deciding which applicants to admit.',
  ],
  // Page 2 - per-condition preview ("…has changed… these changes may shape… on the next page…").
  preview: {
    shift: [
      'The demographics of colleges and universities across the United States have changed in many ways, including who attends college, where students come from, what backgrounds students have, and what life experiences students bring with them.',
      'These changes may shape how people think about what universities should value when deciding which applicants to admit.',
      'On the next page, we will show you information about these changing demographics.',
      'Then, we will ask you what factors you think universities should consider when making admissions decisions.',
    ],
    process: [
      'The admissions process at colleges and universities across the United States has changed in many ways, including how students apply to college, how applications are submitted, and how applications are reviewed.',
      'These changes may shape how people think about what universities should value when deciding which applicants to admit.',
      'On the next page, we will show you information about these changes in the admissions process.',
      'Then, we will ask you what factors you think universities should consider when making admissions decisions.',
    ],
  },
  // Page 3a - experimental (Shifting Demographics) framing.
  shift: {
    title: 'Changing Demographics at Colleges and Universities',
    paras: [
      'Colleges and universities in the United States serve students from many different backgrounds. Over time, the student population has changed in several ways.',
      'For example, students may differ in terms of where they are from, their racial or ethnic background, their family income, whether they are the first in their family to attend college, and the life experiences they bring with them.',
      'These changes mean that universities are often evaluating applicants from a wide range of backgrounds and experiences.',
    ],
    prompt:
      'As you think about admissions decisions, please consider how these changing demographics should or should not affect what universities value when deciding which applicants to admit.',
  },
  // Page 3b - control (Process Change) framing.
  process: {
    title: 'Changes in the Admissions Process at Colleges and Universities',
    paras: [
      'Colleges and universities in the United States use many different steps when evaluating applicants. Over time, the admissions process has changed in several ways.',
      'For example, students may differ in terms of how they apply, what materials they submit, how their applications are reviewed, and how admissions offices manage the application process.',
      'These changes mean that universities are often evaluating applicants through a complex and changing admissions process.',
    ],
    prompt:
      'As you think about admissions decisions, please consider how these changes in the admissions process should or should not affect what universities value when deciding which applicants to admit.',
  },
} as const;

export type Condition = 'shift' | 'process';
