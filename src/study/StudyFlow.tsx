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

type Step = 'welcome' | 'consent' | 'info' | 'pre' | 'learn' | 'post' | 'done';
const ORDER: Step[] = ['welcome', 'consent', 'info', 'pre', 'learn', 'post', 'done'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  consent: 'Consent',
  info: 'About you',
  pre: 'Your rubric',
  learn: 'The result',
  post: 'Revise',
  done: 'Done',
};

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
 * → set rubric (pre, blind) → see the split (learn) → revise (post) → done. Random condition
 * assignment + millisecond interaction logging throughout (#8).
 */
export function StudyFlow({ config }: { config: SimConfig }) {
  const [step, setStep] = useState<Step>('welcome');
  const [school, setSchool] = useState(config.schools[0]?.id ?? '');
  const [group, setGroup] = useState(config.groups[0]?.id ?? '');
  const [consented, setConsented] = useState(false);

  // Random A/B condition, fixed for the session (the manipulation goes here later). Assigned in
  // the mount effect so we never call an impure function during render.
  const conditionRef = useRef<'A' | 'B'>('A');
  const stepEnteredAt = useRef(0);

  const pre = useRubric(config, 'pre');
  const post = useRubric(config, 'post');
  const [preCaptured, setPreCaptured] = useState<Weights | null>(null);

  const pool = useMemo(() => generateApplicantPool(config), [config]);
  const preResult = useMemo(() => runSim(pool, pre.weights, config), [pool, pre.weights, config]);
  const postResult = useMemo(() => runSim(pool, post.weights, config), [pool, post.weights, config]);

  useEffect(() => {
    conditionRef.current = Math.random() < 0.5 ? 'A' : 'B';
    stepEnteredAt.current = performance.now();
    logEvent('session_start', { flow: 'study', condition: conditionRef.current });
    logEvent('page_enter', { step: 'welcome' });
  }, []);

  const go = (next: Step) => {
    const now = performance.now();
    logEvent('page_leave', { step, dwellMs: Math.round(now - stepEnteredAt.current) });
    stepEnteredAt.current = now;
    logEvent('page_enter', { step: next });
    setStep(next);
  };

  const finishPre = () => {
    setPreCaptured({ ...pre.weights });
    logEvent('rubric_captured', { phase: 'pre', weights: pre.weights });
    go('learn');
  };

  const startPost = () => {
    // Reveal-then-revise: seed the post rubric from their pre answer so they edit, not restart.
    if (preCaptured) post.setAll(preCaptured);
    go('post');
  };

  const finishPost = () => {
    logEvent('rubric_captured', { phase: 'post', weights: post.weights });
    const schoolLabel = config.schools.find((s) => s.id === school)?.label ?? school;
    const groupLabel = config.groups.find((g) => g.id === group)?.label ?? group;
    void saveResponse({
      flow: 'study',
      condition: conditionRef.current,
      school: { id: school, label: schoolLabel },
      group: { id: group, label: groupLabel },
      preWeights: preCaptured,
      postWeights: post.weights,
      preOutcome: { breakdown: preResult.breakdown, firstGenPct: preResult.firstGenPct },
      postOutcome: { breakdown: postResult.breakdown, firstGenPct: postResult.firstGenPct },
    });
    go('done');
  };

  const stepIndex = ORDER.indexOf(step);

  return (
    <div className="study">
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
              budget of <strong>100 points</strong> to spread across what matters in an applicant —
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
                applicant data is <strong>simulated</strong> — no real students are involved.
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
              <span className="study__fieldlabel">Your dream school</span>
              <select
                className="study__select"
                value={school}
                onChange={(e) => {
                  setSchool(e.target.value);
                  logEvent('field_change', { field: 'school', value: e.target.value });
                }}
              >
                {config.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="study__field">
              <span className="study__fieldlabel">Your group</span>
              <select
                className="study__select"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  logEvent('field_change', { field: 'group', value: e.target.value });
                }}
              >
                {config.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="study__note">
              (Placeholder fields — these will be tailored per study version.)
            </p>
            <button className="btn btn--primary" onClick={() => go('pre')}>
              Continue
            </button>
          </section>
        )}

        {step === 'pre' && (
          <section className="study__card study__card--rubric">
            <p className="study__stagehint">
              Spend your 100 points. You won’t see the result yet — set the rubric you think is
              fair.
            </p>
            <AllocationPanel
              criteria={config.criteria}
              weights={pre.weights}
              mode={pre.mode}
              locked={false}
              finalized={false}
              canFinalize={pre.total === 100}
              ctaLabel="Submit rubric"
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
              With the rubric you just set, this is the demographic makeup of the admitted class —
              the top {Math.round(config.classFraction * 100)}% of{' '}
              {pool.length.toLocaleString()} applicants.
            </p>
            <Outcome result={preResult} />
            <p className="study__note">
              A rubric that feels neutral can still reshape who gets in. Take a look — then decide
              whether you’d like to change anything.
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
              Now that you’ve seen the result, adjust your rubric however you like — or leave it as
              is.
            </p>
            <div className={config.ui.showPostPie ? 'study__splitgrid' : ''}>
              <AllocationPanel
                criteria={config.criteria}
                weights={post.weights}
                mode={post.mode}
                locked={false}
                finalized={false}
                canFinalize={post.total === 100}
                ctaLabel="Finalize"
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
          </section>
        )}

        {step === 'done' && (
          <section className="study__card study__card--prose">
            <p className="panel__kicker">All done</p>
            <h2 className="study__h2">Thank you.</h2>
            <p className="study__lead">
              Your responses have been recorded. Here’s how your rubric changed once you saw the
              result:
            </p>
            <BeforeAfter config={config} pre={preCaptured} post={post.weights} />
            <p className="study__note">You can close this tab now.</p>
          </section>
        )}
      </main>
    </div>
  );
}

/** Small before/after table of the two rubrics, highlighting what the participant changed. */
function BeforeAfter({
  config,
  pre,
  post,
}: {
  config: SimConfig;
  pre: Weights | null;
  post: Weights;
}) {
  if (!pre) return null;
  return (
    <table className="study__ba">
      <thead>
        <tr>
          <th>Criterion</th>
          <th>Before</th>
          <th>After</th>
          <th>Δ</th>
        </tr>
      </thead>
      <tbody>
        {config.criteria.map((c) => {
          const delta = post[c.key] - pre[c.key];
          return (
            <tr key={c.key}>
              <td>{c.label}</td>
              <td>{pre[c.key]}</td>
              <td>{post[c.key]}</td>
              <td className={delta > 0 ? 'delta--up' : delta < 0 ? 'delta--down' : 'delta--flat'}>
                {delta > 0 ? `+${delta}` : delta < 0 ? delta : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
