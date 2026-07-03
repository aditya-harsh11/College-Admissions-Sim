// ─────────────────────────────────────────────────────────────────────────────
// v6 "Shifting Demographics" stimulus data.
//
// REAL numbers (not the made-up sim groups): undergraduate racial composition of a
// university over time, from the lab's "College UNDERGRAD Demographics" sheet.
// These drive the interactive shift visual in the experimental condition.
//
// Three swappable DATASETS so Randy can compare builds by data source (07-03 ask):
//   • uw       — UW–Madison undergrads, 1999→2025  ("v6 UW", the default)
//   • national — overall U.S. undergraduate enrollment  ("v6 overall (college)")
//   • fake     — illustrative / exaggerated figures for testing whether a bigger
//                swing changes how people allocate (clearly labelled NOT real)
// Pick one with ?data=uw|national|fake (or ui.shiftDataset). Only the shift
// condition uses these; the process/control condition uses PROCESS_STEPS.
//
// The framing blocks (`STIMULUS`) and the two long-form ARTICLEs are copy, not data.
// STIMULUS is finalized wording from "College Admission Stimuli (6.28.2026).docx"
// (render verbatim). The ARTICLEs are the AI-written "news article" wrapper Randy
// asked for on 07-03 — tune freely.
// ─────────────────────────────────────────────────────────────────────────────

export type Condition = 'shift' | 'process';

export interface RaceCategory {
  key: string;
  label: string;
  short: string;
  color: string;
}

// Earthy, editorial palette that sits inside the paper theme (no loaded symbolism —
// just distinct, muted hues like the sim's Group A–E colors). Shared across datasets.
export const RACE_CATEGORIES: RaceCategory[] = [
  { key: 'white', label: 'White', short: 'White', color: '#2d5f8a' },
  { key: 'hispanic', label: 'Hispanic / Latino', short: 'Hispanic', color: '#d99a2b' },
  { key: 'black', label: 'Black / African-American', short: 'Black', color: '#bf4a36' },
  { key: 'asian', label: 'Asian, Native Hawaiian & Pacific Islander', short: 'Asian / NHPI', color: '#5ba39b' },
  { key: 'amind', label: 'American Indian', short: 'Am. Indian', color: '#7d9150' },
  { key: 'multi', label: 'Two or more races', short: 'Two+ races', color: '#8f6b86' },
  { key: 'unknown', label: 'Unknown', short: 'Unknown', color: '#b8ac97' },
];

export interface DemographicDataset {
  id: 'uw' | 'national' | 'fake';
  /** Menu name, e.g. "v6 UW". */
  name: string;
  /** What the composition belongs to, shown as the widget kicker. */
  scope: string;
  /** The institution / population the numbers describe. */
  title: string;
  /** Snapshot years, oldest → newest (drives the scrubber steps). */
  years: number[];
  /** Percent in each category, indexed to `years`. "--" in the source is recorded as 0. */
  series: Record<string, number[]>;
  /** The headline group whose big % is emphasized (usually the one that fell most). */
  focus: string;
  /** Non-clickable source line under the widget (item 10 — real, but don't advertise clicks). */
  source: string;
  /** false → an illustrative/dummy set; the widget says so instead of "Real figures." */
  real: boolean;
}

// ── UW–Madison undergrads (source: data.wisc.edu / UW Box CDS files) ──
// 1999 is the earliest the registrar reports; 2025 is the current CDS.
const UW: DemographicDataset = {
  id: 'uw',
  name: 'v6 UW',
  scope: 'University of Wisconsin–Madison',
  title: 'Undergraduate composition',
  years: [1999, 2005, 2015, 2025],
  series: {
    white: [86.51, 85.43, 75.06, 58.3],
    hispanic: [2.22, 2.83, 4.6, 9.22],
    black: [1.98, 2.52, 2.09, 2.78],
    asian: [4.3, 5.39, 5.58, 11.22],
    amind: [0.49, 0.58, 0.21, 0.21],
    multi: [0, 0, 2.88, 4.84],
    unknown: [0, 0, 0.83, 3.65],
  },
  focus: 'white',
  source: 'Source: UW–Madison registrar / Common Data Set. Real figures.',
  real: true,
};

