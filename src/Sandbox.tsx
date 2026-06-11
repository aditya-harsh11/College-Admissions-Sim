import { useEffect, useMemo, useState } from 'react';
import { AllocationPanel } from './components/AllocationPanel';
import { CompareBars } from './components/CompareBars';
import { Donut } from './components/Donut';
import { Legend } from './components/Legend';
import { StatStrip } from './components/StatStrip';
import { useAnimatedNumber } from './hooks/useAnimatedNumber';
import { useRubric } from './hooks/useRubric';
import { logEvent, saveResponse } from './lib/logger';
import { generateApplicantPool } from './sim/generator';
import { runSim } from './sim/scoring';
import type { AttributeKey, SimConfig, Weights } from './sim/types';

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

/** The original single-page sandbox: rubric + live outcome, everything visible. */
export function Sandbox({ config }: { config: SimConfig }) {
  const rubric = useRubric(config);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    logEvent('session_start', {
      flow: 'single',
      startBlank: config.ui.startBlank,
      defaultMode: config.ui.defaultMode,
    });
  }, [config]);

  const pool = useMemo(() => generateApplicantPool(config), [config]);
  const result = useMemo(() => runSim(pool, rubric.weights, config), [pool, rubric.weights, config]);
  const animatedClassSize = Math.round(useAnimatedNumber(result.classSize));

  const invalid = rubric.mode === 'manual' && rubric.total !== 100;
  const canFinalize = rubric.total === 100;

  const handlePreset = (p: Preset) => {
    logEvent('preset_click', { preset: p.id });
    rubric.setAll(p.weights);
  };

  const handleFinalize = () => {
    logEvent('finalize', { weights: rubric.weights, mode: rubric.mode, total: rubric.total });
    void saveResponse({
      weights: rubric.weights,
      mode: rubric.mode,
      total: rubric.total,
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
              className={`modeswitch__opt ${rubric.mode === 'auto' ? 'modeswitch__opt--on' : ''}`}
              onClick={() => rubric.handleModeChange('auto')}
              disabled={finalized}
            >
              Auto-balance
            </button>
            <button
              className={`modeswitch__opt ${rubric.mode === 'manual' ? 'modeswitch__opt--on' : ''}`}
              onClick={() => rubric.handleModeChange('manual')}
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
                  className={`preset ${weightsEqual(rubric.weights, p.weights) ? 'preset--on' : ''}`}
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
          weights={rubric.weights}
          mode={rubric.mode}
          locked={finalized}
          finalized={finalized}
          canFinalize={canFinalize}
          onFinalize={handleFinalize}
          onChange={rubric.handleChange}
          onDragStart={rubric.handleDragStart}
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
              animate={!rubric.dragging}
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
    </div>
  );
}
