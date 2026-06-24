import { useEffect, useMemo, useRef, useState } from 'react';
import { AllocationPanel } from '../components/AllocationPanel';
import { Donut } from '../components/Donut';
import { Legend } from '../components/Legend';
import { StatStrip } from '../components/StatStrip';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useRubric } from '../hooks/useRubric';
import { logEvent, saveResponse } from '../lib/logger';
import { generateApplicantPool } from '../sim/generator';
import { runSim } from '../sim/scoring';
import type { SimConfig, SimResult, Weights } from '../sim/types';

type Step = 'welcome' | 'consent' | 'info' | 'pre' | 'learn' | 'post' | 'demographics' | 'done';
const ORDER: Step[] = [
  'welcome',
  'consent',
  'info',
  'pre',
  'learn',
  'post',
  'demographics',
  'done',
];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  consent: 'Consent',
  info: 'About you',
  pre: 'Your rubric',
  learn: 'The result',
  post: 'Revise',
  demographics: 'A few questions',
  done: 'Done',
};

// Demographic options. Race uses the US Census standard set; ethnicity (Hispanic origin) is asked
// separately, per OMB/Census convention. Easy to edit here if Randy wants different categories.
const RACE_OPTIONS = [
  'White',
  'Black or African American',
  'Asian',
  'American Indian or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Some other race',
  'Prefer not to say',
];
const GENDER_OPTIONS = ['Woman', 'Man', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'];
const HISPANIC_OPTIONS = ['No', 'Yes', 'Prefer not to say'];
const INCOME_OPTIONS = [
  'Under $30,000',
  '$30,000–$59,999',
  '$60,000–$99,999',
  '$100,000–$199,999',
  '$200,000 or more',
  'Prefer not to say',
];

/** Demographic outcome (pie + legend + headline stats) — reused on the learn & post steps. */
function Outcome({ result, dimmed }: { result: SimResult; dimmed?: boolean }) {
  const classSize = Math.round(useAnimatedNumber(result.classSize));
  return (
    <div className="study__outcome">
      <div className="results__hero">
        <Donut data={result.breakdown} classSize={classSize} animate dimmed={dimmed} />
        <Legend admitted={result.breakdown} pool={result.poolBreakdown} />
      </div>
      <StatStrip
        firstGenPct={result.firstGenPct}
        poolFirstGenPct={result.poolFirstGenPct}
        avgTestIndex={result.avgTestScore * 100}
        poolTestIndex={result.poolAvgTestScore * 100}
      />
    </div>
  );
}

/**
 * Version 2 — the study instrument. A multi-step flow that measures the rubric BEFORE and AFTER
 * the participant sees the demographic consequence of their choices: welcome → consent → about-you
 * → set rubric (pre, blind) → see the split (learn) → revise (post) → demographics → done.
 * Millisecond interaction logging throughout; the response is keyed by the participant's name.
 */
export function StudyFlow({ config }: { config: SimConfig }) {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  // Start unselected (no default) so no single option anchors the participant.
  const [school, setSchool] = useState('');
  // Race is the participant's own group — kept early because it's central to the hypothesis. The
  // rest of the demographics are collected at the END so they don't prime the rubric task.
  const [race, setRace] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [hispanic, setHispanic] = useState('');
  const [income, setIncome] = useState('');
  const [consented, setConsented] = useState(false);
  // When the participant tries to submit a rubric that doesn't sum to 100, hold the offending
  // total here to show the "doesn't add to 100 — revise" popup. (Randy, 06-24: no auto-balance,
  // gate at submit instead.)
  const [rubricError, setRubricError] = useState<number | null>(null);
  // How the 100-pt rule is enforced — a demo toggle so we can show Randy both:
  //   'disabled' → the Finalize button stays greyed out until the total hits 100
  //   'popup'    → the button is live; submitting off-100 pops the "revise" modal
  const [gateStyle, setGateStyle] = useState<'disabled' | 'popup'>('disabled');

  // Randomize the dream-school order once per session so Harvard (or any one school) at the top
  // doesn't anchor people's aspirations. Shuffled in a ref-stable memo, not during render.
  const schoolOrder = useMemo(() => {
    const arr = [...config.schools];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [config.schools]);

  const stepEnteredAt = useRef(0);

  const pre = useRubric(config, 'pre');
  const post = useRubric(config, 'post');
  const [preCaptured, setPreCaptured] = useState<Weights | null>(null);

  const pool = useMemo(() => generateApplicantPool(config), [config]);
  const preResult = useMemo(() => runSim(pool, pre.weights, config), [pool, pre.weights, config]);
  const postResult = useMemo(() => runSim(pool, post.weights, config), [pool, post.weights, config]);

  useEffect(() => {
    stepEnteredAt.current = performance.now();
    logEvent('session_start', { flow: 'study' });
    logEvent('page_enter', { step: 'welcome' });
  }, []);

  const go = (next: Step) => {
    const now = performance.now();
    logEvent('page_leave', { step, msOnPage: Math.round(now - stepEnteredAt.current) });
    stepEnteredAt.current = now;
    logEvent('page_enter', { step: next });
    setStep(next);
  };

  const finishPre = () => {
    if (pre.total !== 100) {
      setRubricError(pre.total);
      logEvent('submit_blocked', { phase: 'pre', total: pre.total });
      return;
    }
    setPreCaptured({ ...pre.weights });
    logEvent('rubric_captured', { phase: 'pre', weights: pre.weights });
    go('learn');
  };

  const startPost = () => {
    // Reveal-then-revise: seed the post rubric from their pre answer so they REVISE (nudge from
    // where they were) rather than rebuild from scratch. (Randy, 06-24.)
    if (preCaptured) post.setAll(preCaptured);
    go('post');
  };

  const finishPost = () => {
    if (post.total !== 100) {
      setRubricError(post.total);
      logEvent('submit_blocked', { phase: 'post', total: post.total });
      return;
    }
    logEvent('rubric_captured', { phase: 'post', weights: post.weights });
    // Demographics come AFTER the task so they don't prime it; save happens at the very end.
    go('demographics');
  };

  /** Compute whole-years age from a YYYY-MM-DD date of birth (Randy: collect DOB, derive age). */
  const ageFromDob = (iso: string): number | null => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
    return age;
  };

  const finishStudy = () => {
    const schoolLabel = config.schools.find((s) => s.id === school)?.label ?? school;
    const postWeights = post.weights;
    // The WIDE row — one row per participant, keyed by name. Add/rename/remove columns HERE; the
    // Sheet writes whatever keys we send, so no Apps Script change is needed for column tweaks.
    const wide: Record<string, string | number | null> = {
      name,
      school: schoolLabel,
      race,
      dob,
      age: ageFromDob(dob),
      gender,
      hispanic,
      income,
    };
    for (const c of config.criteria) {
      const before = preCaptured?.[c.key] ?? 0;
      const after = postWeights[c.key] ?? 0;
      wide[`pre_${c.key}`] = before;
      wide[`post_${c.key}`] = after;
      wide[`delta_${c.key}`] = after - before;
    }
    void saveResponse({ name, wide });
    logEvent('study_complete', {});
    go('done');
  };

  const stepIndex = ORDER.indexOf(step);

  return (
    <div className="study">
      {(step === 'pre' || step === 'post') && (
        <div className="gate-toggle" role="group" aria-label="100-point rule style">
          <button
            className={`gate-toggle__btn ${gateStyle === 'disabled' ? 'is-on' : ''}`}
            onClick={() => setGateStyle('disabled')}
          >
            Greyed-out
          </button>
          <button
            className={`gate-toggle__btn ${gateStyle === 'popup' ? 'is-on' : ''}`}
            onClick={() => setGateStyle('popup')}
          >
            Popup
          </button>
        </div>
      )}
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
            <p className="panel__kicker">A short study</p>
            <h1 className="study__h1">
              You decide <em>who gets in.</em>
            </h1>
            <p className="study__lead">
              You’re about to play the role of a college admissions officer. You’ll get a fixed
              budget of <strong>100 points</strong> to spread across what matters in an applicant,
              and you’ll see the class your choices would admit.
            </p>
            <p className="study__note">Takes about 5 minutes. There are no right answers.</p>
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
                This is a research study about how people make admissions decisions. You’ll set an
                admissions rubric, see a simulated result, and have a chance to revise it. The
                applicant data is <strong>simulated</strong>. No real students are involved.
              </p>
              <p>
                Your interactions (the choices you make and how long you take) are recorded for
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
            <button
              className="btn btn--primary"
              disabled={!consented}
              onClick={() => go('info')}
            >
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
              <span className="study__fieldlabel">Your dream school</span>
              <select
                className="study__select"
                value={school}
                onChange={(e) => {
                  setSchool(e.target.value);
                  logEvent('field_change', { field: 'school', value: e.target.value });
                }}
              >
                <option value="" disabled>
                  Select your dream school
                </option>
                {schoolOrder.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
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
              disabled={!name.trim() || !school || !race}
              onClick={() => go('pre')}
            >
              Continue
            </button>
          </section>
        )}

        {step === 'pre' && (
          <section className="study__card study__card--rubric">
            <p className="study__stagehint">
              Spend your 100 points. You won’t see the result yet. Set the rubric you think is fair.
            </p>
            <AllocationPanel
              criteria={config.criteria}
              weights={pre.weights}
              mode={pre.mode}
              locked={false}
              finalized={false}
              canFinalize={gateStyle === 'disabled' ? pre.total === 100 : undefined}
              ctaLabel="Submit rubric"
              kicker={null}
              onFinalize={finishPre}
              onChange={pre.handleChange}
              onDragStart={pre.handleDragStart}
            />
          </section>
        )}

        {step === 'learn' && (
          <section className="study__card study__card--result">
            <p className="panel__kicker">The class your rubric admits</p>
            <h2 className="study__h2">Here’s who got in.</h2>
            <p className="study__lead">
              With the rubric you just set, this is the demographic makeup of the admitted class: the
              top {Math.round(config.classFraction * 100)}% of{' '}
              {pool.length.toLocaleString()} applicants.
            </p>
            <Outcome result={preResult} />
            <p className="study__lead">
              Now that you’ve seen the class your rubric admits, we’d like to give you the
              opportunity to revise your rubric.
            </p>
            <button className="btn btn--primary" onClick={startPost}>
              Revise my rubric
            </button>
          </section>
        )}

        {step === 'post' && (
          <section
            className={`study__card ${
              config.ui.showPostPie ? 'study__card--split' : 'study__card--rubric'
            }`}
          >
            <p className="study__stagehint">
              Now that you’ve seen the result, adjust your rubric however you like.
            </p>
            <div className={config.ui.showPostPie ? 'study__splitgrid' : ''}>
              <AllocationPanel
                criteria={config.criteria}
                weights={post.weights}
                mode={post.mode}
                locked={false}
                finalized={false}
                canFinalize={gateStyle === 'disabled' ? post.total === 100 : undefined}
                ctaLabel="Finalize"
                kicker={null}
                showAction={!config.ui.showPostPie}
                onFinalize={finishPost}
                onChange={post.handleChange}
                onDragStart={post.handleDragStart}
              />
              {config.ui.showPostPie && (
                <div className="panel results">
                  <header className="panel__head">
                    <div>
                      <p className="panel__kicker">Live result</p>
                      <h2 className="panel__title">The class you’d admit</h2>
                    </div>
                  </header>
                  <Outcome result={postResult} dimmed={post.mode === 'manual' && post.total !== 100} />
                </div>
              )}
            </div>
            {/* Finalize sits in its own box below the live result — the participant commits
                after seeing the consequence. */}
            {config.ui.showPostPie && (
              <div className="panel finalizebox">
                <button
                  className="btn btn--primary"
                  disabled={gateStyle === 'disabled' && post.total !== 100}
                  onClick={finishPost}
                >
                  {gateStyle === 'disabled' && post.total !== 100
                    ? 'Balance to 100 to finalize'
                    : 'Finalize'}
                </button>
              </div>
            )}
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
              <span className="study__fieldlabel">Date of birth</span>
              <input
                className="study__input"
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  logEvent('field_change', { field: 'dob', value: e.target.value });
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
              <span className="study__fieldlabel">
                Are you of Hispanic, Latino, or Spanish origin?
              </span>
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
            <p className="study__lead">
              Your responses have been recorded. Thank you for taking part.
            </p>
            <p className="study__note">You can close this tab now.</p>
          </section>
        )}
      </main>

      {rubricError !== null && (
        <div
          className="modal__scrim"
          role="dialog"
          aria-modal="true"
          onClick={() => setRubricError(null)}
        >
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
