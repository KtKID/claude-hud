import type { ContextEtaPrediction, ContextSample } from './types.js';

/**
 * Minimum samples (history + current) required to extrapolate.
 * Below this threshold the trend is too noisy to report.
 */
const MIN_SAMPLES = 3;

/**
 * If the variance of consecutive deltas exceeds this fraction of the mean
 * delta, downgrade confidence to 'low'. Pure heuristic — picked so that a
 * monotonically-growing window stays 'high' while bursty sessions degrade.
 */
const HIGH_NOISE_RATIO = 0.6;

/**
 * Predict how many minutes remain until context usage hits 100%, based on
 * the most recent samples plus the current observation.
 *
 *  - Returns null if fewer than MIN_SAMPLES total observations.
 *  - Returns null if current usage is already at or above 100%.
 *  - Returns null if the trend is non-positive (usage shrinking or flat).
 *  - confidence:
 *      'high' when the per-step deltas are consistent
 *      'low'  when deltas are noisy (variance > HIGH_NOISE_RATIO * mean)
 */
export function predictContextEta(
  history: ContextSample[],
  current: ContextSample,
): ContextEtaPrediction | null {
  if (current.percent >= 100) return null;

  // Combine the persisted history with the current sample, drop duplicates,
  // and keep them in time order. The current sample is always the freshest.
  const samples = [
    ...history.filter((s) => s.timestamp < current.timestamp),
    current,
  ];

  if (samples.length < MIN_SAMPLES) return null;

  const oldest = samples[0];
  const totalElapsedMs = current.timestamp - oldest.timestamp;
  const totalDeltaPercent = current.percent - oldest.percent;

  if (totalElapsedMs <= 0) return null;
  if (totalDeltaPercent <= 0) return null;

  // Average growth rate across the window: percent points per millisecond.
  const ratePerMs = totalDeltaPercent / totalElapsedMs;
  if (!Number.isFinite(ratePerMs) || ratePerMs <= 0) return null;

  const remainingPercent = 100 - current.percent;
  const remainingMs = remainingPercent / ratePerMs;
  const minutesUntilFull = Math.max(0, +(remainingMs / 60000).toFixed(1));

  return {
    minutesUntilFull,
    confidence: judgeConfidence(samples),
  };
}

function judgeConfidence(samples: ContextSample[]): 'high' | 'low' {
  // Need at least two consecutive deltas to assess noise.
  if (samples.length < 3) return 'low';

  const deltas: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].timestamp - samples[i - 1].timestamp;
    if (dt <= 0) return 'low';
    deltas.push((samples[i].percent - samples[i - 1].percent) / dt);
  }

  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (mean <= 0) return 'low';

  const variance =
    deltas.reduce((acc, d) => acc + (d - mean) ** 2, 0) / deltas.length;
  const stddev = Math.sqrt(variance);

  return stddev / mean > HIGH_NOISE_RATIO ? 'low' : 'high';
}