// ── Overall U.S. undergraduate enrollment (source: NCES / NSC tabs of the sheet) ──
// Oldest → newest = [1976, 2005, 2014, 2024]; Asian here folds in Pacific Islander to
// match the shared category set. Rows don't sum to 100 (nonresident/other excluded) —
// the bar normalizes by the reported total, so that's fine.
// NOTE: these are transcribed from the PDF export; double-check against the live sheet
// before any published use.
const NATIONAL: DemographicDataset = {
  id: 'national',
  name: 'v6 overall (college)',
  scope: 'United States',
  title: 'Undergraduate enrollment, nationwide',
  years: [1976, 2005, 2014, 2024],
  series: {
    white: [83.4, 67.1, 57.2, 39.86],
    hispanic: [3.8, 11.8, 17.7, 18.09],
    black: [10.2, 13.3, 14.5, 10.7],
    asian: [1.8, 6.6, 6.4, 6.07], // Asian + Native Hawaiian / Pacific Islander
    amind: [0.8, 1.1, 0.8, 0.64],
    multi: [0, 0, 3.5, 4.34],
    unknown: [0, 0, 0, 0],
  },
  focus: 'white',
  source: 'Source: U.S. Dept. of Education (NCES) & National Student Clearinghouse. Real figures.',
  real: true,
};

// ── Illustrative / dummy set (NOT real) ──
// One group's swing is deliberately exaggerated so we can test whether a more dramatic
// shift changes factor allocation. Clearly marked as illustrative in the UI.
const FAKE: DemographicDataset = {
  id: 'fake',
  name: 'v6 dummy (illustrative)',
  scope: 'A large public university',
  title: 'Undergraduate composition',
  years: [2000, 2008, 2016, 2024],
  series: {
    white: [90.0, 74.0, 52.0, 34.0],
    hispanic: [2.5, 5.0, 9.0, 13.0],
    black: [2.0, 3.0, 3.5, 4.0],
    asian: [3.5, 13.0, 27.0, 41.0], // the deliberately-large mover
    amind: [0.5, 0.4, 0.3, 0.3],
    multi: [0, 2.6, 3.7, 4.4],
    unknown: [1.0, 2.0, 1.5, 3.3],
  },
  focus: 'white',
  source: 'Illustrative figures — not real data. For pilot testing only.',
  real: false,
};

export const DATASETS: Record<DemographicDataset['id'], DemographicDataset> = {
  uw: UW,
  national: NATIONAL,
  fake: FAKE,
};

/** Resolve a ?data= value (or config default) to a dataset, defaulting to UW. */
export function resolveDataset(id?: string | null): DemographicDataset {
  if (id === 'national' || id === 'uw' || id === 'fake') return DATASETS[id];
  return DATASETS.uw;
}

/** Reported total for a year (categories don't always sum to 100 in the source). */
export function yearTotal(ds: DemographicDataset, yearIndex: number): number {
  return RACE_CATEGORIES.reduce((s, c) => s + (ds.series[c.key]?.[yearIndex] ?? 0), 0);
}

/** Categories that actually appear in a dataset (a non-zero value in some year), big → small overall. */
export function activeCategories(ds: DemographicDataset): RaceCategory[] {
  return RACE_CATEGORIES.filter((c) => (ds.series[c.key] ?? []).some((v) => v > 0));
}

/**
 * One-line, data-driven summary of the whole shift (item 5 — shown before Continue).
 * Names the group that fell the most and the one(s) that rose the most so the direction
 * of change is unmissable.
 */
export function describeShift(ds: DemographicDataset): string {
  const last = ds.years.length - 1;
  const deltas = activeCategories(ds).map((c) => ({
    c,
    d: (ds.series[c.key][last] ?? 0) - (ds.series[c.key][0] ?? 0),
  }));
  const risers = deltas.filter((x) => x.d > 0.5).sort((a, b) => b.d - a.d);
  const faller = deltas.slice().sort((a, b) => a.d - b.d)[0];
  const roseNames = risers.slice(0, 2).map((x) => x.c.short);
  const roseText =
    roseNames.length === 2 ? `${roseNames[0]} and ${roseNames[1]}` : roseNames[0] ?? 'other groups';
  const fell = Math.abs(faller.d).toFixed(0);
  return `Between ${ds.years[0]} and ${ds.years[last]}, ${faller.c.short} fell about ${fell} points, while ${roseText} grew.`;
}

// ── Control condition: the admissions PROCESS over time (no demographics) ──
// Generic, web-plausible milestones — the parallel "things changed" framing that
// isolates the demographic reveal. (AI-assisted copy, per Randy; tune freely.)
// Note: does NOT open on a test-optional line (07-03: that primes "who I'm competing with").
export const PROCESS_STEPS: { head: string; body: string }[] = [
  {
    head: 'Mostly paper, mostly local',
    body: 'Applications and transcripts arrive by mail. Each one is read by hand, and most students apply to only a handful of schools close to home.',
  },
  {
    head: 'The application moves online',
    body: 'The Common Application goes widely digital. Submitting to many schools at once gets far easier, and the number of applications each student files starts to climb.',
  },
  {
    head: 'Holistic review spreads',
    body: 'Admissions offices lean harder on "holistic" review — essays, activities, and personal context weigh more heavily alongside grades, and some schools rethink whether to require test scores.',
  },
  {
    head: 'High-volume, tech-assisted admissions',
    body: 'Students apply to more schools than ever, offices adopt new software to manage the crush, and applicants increasingly use AI to draft their materials.',
  },
];

