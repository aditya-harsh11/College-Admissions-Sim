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
      testScore: 20,
      communityService: 20,
      extracurriculars: 20,
      leadership: 20,
      lifeExperience: 20,
    },
  },
  {
    id: 'merit',
    label: 'Test-first',
    weights: {
      testScore: 60,
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
      testScore: 10,
      communityService: 25,
      extracurriculars: 10,
      leadership: 20,
      lifeExperience: 35,
    },
  },
];

function weightsEqual(a: Weights, b: Weights): boolean {
  return (Object.keys(a) as AttributeKey[]).every((k) => a[k] === b[k]);
}

export default function App() {
  const [weights, setWeights] = useState<Weights>(defaultWeights);
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
    setWeights((w) => rebalance(w, key, value));

  const animatedClassSize = Math.round(useAnimatedNumber(result.classSize));

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="masthead__title">
          You decide <em>who gets in.</em>
        </h1>

        <div className="presets">
          <span className="presets__label">Try a rubric</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`preset ${weightsEqual(weights, p.weights) ? 'preset--on' : ''}`}
              onClick={() => setWeights({ ...p.weights })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <main className="lab">
        <AllocationPanel
          criteria={config.criteria}
          weights={weights}
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
            <Donut data={result.breakdown} classSize={animatedClassSize} animate={!dragging} />
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
