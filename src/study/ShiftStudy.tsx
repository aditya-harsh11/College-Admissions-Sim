import { useEffect, useRef, useState } from 'react';
import { AllocationPanel } from '../components/AllocationPanel';
import { useRubric } from '../hooks/useRubric';
import { logEvent, saveResponse } from '../lib/logger';
import type { SimConfig } from '../sim/types';
import { DemographicShift } from './DemographicShift';
import { ProcessTimeline } from './ProcessTimeline';
import { ARTICLE, resolveDataset, STIMULUS, type Condition } from './demographics';
import { clearSession, loadSession, saveSession } from './session';

type Step = 'welcome' | 'consent' | 'preview' | 'learn' | 'rubric' | 'demographics' | 'done';
const ORDER: Step[] = ['welcome', 'consent', 'preview', 'learn', 'rubric', 'demographics', 'done'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  consent: 'Consent',
  preview: 'Overview',
  learn: 'The article',
  rubric: 'Your rubric',
  demographics: 'About you',
  done: 'Done',
};

/** Short code identifying this app in the shared response sheet (07-03: a `study` column). */
const STUDY_CODE = 'ca-v6';

// Race + ethnicity as one "check all that apply" group (07-09): multiracial people pick several,
// Hispanic/Latino is its own checkbox, "Other" reveals a free-text box, and "Prefer not to say" is
// exclusive. Order matters — the two specials sit last.
const RACE_OPTIONS = [
  'White',
  'Black or African American',
  'Asian',
  'American Indian or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Hispanic or Latino',
  'Other',
  'Prefer not to say',
];
const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'];
const INCOME_OPTIONS = [
  'Under $30,000',
  '$30,000–$59,999',
  '$60,000–$99,999',
  '$100,000–$199,999',
  '$200,000 or more',
  'Prefer not to say',
];

// Consent copy (placeholder) kept in one place so it renders identically inline and full-screen.
const CONSENT_TEXT = [
  'This is a research study about how people think universities should make admissions decisions. You’ll read some background information and then tell us what factors you think should matter. There are no right or wrong answers.',
  'Your responses (the choices you make and how long you take) are recorded for research. Participation is voluntary and you may stop at any time. No personally identifying information is required.',
];

/**
 * A letter-prefixed participant ID (07-03 item 8), e.g. "CA-7F3K9" — NOT 101/102. The `CA-`
 * prefix makes the app obvious at a glance and the base-36 body forces a string type in R (no
 * `as.factor` gymnastics). Assigned once per session.
 */