// ── Finalized stimulus copy — VERBATIM from "College Admission Stimuli (6.28.2026).docx" ──
// Page 1 (shared) → Page 2 (per-condition preview) → Page 3a/3b (per-condition stimulus).
export const STIMULUS = {
  // Page 1 — shown to everyone before condition assignment.
  intro: [
    'We are researchers at the University of Wisconsin. We are interested in learning more about how community members think universities should make admissions decisions.',
    'In particular, we are interested in what factors people think universities should consider when evaluating applicants.',
    'There are no right or wrong answers.',
    'We are interested in your honest opinions about what factors universities should consider when deciding which applicants to admit.',
  ],
  // Page 2 — per-condition preview ("…has changed… these changes may shape… on the next page…").
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
  // Page 3a — experimental (Shifting Demographics) framing.
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
  // Page 3b — control (Process Change) framing.
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

// ── The long-form "news article" wrapper (07-03: the reveal Randy cares about most) ──
// Atlantic-style feature, from a FICTIONAL outlet (no real publication impersonated).
// `lead` renders above the embedded interactive; `body` renders below it. Deliberately
// neutral — it sets the scene without steering the participant toward a conclusion, and
// (per 07-03) it does NOT open on a test-optional line.
export interface Article {
  outlet: string;
  kicker: string;
  headline: string;
  byline: string;
  dek: string;
  lead: string[];
  widgetIntro: string;
  body: string[];
}

export const ARTICLE: Record<Condition, Article> = {
  shift: {
    outlet: 'The Commons Review',
    kicker: 'Higher Education',
    headline: 'The Quietly Remade American Campus',
    byline: 'By Eleanor Hastings',
    dek: 'Over a single generation, the makeup of who sits in a university lecture hall has changed more than most alumni would guess. The records tell the story plainly.',
    lead: [
      'Walk across almost any large American campus today and it looks, in the aggregate, like a different place than it did at the turn of the millennium. The change did not arrive with a single policy or a single headline. It accumulated, one entering class at a time, until the freshmen filing into orientation no longer resembled the class that came before them — or the alumni who like to imagine the school unchanged.',
      'Universities keep meticulous records of who enrolls, and those records are public. They are the least dramatic and most convincing way to see what actually happened. Rather than argue about it, it is worth simply watching the numbers move.',
    ],
    widgetIntro:
      'Below is one flagship university’s own count of its undergraduates, year by year. Step through time and watch the composition change.',
    body: [
      'What stands out is not any single figure but the slope of the lines: the share that once dominated the student body recedes steadily, while groups that were rounding errors a generation ago become a real presence. None of it is sudden. All of it is large.',
      'Demographers who study higher education tend to attribute the shift to a tangle of causes — a more diverse college-age population, wider geographic recruiting, changing immigration patterns, and evolving choices by families about where to apply. The precise mix is debated. The direction is not.',
      'Which raises the question this study is actually about. As the population a university serves changes, so too can the conversation about what a university should be looking for in the first place. On the next screen, we will ask you exactly that.',
    ],
  },
  process: {
    outlet: 'The Commons Review',
    kicker: 'Higher Education',
    headline: 'How Getting In Got Complicated',
    byline: 'By Eleanor Hastings',
    dek: 'Over a single generation, the machinery of applying to college was rebuilt almost completely. The paperwork of 1999 would be unrecognizable to a student today.',
    lead: [
      'A generation ago, applying to college was a physical act. You typed a form, mailed a transcript, asked a teacher for a letter, and waited by the mailbox. Most students applied to a few schools, usually close to home, and an admissions officer read each folder by hand.',
      'That entire process has been quietly rebuilt. The steps a student takes today — and the steps an admissions office takes in return — bear little resemblance to the ones their parents took. Rather than argue about it, it is worth simply watching the process change.',
    ],
    widgetIntro:
      'Below is a short timeline of how the mechanics of applying changed, decade by decade. Step through time and watch it evolve.',
    body: [
      'What stands out is not any single change but the accumulation: each convenience raised the volume, and each rise in volume changed how applications had to be handled. The system that reads your application today was built to cope with numbers the old one never imagined.',
      'Analysts who study admissions tend to attribute the shift to a tangle of causes — new technology, wider access, competition between schools, and evolving choices by families about where and how to apply. The precise mix is debated. The direction is not.',
      'Which raises the question this study is actually about. As the process of applying changes, so too can the conversation about what a university should be looking for in the first place. On the next screen, we will ask you exactly that.',
    ],
  },
};
