import { useEffect, useState } from 'react';
import { rebalance } from '../lib/rebalance';
import { logEvent } from '../lib/logger';
import type { AttributeKey, SimConfig, Weights } from '../sim/types';

export type SliderMode = 'auto' | 'manual';

const clampPts = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const sumWeights = (w: Weights) =>
  (Object.keys(w) as AttributeKey[]).reduce((s, k) => s + w[k], 0);

export function defaultWeights(config: SimConfig): Weights {
  return config.criteria.reduce((acc, c) => {
    acc[c.key] = config.ui.startBlank ? 0 : c.defaultWeight;
    return acc;
  }, {} as Weights);
}

/** Bring an off-100 allocation back to exactly 100, reusing the auto-balance math. */
export function normalizeTo100(w: Weights): Weights {
  const keys = Object.keys(w) as AttributeKey[];
  const total = keys.reduce((s, k) => s + w[k], 0);
  if (total === 100) return w;
  const maxKey = keys.reduce((a, b) => (w[a] >= w[b] ? a : b));
  return rebalance(w, maxKey, w[maxKey]);
}

/**
 * Encapsulates the rubric's slider behavior + interaction logging so the single-page sandbox
 * and the multi-step study flow share identical mechanics. `phase` tags log events (e.g. "pre"
 * / "post") so a study response can distinguish the two rubric passes.
 */
export function useRubric(config: SimConfig, phase = 'rubric') {
  const [weights, setWeights] = useState<Weights>(() => defaultWeights(config));
  const [mode, setMode] = useState<SliderMode>(config.ui.defaultMode);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      setDragging(false);
      logEvent('drag_end', { phase });
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [dragging, phase]);

  const handleChange = (key: AttributeKey, value: number) => {
    let next: Weights;
    if (mode === 'auto') {
      next = rebalance(weights, key, value);
    } else {
      const v = clampPts(value);
      const tentativeTotal = sumWeights(weights) - weights[key] + v;
      // Ben's refinement: once the budget is full, extra points crowd the others out.
      next =
        config.ui.crowdOutAt100 && tentativeTotal > 100
          ? rebalance(weights, key, v)
          : { ...weights, [key]: v };
    }
    logEvent('weight_change', {
      phase,
      key,
      from: weights[key],
      to: next[key],
      mode,
      total: sumWeights(next),
    });
    setWeights(next);
  };

  const handleModeChange = (next: SliderMode) => {
    logEvent('mode_change', { phase, from: mode, to: next });
    if (next === 'auto') setWeights((w) => normalizeTo100(w));
    setMode(next);
  };

  const handleDragStart = (key: AttributeKey) => {
    setDragging(true);
    logEvent('drag_start', { phase, key });
  };

  const setAll = (w: Weights) => setWeights({ ...w });

  return {
    weights,
    mode,
    dragging,
    total: sumWeights(weights),
    handleChange,
    handleModeChange,
    handleDragStart,
    setAll,
  };
}
