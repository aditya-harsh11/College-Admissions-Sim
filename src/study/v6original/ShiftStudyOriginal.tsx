import { useEffect, useRef, useState } from 'react';
import { AllocationPanel } from '../../components/AllocationPanel';
import { useRubric } from '../../hooks/useRubric';
import { logEvent, saveResponse } from '../../lib/logger';
import type { SimConfig } from '../../sim/types';
import { DemographicShiftOriginal } from './DemographicShiftOriginal';
import { ProcessTimelineOriginal } from './ProcessTimelineOriginal';
import { STIMULUS, type Condition } from './demographicsOriginal';

type Step = 'welcome' | 'consent' | 'info' | 'preview' | 'learn' | 'rubric' | 'demographics' | 'done';
const ORDER: Step[] = ['welcome', 'consent', 'info', 'preview', 'learn', 'rubric', 'demographics', 'done'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  consent: 'Consent',
  info: 'About you',
  preview: 'Overview',
  learn: 'Background',
  rubric: 'Your rubric',
  demographics: 'A few questions',
  done: 'Done',
};

const RACE_OPTIONS = [
  'White',
  'Black or African American',
  'Asian',
  'American Indian or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Some other race',
  'Prefer not to say',
];
const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'];
const HISPANIC_OPTIONS = ['No', 'Yes', 'Prefer not to say'];
const INCOME_OPTIONS = [
  'Under $30,000',
  '$30,000–$59,999',
  '$60,000–$99,999',
  '$100,000–$199,999',
  '$200,000 or more',
  'Prefer not to say',
];

/**
 * v6 - "Shifting Demographics" study. A between-subjects design: each participant is randomly
 * assigned to read about the changing DEMOGRAPHICS of the student body (experimental) or the
 * changing admissions PROCESS (control), then allocates 100 points across six factors. There is
 * no pre/post revise - the real-world change is the manipulation, shown before the single rubric.
 */
export function ShiftStudyOriginal({ config }: { config: SimConfig }) {
  const [step, setStep] = useState<Step>('welcome');
  // Random condition, fixed for the session. A `?cond=shift|process` URL override lets us (and
  // Randy) preview a specific condition without reloading for the coin flip.
  const [condition] = useState<Condition>(() => {
    const forced = new URLSearchParams(window.location.search).get('cond');
    if (forced === 'shift' || forced === 'process') return forced;
    return Math.random() < 0.5 ? 'shift' : 'process';
  });
  const [name, setName] = useState('');
  const [race, setRace] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [hispanic, setHispanic] = useState('');
  const [income, setIncome] = useState('');
  const [consented, setConsented] = useState(false);
  const [explored, setExplored] = useState(false);
  const [rubricError, setRubricError] = useState<number | null>(null);

  const rubric = useRubric(config, 'rubric');
  const stepEnteredAt = useRef(0);

  useEffect(() => {
    stepEnteredAt.current = performance.now();
    logEvent('session_start', { study: 'v6-shift', condition });
    logEvent('page_enter', { step: 'welcome' });
  }, [condition]);

  const go = (next: Step) => {
    const now = performance.now();
    logEvent('page_leave', { step, msOnPage: Math.round(now - stepEnteredAt.current) });
    stepEnteredAt.current = now;
    logEvent('page_enter', { step: next });
    setStep(next);
  };

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
    const wide: Record<string, string | number | null> = {
      name,
      condition,
      race,
      age: age ? Number(age) : null,
      gender,
      hispanic,
      income,
    };
    for (const c of config.criteria) wide[`factor_${c.key}`] = rubric.weights[c.key] ?? 0;
    void saveResponse({ name, wide });
    logEvent('study_complete', { condition });
    go('done');
  };

  const stepIndex = ORDER.indexOf(step);
  const framing = condition === 'shift' ? STIMULUS.shift : STIMULUS.process;

  return (
    <div className="study v6-original">
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
            <button className="btn btn--primary" onClick={() => go('consent')}>
              Begin
            </button>
          </section>
        )}

        {step === 'consent' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">Informed consent</p>
            <h2 className="study__h2">Before you start</h2>
            <div className="study__consent">
              <p>
                This is a research study about how people think universities should make admissions
                decisions. You’ll read some background information and then tell us what factors you
                think should matter. There are no right or wrong answers.
              </p>
              <p>
                Your responses (the choices you make and how long you take) are recorded for
                research. Participation is voluntary and you may stop at any time. No personally
                identifying information is required.
              </p>
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
            <button className="btn btn--primary" disabled={!consented} onClick={() => go('info')}>
              Continue
            </button>
          </section>
        )}

        {step === 'info' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">About you</p>
            <h2 className="study__h2">A couple of quick questions</h2>
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
              <span className="study__fieldlabel">Your race</span>
              <select
                className="study__select"
                value={race}
                onChange={(e) => {
                  setRace(e.target.value);
                  logEvent('field_change', { field: 'race', value: e.target.value });
                }}
              >
                <option value="" disabled>
                  Select a group
                </option>
                {RACE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn--primary"
              disabled={!name.trim() || !race}
              onClick={() => go('preview')}
            >
              Continue
            </button>
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
            <button className="btn btn--primary" onClick={() => go('learn')}>
              Continue
            </button>
          </section>
        )}

        {step === 'learn' && (
          <section className="study__card study__card--split">
            <p className="panel__kicker">Some background</p>
            <h2 className="study__h2">{framing.title}</h2>
            <div className="study__learngrid">
              <div className="study__learnprose">
                {framing.paras.map((p, i) => (
                  <p className="study__lead" key={i}>
                    {p}
                  </p>
                ))}
                <p className="study__note">{framing.prompt}</p>
              </div>
              <div className="study__learnviz">
                {condition === 'shift' ? (
                  <DemographicShiftOriginal onExplored={() => setExplored(true)} />
                ) : (
                  <ProcessTimelineOriginal onExplored={() => setExplored(true)} />
                )}
              </div>
            </div>
            <div className="study__learnfoot">
              <button className="btn btn--primary" disabled={!explored} onClick={() => go('rubric')}>
                {explored ? 'Continue' : 'Move through every year to continue'}
              </button>
            </div>
          </section>
        )}

        {step === 'rubric' && (
          <section className="study__card study__card--rubric">
            <p className="study__stagehint">
              Spend your <strong>100 points</strong> across the factors below. Give more points to
              what you think universities should value most when deciding who to admit.
            </p>
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
              <span className="study__fieldlabel">Age</span>
              <input
                className="study__input"
                type="number"
                min={0}
                max={120}
                value={age}
                placeholder="Your age"
                onChange={(e) => {
                  setAge(e.target.value);
                  logEvent('field_change', { field: 'age', value: e.target.value });
                }}
              />
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
            <label className="study__field">
              <span className="study__fieldlabel">Are you of Hispanic, Latino, or Spanish origin?</span>
              <select
                className="study__select"
                value={hispanic}
                onChange={(e) => {
                  setHispanic(e.target.value);
                  logEvent('field_change', { field: 'hispanic', value: e.target.value });
                }}
              >
                <option value="" disabled>
                  Select…
                </option>
                {HISPANIC_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
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
            <button className="btn btn--primary" onClick={finishStudy}>
              Finish
            </button>
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
    </div>
  );
}
