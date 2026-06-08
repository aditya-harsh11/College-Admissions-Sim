import { useEffect, useMemo, useState } from 'react';
import { AllocationPanel } from './components/AllocationPanel';
import { CompareBars } from './components/CompareBars';
import { Donut } from './components/Donut';
import { Legend } from './components/Legend';
import { StatStrip } from './components/StatStrip';
import { useAnimatedNumber } from './hooks/useAnimatedNumber';
import { rebalance } from './lib/rebalance';
import { DEFAULT_CONFIG } from './sim/config';
import { generateApplicantPool } from './sim/generator';
import { runSim } from './sim/scoring';
import type { AttributeKey, Weights } from './sim/types';

const config = DEFAULT_CONFIG;

const defaultWeights = (): Weights =>
  config.criteria.reduce((acc, c) => {
    acc[c.key] = c.defaultWeight;
    return acc;
  }, {} as Weights);

interface Preset {
  id: string;
  label: string;
  weights: Weights;
}

const PRESETS: Preset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    weights: {
      testScore: 17,
      grades: 17,
      communityService: 17,
      extracurriculars: 17,
      leadership: 16,
      lifeExperience: 16,
    },
  },
  {
    id: 'merit',
    label: 'Test-first',
    weights: {
      testScore: 30,
      grades: 30,
      communityService: 10,
      extracurriculars: 10,
      leadership: 10,
      lifeExperience: 10,
    },
  },
  {
    id: 'whole',
    label: 'Whole-person',
    weights: {
      testScore: 8,
      grades: 7,
      communityService: 25,
      extracurriculars: 10,
      leadership: 20,
      lifeExperience: 30,
    },
  },
];

function weightsEqual(a: Weights, b: Weights): boolean {
  return (Object.keys(a) as AttributeKey[]).every((k) => a[k] === b[k]);
}

/**
 * Slider behavior. `auto` = the original proportional crowd-out (always sums to 100).
 * `manual` = you set each criterion independently; the total drifts off 100 and you bring
 * it back yourself. A toggle lets us compare which feels best.
 */
type SliderMode = 'auto' | 'manual';

const clampPts = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Bring an off-100 allocation back to exactly 100, reusing the auto-balance math. */
function normalizeTo100(w: Weights): Weights {
  const keys = Object.keys(w) as AttributeKey[];
  const total = keys.reduce((sum, k) => sum + w[k], 0);
  if (total === 100) return w;
  // Pin the largest weight and let rebalance scale the rest to fill the remainder.
  const maxKey = keys.reduce((a, b) => (w[a] >= w[b] ? a : b));
  return rebalance(w, maxKey, w[maxKey]);
}

export default function App() {
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [mode, setMode] = useState<SliderMode>('auto');
  // Once finalized, the rubric locks (greys out) until the user hits Edit. No navigation —
  // it's an in-place "commit" step, and the natural moment to log the final response (#8).
  const [finalized, setFinalized] = useState(false);
  // While a slider is actively dragged we drop the donut's morph tween so it tracks the
  // drag live; the tween returns on release (and for preset clicks).
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const end = () => setDragging(false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging]);

  // Generated once — a stable pool means every shift is attributable to the rubric.
  const pool = useMemo(() => generateApplicantPool(config), []);
  const result = useMemo(() => runSim(pool, weights, config), [pool, weights]);

  const handleChange = (key: AttributeKey, value: number) =>
    setWeights((w) =>
      mode === 'auto' ? rebalance(w, key, value) : { ...w, [key]: clampPts(value) },
    );

  const handleModeChange = (next: SliderMode) => {
    // Snap back to a valid 100 when returning to auto, so the budget never reads invalid.
    if (next === 'auto') setWeights((w) => normalizeTo100(w));
    setMode(next);
  };

  const animatedClassSize = Math.round(useAnimatedNumber(result.classSize));

  // In manual mode the total can drift off 100; while it has, the rubric isn't "valid" yet,
  // so we dim the outcome as a soft signal (auto mode always sums to 100, so it's never dimmed).
  const total = (Object.keys(weights) as AttributeKey[]).reduce((sum, k) => sum + weights[k], 0);
  const invalid = mode === 'manual' && total !== 100;
  // You can only commit a rubric that spends exactly the 100-point budget.
  const canFinalize = total === 100;

  const handleFinalize = () => {
    // TODO(#8): saveResponse({ weights, mode, result, … }) — this is the commit moment.
    setFinalized(true);
  };

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="masthead__title">
          You decide <em>who gets in.</em>
        </h1>

        <div className="masthead__controls">
          <div className="modeswitch" role="group" aria-label="Slider behavior">
            <span className="modeswitch__label">Sliders</span>
            <button
              className={`modeswitch__opt ${mode === 'auto' ? 'modeswitch__opt--on' : ''}`}
              onClick={() => handleModeChange('auto')}
              disabled={finalized}
            >
              Auto-balance
            </button>
            <button
              className={`modeswitch__opt ${mode === 'manual' ? 'modeswitch__opt--on' : ''}`}
              onClick={() => handleModeChange('manual')}
              disabled={finalized}
            >
              Manual
            </button>
          </div>

          {config.ui.showPresets && (
            <div className="presets">
              <span className="presets__label">Try a rubric</span>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`preset ${weightsEqual(weights, p.weights) ? 'preset--on' : ''}`}
                  onClick={() => setWeights({ ...p.weights })}
                  disabled={finalized}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="lab">
        <AllocationPanel
          criteria={config.criteria}
          weights={weights}
          mode={mode}
          locked={finalized}
          finalized={finalized}
          canFinalize={canFinalize}
          onFinalize={handleFinalize}
          onChange={handleChange}
          onDragStart={() => setDragging(true)}
        />

        <section className="panel results">
          <header className="panel__head">
            <div>
              <p className="panel__kicker">Step 02</p>
              <h2 className="panel__title">The class you'd admit</h2>
            </div>
            <span className="results__count">
              top {Math.round(config.classFraction * 100)}% of {pool.length.toLocaleString()}
            </span>
          </header>

          <div className="results__hero">
            <Donut
              data={result.breakdown}
              classSize={animatedClassSize}
              animate={!dragging}
              dimmed={invalid}
            />
            <Legend admitted={result.breakdown} pool={result.poolBreakdown} />
          </div>

          <StatStrip
            firstGenPct={result.firstGenPct}
            poolFirstGenPct={result.poolFirstGenPct}
            avgTestIndex={result.avgTestScore * 100}
            poolTestIndex={result.poolAvgTestScore * 100}
          />

          <div className="results__compare">
            <h3 className="results__subhead">Who applied vs. who got in</h3>
            <CompareBars pool={result.poolBreakdown} admitted={result.breakdown} />
          </div>
        </section>
      </main>
    </div>
  );
}
