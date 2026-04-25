import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import type { ContextSample, StdinData } from './types.js';
import { getHudPluginDir } from './claude-config-dir.js';

/**
 * Persisted rolling window of context-window observations used to predict
 * how soon usage will hit 100%. Per-session storage avoids cross-session
 * pollution, mirroring the speed-tracker / context-cache scheme.
 */

const CACHE_DIRNAME = 'context-history';
const MAX_SAMPLES = 10;

/** Reject samples older than this — they likely came from a previous workday. */
const MAX_SAMPLE_AGE_MS = 30 * 60 * 1000;

/** Suspicious time-jump that signals a sleep/resume — prune older samples. */
const IDLE_RESET_MS = 5 * 60 * 1000;

interface ContextHistoryFile {
  samples: ContextSample[];
}

export type ContextHistoryDeps = {
  homeDir: () => string;
  now: () => number;
};

const defaultDeps: ContextHistoryDeps = {
  homeDir: () => os.homedir(),
  now: () => Date.now(),
};

function getHistoryPath(homeDir: string, transcriptPath: string): string {
  const hash = createHash('sha256').update(path.resolve(transcriptPath)).digest('hex');
  return path.join(getHudPluginDir(homeDir), CACHE_DIRNAME, `${hash}.json`);
}

function readHistory(homeDir: string, transcriptPath: string): ContextSample[] {
  try {
    const filePath = getHistoryPath(homeDir, transcriptPath);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as ContextHistoryFile;
    if (!Array.isArray(parsed.samples)) return [];
    return parsed.samples.filter(isValidSample);
  } catch {
    return [];
  }
}

function isValidSample(value: unknown): value is ContextSample {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ContextSample>;
  return (
    typeof v.timestamp === 'number' &&
    Number.isFinite(v.timestamp) &&
    typeof v.percent === 'number' &&
    Number.isFinite(v.percent) &&
    v.percent >= 0 &&
    v.percent <= 100 &&
    typeof v.totalInputTokens === 'number' &&
    Number.isFinite(v.totalInputTokens)
  );
}

function writeHistory(
  homeDir: string,
  transcriptPath: string,
  samples: ContextSample[],
): void {
  try {
    const filePath = getHistoryPath(homeDir, transcriptPath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: ContextHistoryFile = { samples };
    fs.writeFileSync(filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Ignore cache write failures
  }
}

/**
 * Append `sample` to the persisted window for this session and return the
 * trimmed window (most-recent MAX_SAMPLES, with stale entries pruned).
 *
 * Pruning rules:
 *   - Drop samples older than MAX_SAMPLE_AGE_MS (relative to `now`).
 *   - Drop samples taken BEFORE the latest compact boundary so the
 *     pre-compact tail does not skew the prediction.
 *   - If the gap between the last persisted sample and `sample` exceeds
 *     IDLE_RESET_MS, drop everything before the gap (likely sleep/resume).
 *   - If `sample.timestamp` is not strictly newer than the last persisted
 *     sample (clock skew or replay), discard `sample` and return the
 *     existing window unchanged.
 */
export function recordContextSample(
  stdin: StdinData,
  sample: ContextSample,
  compactBoundaryAt: Date | undefined,
  overrides: Partial<ContextHistoryDeps> = {},
): ContextSample[] {
  const transcriptPath = stdin.transcript_path?.trim();
  if (!transcriptPath) {
    return [sample];
  }
  const deps = { ...defaultDeps, ...overrides };
  const homeDir = deps.homeDir();
  const now = deps.now();

  const previous = readHistory(homeDir, transcriptPath);
  const compactCutoff = compactBoundaryAt ? compactBoundaryAt.getTime() : 0;

  const lastSample = previous[previous.length - 1];

  // Defend against clock skew / replay: a sample whose timestamp is not
  // strictly newer than the most recent persisted one would corrupt the
  // monotonic-time assumption that predictContextEta relies on.
  if (lastSample && sample.timestamp <= lastSample.timestamp) {
    return previous;
  }

  const idleJump =
    lastSample && sample.timestamp - lastSample.timestamp > IDLE_RESET_MS;

  let kept: ContextSample[] = idleJump
    ? []
    : previous.filter(
        (s) =>
          now - s.timestamp <= MAX_SAMPLE_AGE_MS &&
          s.timestamp >= compactCutoff,
      );

  kept.push(sample);
  if (kept.length > MAX_SAMPLES) {
    kept = kept.slice(-MAX_SAMPLES);
  }

  writeHistory(homeDir, transcriptPath, kept);
  return kept;
}

/** Read-only accessor for tests / debugging. */
export function getContextHistory(
  stdin: StdinData,
  overrides: Partial<ContextHistoryDeps> = {},
): ContextSample[] {
  const transcriptPath = stdin.transcript_path?.trim();
  if (!transcriptPath) return [];
  const deps = { ...defaultDeps, ...overrides };
  return readHistory(deps.homeDir(), transcriptPath);
}