function makeParticipantId(): string {
  return `CA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/**
 * v6 — "Shifting Demographics" study. A between-subjects design: each participant is randomly
 * assigned to read about the changing DEMOGRAPHICS of the student body (experimental) or the
 * changing admissions PROCESS (control), then allocates 100 points across six factors. There is
 * no pre/post revise — the real-world change is the manipulation, shown before the single rubric.
 *
 * The reveal is wrapped in a long-form "news article" (07-03) with the interactive year-by-year
 * widget embedded mid-article. Which real dataset the widget shows is chosen by ?data=uw|national|
 * fake (default UW). Progress is saved on every page so abandoned runs are still captured, and an
 * entrance/exit pair lets us compute completion rate.
 */
export function ShiftStudy({ config }: { config: SimConfig }) {
  // Boot state, computed once: a `?cond=` preview override + any in-progress session to resume from.
  // We resume ONLY once a run has progressed past the intro pages, so a mid-study refresh never
  // restarts (the "cookies" requirement) while a fresh visit at the welcome screen still re-rolls the
  // random condition instead of being pinned to a stale one. `?data=` selects the dataset variant and
  // is NOT a preview — real runs use it, so it must still persist. Forcing a condition (`?cond=`) is a
  // deliberate researcher preview → never resume, never save (so it can't touch a real session).
  const [boot] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const forcedCond = params.get('cond');
    const forcedData = params.get('data');
    const saved = loadSession();
    const resumable =
      !forcedCond &&
      !!saved &&
      // Only resume a step that still exists in the current flow — a session saved on an old build
      // (e.g. the removed 'info' step) falls through to a fresh welcome instead of a blank page.
      ORDER.includes(saved.step as Step) &&
      saved.step !== 'welcome' &&
      saved.step !== 'consent' &&
      saved.step !== 'done';
    return { forcedCond, forcedData, persisted: resumable ? saved : null };
  });

  const [step, setStep] = useState<Step>(() => (boot.persisted?.step as Step) ?? 'welcome');
  // Random condition, fixed for the session. A `?cond=shift|process` URL override lets us (and
  // Randy) preview a specific condition without reloading; a resumed session keeps its condition.
  const [condition] = useState<Condition>(() => {
    if (boot.forcedCond === 'shift' || boot.forcedCond === 'process') return boot.forcedCond;
    return boot.persisted?.condition ?? (Math.random() < 0.5 ? 'shift' : 'process');
  });
  // Which real dataset the shift visual shows (07-03 item 7: "v6 UW" vs "v6 overall (college)"
  // vs a dummy set). Fixed per session; picked by ?data=, a resumed session, or the config default.
  const [dataset] = useState(() =>
    resolveDataset(boot.forcedData ?? boot.persisted?.dataset ?? config.ui.shiftDataset),
  );
  const [participantId] = useState(() => boot.persisted?.participantId ?? makeParticipantId());

  const [name, setName] = useState(() => boot.persisted?.name ?? '');
  const [raceSel, setRaceSel] = useState<string[]>(() => boot.persisted?.raceSel ?? []);
  const [raceOther, setRaceOther] = useState(() => boot.persisted?.raceOther ?? '');
  const [age, setAge] = useState(() => boot.persisted?.age ?? '');
  const [gender, setGender] = useState(() => boot.persisted?.gender ?? '');
  const [income, setIncome] = useState(() => boot.persisted?.income ?? '');
  const [consented, setConsented] = useState(() => boot.persisted?.consented ?? false);
  const [explored, setExplored] = useState(() => boot.persisted?.explored ?? false);
  const [rubricError, setRubricError] = useState<number | null>(null);

  // Demo-only presentation toggles (top-right) so the lab can compare shift-visual variants live —
  // NOT participant data, so they're deliberately not persisted in the session. `advanceMode` = how
  // the reader steps years (click chips / scroll-lock / Prev-Next buttons); `chartMode` = pie vs bar.
  const [advanceMode, setAdvanceMode] = useState<'click' | 'scroll' | 'next'>('click');
  const [chartMode, setChartMode] = useState<'bar' | 'pie'>('bar');
  // Consent full-screen reading overlay (07-09: let people expand the page-long consent text).
  const [consentFull, setConsentFull] = useState(false);

  const rubric = useRubric(config, 'rubric');
  const stepEnteredAt = useRef(0);

  // Cumulative WIDE row — one per participant, upserted by `id`. Column groups mirror v4's sheet so
  // the two studies read the same: IDENTITY (`id` = the CA-XXXXX code, `name` = typed name) → STATUS
  // → ASSIGNMENT → DEMOGRAPHICS → the six factor weights (the DV). `complete` (0/1) uses v4's exact
  // key, so it's a single column. Same shape whether we save mid-run (per-page) or at the end.
  // Flatten the check-all-that-apply race/ethnicity into the two existing sheet columns: `race` = the
  // raw multi-select (";"-joined, "Other" carrying its free text), `hispanic` = a derived Yes/No flag.
  const raceStr = raceSel.includes('Prefer not to say')
    ? 'Prefer not to say'
    : raceSel
        .map((r) => (r === 'Other' ? (raceOther.trim() ? `Other: ${raceOther.trim()}` : 'Other') : r))
        .join('; ');
  const hispanicStr = raceSel.includes('Prefer not to say')
    ? 'Prefer not to say'
    : raceSel.includes('Hispanic or Latino')
      ? 'Yes'
      : raceSel.length
        ? 'No'
        : '';

  const buildWide = (current: Step): Record<string, string | number | null> => {
    const wide: Record<string, string | number | null> = {
      // identity
      id: participantId,
      name,
      // status
      furthestStep: current,
      complete: current === 'done' ? 1 : 0,
      // assignment
      study: STUDY_CODE,
      condition,
      dataset: dataset.id,
      // demographics
      race: raceStr,
      age: age ? Number(age) : null,
      gender,
      hispanic: hispanicStr,
      income,
    };
    // the dependent variable: points allocated to each of the six factors
    for (const c of config.criteria) wide[`factor_${c.key}`] = rubric.weights[c.key] ?? 0;
    return wide;
  };

  useEffect(() => {
    stepEnteredAt.current = performance.now();
    const resumed = !!boot.persisted;
    // Events are keyed by participantId in the sheet and every run's study/condition/dataset live in
    // the WIDE row, so we DON'T repeat them on each event — keeping the Events tab lean (like v4's).
    logEvent('session_start', { resumed });
    // Fresh load → log an entrance (paired with the exit at 'done' → completion / abandonment).
    // Resumed load (refresh mid-study) → log a 'resume' instead, so entrances stay one-per-run.
    if (resumed) logEvent('resume', { step });
    else logEvent('entrance');
    logEvent('page_enter', { step });
    // Restore the rubric they had built before the reload (useRubric otherwise starts blank).
    if (boot.persisted?.weights) rubric.setAll(boot.persisted.weights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh persistence (the "cookies" item): snapshot the whole session on every change so a reload
  // resumes exactly where they left off. We only persist ONCE the participant has entered the study
  // (past welcome/consent) — matching the resume threshold above, so intro refreshes stay fresh and a
  // new random condition can be rolled. On 'done' we clear it so a reused browser starts fresh. A
  // `?cond=` preview never saves, so it can't overwrite a real participant's run.
  useEffect(() => {
    if (boot.forcedCond) return;
    if (step === 'welcome' || step === 'consent') return;
    if (step === 'done') {
      clearSession();
      return;
    }
    saveSession({
      participantId,
      condition,
      dataset: dataset.id,
      step,
      name,
      raceSel,
      raceOther,
      age,
      gender,
      income,
      consented,
      explored,
      weights: rubric.weights,
    });
  }, [
    boot.forcedCond,
    participantId,
    condition,
    dataset.id,
    step,
    name,
    raceSel,
    raceOther,
    age,
    gender,
    income,
    consented,
    explored,
    rubric.weights,
  ]);

  // Per-page saving (07-03 item 9): upsert the cumulative WIDE row on every step change so an
  // abandoned run is still captured. SHEET_ENDPOINT is now set (shared with v4) → this pushes to the
  // "v6 Responses" / "v6 Events" tabs, with a localStorage backup always kept too.
  useEffect(() => {
    void saveResponse({ id: participantId, name, wide: buildWide(step) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const go = (next: Step) => {
    const now = performance.now();
    logEvent('page_leave', { step, msOnPage: Math.round(now - stepEnteredAt.current) });
    stepEnteredAt.current = now;
    logEvent('page_enter', { step: next });
    setStep(next);
  };

  // Toggle one race/ethnicity checkbox. "Prefer not to say" is exclusive (clears everything else, and
  // any real selection clears it), so the two never coexist.
  const toggleRace = (opt: string) => {
    setRaceSel((prev) => {
      let next: string[];
      if (opt === 'Prefer not to say') {
        next = prev.includes(opt) ? [] : ['Prefer not to say'];
      } else {
        const base = prev.filter((r) => r !== 'Prefer not to say');
        next = base.includes(opt) ? base.filter((r) => r !== opt) : [...base, opt];
      }
      logEvent('field_change', { field: 'race', value: next.join('; ') });
      return next;
    });
  };

  // 18+ gate (07-09): the study requires adults, so Finish stays disabled until a valid age ≥ 18.
  const ageNum = Number(age);
  const ageValid = age.trim() !== '' && Number.isInteger(ageNum) && ageNum >= 18 && ageNum <= 120;

  const finishRubric = () => {
    if (rubric.total !== 100) {
      setRubricError(rubric.total);
      logEvent('submit_blocked', { phase: 'rubric', total: rubric.total });
      return;
    }
    logEvent('rubric_captured', { phase: 'rubric', weights: rubric.weights });
    go('demographics');
  };

  const finishStudy = () => {
    // 'exit' pairs with 'entrance' for the completion rate; the wide row's `complete=1` records it too.
    logEvent('exit');
    // Final save stamps submittedAt + complete; the per-page effect also fires on the 'done' step.
    void saveResponse({ id: participantId, name, wide: buildWide('done'), complete: true });
    go('done');
  };

  const stepIndex = ORDER.indexOf(step);
  const article = ARTICLE[condition];

  return (
    <div className="study">
      {/* Demo controls (top-right) to compare the shift-visual variants for the lab — not shown to
          participants in the final study. Advance = click/scrub vs scroll-lock; Chart = bar vs pie. */}
      <div className="demotoggle" role="group" aria-label="Demo controls">
        <div className="demotoggle__row">
          <span className="demotoggle__label">Advance</span>
          <button
            className={`demotoggle__btn ${advanceMode === 'click' ? 'is-on' : ''}`}
            onClick={() => setAdvanceMode('click')}
          >
            Click
          </button>
          <button
            className={`demotoggle__btn ${advanceMode === 'scroll' ? 'is-on' : ''}`}
            onClick={() => setAdvanceMode('scroll')}
          >
            Scroll-lock
          </button>
          <button
            className={`demotoggle__btn ${advanceMode === 'next' ? 'is-on' : ''}`}
            onClick={() => setAdvanceMode('next')}
          >
            Next
          </button>
        </div>
        <div className="demotoggle__row">
          <span className="demotoggle__label">Chart</span>
          <button
            className={`demotoggle__btn ${chartMode === 'bar' ? 'is-on' : ''}`}
            onClick={() => setChartMode('bar')}
          >
            Bar
          </button>
          <button
            className={`demotoggle__btn ${chartMode === 'pie' ? 'is-on' : ''}`}
            onClick={() => setChartMode('pie')}
          >
            Pie
          </button>
        </div>
      </div>

      <header className="study__bar">
        <span className="study__brand">College Admissions</span>
        <ol className="study__progress" aria-label="Progress">
          {ORDER.filter((s) => s !== 'done').map((s, i) => (
            <li
              key={s}
              className={`study__dot ${i === stepIndex ? 'study__dot--on' : ''} ${
                i < stepIndex ? 'study__dot--done' : ''
              }`}
            >
              <span className="study__dotnum">{i + 1}</span>
              <span className="study__dotlabel">{STEP_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      </header>

      <main className="study__stage">
        {step === 'welcome' && (
          <section className="study__card study__card--prose">
            <h1 className="study__h1">
              What should universities <em>value?</em>
            </h1>
            {STIMULUS.intro.map((p, i) => (
              <p className={i === STIMULUS.intro.length - 1 ? 'study__note' : 'study__lead'} key={i}>
                {p}
              </p>
            ))}
            <div className="study__actions">
              <button className="btn btn--primary" onClick={() => go('consent')}>
                Begin
              </button>
            </div>
          </section>
        )}

        {step === 'consent' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">Before you begin</p>
            <h2 className="study__h2">Informed consent</h2>
            <div className="study__consenthead">
              <button
                type="button"
                className="study__expand"
                onClick={() => {
                  setConsentFull(true);
                  logEvent('consent_expand');
                }}
              >
                ⤢ Read full screen
              </button>
            </div>
            <div className="study__consent">
              {CONSENT_TEXT.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <label className="study__check">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => {
                  setConsented(e.target.checked);
                  logEvent('consent', { consented: e.target.checked });
                }}
              />
              <span>I’m 18 or older and I consent to participate.</span>
            </label>
            <div className="study__actions">
              <button className="btn btn--primary" disabled={!consented} onClick={() => go('preview')}>
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 'preview' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">Some background</p>
            {STIMULUS.preview[condition].map((p, i) => (
              <p className="study__lead" key={i}>
                {p}
              </p>
            ))}
            <div className="study__actions">
              <button className="btn btn--primary" onClick={() => go('learn')}>
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 'learn' && (
          <section className="study__card study__card--article">
            <article className="article">
              {(article.outlet || article.kicker) && (
                <p className="article__kicker">
                  {[article.outlet, article.kicker].filter(Boolean).join(' · ')}
                </p>
              )}
              <h1 className="article__headline">{article.headline}</h1>
              <p className="article__dek">{article.dek}</p>
              <p className="article__byline">{article.byline}</p>

              <div className="article__body">
                {article.lead.map((p, i) => (
                  <p key={`lead-${i}`}>{p}</p>
                ))}

                {/* The interactive reveal, embedded mid-article as a figure. */}
                <figure className="article__figure">
                  <p className="article__figintro">{article.widgetIntro}</p>
                  {condition === 'shift' ? (
                    <DemographicShift
                      dataset={dataset}
                      onExplored={() => setExplored(true)}
                      advanceMode={advanceMode}
                      chartMode={chartMode}
                    />
                  ) : (
                    <ProcessTimeline
                      dataset={dataset}
                      onExplored={() => setExplored(true)}
                      advanceMode={advanceMode}
                    />
                  )}
                </figure>

                {/* In scroll-lock mode the widget nearly fills the screen, so we hold back everything
                    below it ("What stands out…" + the prompt) until the reader has scrubbed every year
                    — then it's revealed. Keeps the lock uncluttered; in click mode it's always shown. */}
                {(advanceMode !== 'scroll' || explored) && (
                  <>
                    {article.body.map((p, i) => (
                      <p key={`body-${i}`} className="article__reveal">
                        {p}
                      </p>
                    ))}

                    {/* Verbatim stimulus instruction (docx page 3) — the formal prompt into the task. */}
                    <aside className="article__prompt article__reveal">
                      {STIMULUS[condition].prompt}
                    </aside>
                  </>
                )}
              </div>
            </article>

            <div className="study__learnfoot">
              <button className="btn btn--primary" disabled={!explored} onClick={() => go('rubric')}>
                {explored ? 'Continue' : 'Move through every year to continue'}
              </button>
            </div>
          </section>
        )}

        {step === 'rubric' && (
          <section className="study__card study__card--rubric">
            <div className="study__rubrichead">
              <h2 className="study__h2">
                Spend your <em>100 points</em>
              </h2>
              <p className="study__stagehint">
                Give more to what you think universities should value most when deciding who to admit.
                Your points must total exactly 100 to continue.
              </p>
            </div>
            <AllocationPanel
              criteria={config.criteria}
              weights={rubric.weights}
              mode={rubric.mode}
              locked={false}
              finalized={false}
              canFinalize={rubric.total === 100}
              ctaLabel="Submit rubric"
              kicker={null}
              onFinalize={finishRubric}
              onChange={rubric.handleChange}
              onDragStart={rubric.handleDragStart}
            />
          </section>
        )}

        {step === 'demographics' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">Almost done</p>
            <h2 className="study__h2">A few questions about you</h2>
            <p className="study__note">
              These help us understand who took part. Answer as much as you’re comfortable with.
            </p>
            <label className="study__field">
              <span className="study__fieldlabel">Your name</span>
              <input
                className="study__input"
                type="text"
                value={name}
                placeholder="Type your name"
                onChange={(e) => {
                  setName(e.target.value);
                  logEvent('field_change', { field: 'name', value: e.target.value });
                }}
              />
            </label>
            <label className="study__field">
              <span className="study__fieldlabel">Age</span>
              <input
                className="study__input"
                type="number"
                min={18}
                max={120}
                value={age}
                placeholder="Your age"
                onChange={(e) => {
                  setAge(e.target.value);
                  logEvent('field_change', { field: 'age', value: e.target.value });
                }}
              />
              {age.trim() !== '' && !ageValid && (
                <span className="study__fieldnote">You must be 18 or older to take part.</span>
              )}
            </label>
            <label className="study__field">
              <span className="study__fieldlabel">Gender</span>
              <select
                className="study__select"
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  logEvent('field_change', { field: 'gender', value: e.target.value });
                }}
              >
                <option value="" disabled>
                  Select…
                </option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="study__field study__fieldset">
              <legend className="study__fieldlabel">Race and ethnicity — select all that apply</legend>
              <div className="study__checks">
                {RACE_OPTIONS.map((r) => (
                  <label key={r} className="study__checkitem">
                    <input
                      type="checkbox"
                      checked={raceSel.includes(r)}
                      onChange={() => toggleRace(r)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
              {raceSel.includes('Other') && (
                <input
                  className="study__input study__otherinput"
                  type="text"
                  value={raceOther}
                  placeholder="Please specify"
                  onChange={(e) => {
                    setRaceOther(e.target.value);
                    logEvent('field_change', { field: 'raceOther', value: e.target.value });
                  }}
                />
              )}
            </fieldset>
            <label className="study__field">
              <span className="study__fieldlabel">Family income</span>
              <select
                className="study__select"
                value={income}
                onChange={(e) => {
                  setIncome(e.target.value);
                  logEvent('field_change', { field: 'income', value: e.target.value });
                }}
              >
                <option value="" disabled>
                  Select…
                </option>
                {INCOME_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <div className="study__actions">
              <button className="btn btn--primary" disabled={!ageValid} onClick={finishStudy}>
                Finish
              </button>
            </div>
          </section>
        )}

        {step === 'done' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">All done</p>
            <h2 className="study__h2">Thank you.</h2>
            <p className="study__lead">Your responses have been recorded. Thank you for taking part.</p>
            <p className="study__note">You can close this tab now.</p>
          </section>
        )}
      </main>

      {rubricError !== null && (
        <div className="modal__scrim" role="dialog" aria-modal="true" onClick={() => setRubricError(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal__title">Your points add up to {rubricError}, not 100</h3>
            <p className="modal__body">
              Please adjust your rubric so the points total exactly <strong>100</strong> before
              continuing.
            </p>
            <button className="btn btn--primary" onClick={() => setRubricError(null)}>
              Revise
            </button>
          </div>
        </div>
      )}

      {/* Full-screen consent reader (07-09) — the same consent text, expanded for easy reading. */}
      {consentFull && (
        <div className="consentfull" role="dialog" aria-modal="true">
          <div className="consentfull__inner">
            <div className="consentfull__head">
              <h2 className="study__h2">Informed consent</h2>
              <button className="btn" onClick={() => setConsentFull(false)}>
                Close
              </button>
            </div>
            <div className="consentfull__body">
              {CONSENT_TEXT.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
