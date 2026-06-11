import { useEffect, useMemo, useState } from 'react';
import { AllocationPanel } from './components/AllocationPanel';
import { CompareBars } from './components/CompareBars';
import { Donut } from './components/Donut';
import { Legend } from './components/Legend';
import { StatStrip } from './components/StatStrip';
import { useAnimatedNumber } from './hooks/useAnimatedNumber';
import { rebalance } from './lib/rebalance';
import { logEvent, saveResponse } from './lib/logger';
import { DEFAULT_CONFIG } from './sim/config';
import { generateApplicantPool } from './sim/generator';
import { runSim } from './sim/scoring';
import type { AttributeKey, Weights } from './sim/types';

const config = DEFAULT_CONFIG;

const defaultWeights = (): Weights =>
  config.criteria.reduce((acc, c) => {
    // Study version starts blank (all 0) so participants build the rubric from scratch.
    acc[c.key] = config.ui.startBlank ? 0 : c.defaultWeight;
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

const sum = (w: Weights) =>
  (Object.keys(w) as AttributeKey[]).reduce((s, k) => s + w[k], 0);

/** Bring an off-100 allocation back to exactly 100, reusing the auto-balance math. */
function normalizeTo100(w: Weights): Weights {
  const keys = Object.keys(w) as AttributeKey[];
  const total = keys.reduce((s, k) => s + w[k], 0);
  if (total === 100) return w;
  // Pin the largest weight and let rebalance scale the rest to fill the remainder.
  const maxKey = keys.reduce((a, b) => (w[a] >= w[b] ? a : b));
  return rebalance(w, maxKey, w[maxKey]);
}

export default function App() {
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [mode, setMode] = useState<SliderMode>(config.ui.defaultMode);
  // Once finalized, the rubric locks (greys out). No navigation — it's an in-place "commit"
  // step, and the natural moment to log the final response (#8).
  const [finalized, setFinalized] = useState(false);
  // While a slider is actively dragged we drop the donut's morph tween so it tracks the
  // drag live; the tween returns on release (and for preset clicks).
  const [dragging, setDragging] = useState(false);

  // Log the session once, with the active study config so each response is self-describing.
  useEffect(() => {
    logEvent('session_start', {
      startBlank: config.ui.startBlank,
      defaultMode: config.ui.defaultMode,
      showPoolBar: config.ui.showPoolBar,
      crowdOutAt100: config.ui.crowdOutAt100,
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      setDragging(false);
      logEvent('drag_end');
    };
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

  const handleChange = (key: AttributeKey, value: number) => {
    let next: Weights;
    if (mode === 'auto') {
      next = rebalance(weights, key, value);
    } else {
      const v = clampPts(value);
      const tentativeTotal = sum(weights) - weights[key] + v;
      // Ben's refinement: once the budget is full, extra points crowd the others out
      // (so the total holds at 100 instead of overflowing).
      if (config.ui.crowdOutAt100 && tentativeTotal > 100) {
        next = rebalance(weights, key, v);
      } else {
        next = { ...weights, [key]: v };
      }
    }
    logEvent('weight_change', { key, from: weights[key], to: next[key], mode, total: sum(next) });
    setWeights(next);
  };

  const handleModeChange = (next: SliderMode) => {
    logEvent('mode_change', { from: mode, to: next });
    // Snap back to a valid 100 when returning to auto, so the budget never reads invalid.
    if (next === 'auto') setWeights((w) => normalizeTo100(w));
    setMode(next);
  };

  const handlePreset = (p: Preset) => {
    logEvent('preset_click', { preset: p.id });
    setWeights({ ...p.weights });
  };

  const handleDragStart = (key: AttributeKey) => {
    setDragging(true);
    logEvent('drag_start', { key });
  };

  const animatedClassSize = Math.round(useAnimatedNumber(result.classSize));

  // In manual mode the total can drift off 100; while it has, the rubric isn't "valid" yet,
  // so we dim the outcome as a soft signal (auto mode always sums to 100, so it's never dimmed).
  const total = sum(weights);
  const invalid = mode === 'manual' && total !== 100;
  // You can only commit a rubric that spends exactly the 100-point budget.
  const canFinalize = total === 100;

  const handleFinalize = () => {
    logEvent('finalize', { weights, mode, total });
    // The commit moment: persist the final rubric + the full interaction log (#8).
    void saveResponse({
      weights,
      mode,
      total,
      outcome: {
        breakdown: result.breakdown,
        firstGenPct: result.firstGenPct,
        avgTestScore: result.avgTestScore,
      },
    });
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
                  onClick={() => handlePreset(p)}
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
          showFinalize={false}
          onFinalize={handleFinalize}
          onChange={handleChange}
          onDragStart={handleDragStart}
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

          {config.ui.showPoolBar && (
            <div className="results__compare">
              <h3 className="results__subhead">Who applied vs. who got in</h3>
              <CompareBars pool={result.poolBreakdown} admitted={result.breakdown} />
            </div>
          )}
        </section>
      </main>

      <section className="panel step3">
        <header className="panel__head">
          <div>
            <p className="panel__kicker">Step 03</p>
            <h2 className="panel__title">Finalize your rubric</h2>
          </div>
          <div className={`budget ${canFinalize ? '' : 'budget--invalid'}`}>
            <span className="budget__num">{total}</span>
            <span className="budget__den">/ 100 pts</span>
          </div>
        </header>
        <div className="step3__action">
          {finalized ? (
            <span className="rubric__status">✓ Rubric finalized</span>
          ) : (
            <button className="btn btn--primary" disabled={!canFinalize} onClick={handleFinalize}>
              {canFinalize ? 'Finalize rubric' : 'Balance to 100 to finalize'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
