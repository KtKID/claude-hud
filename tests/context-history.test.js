import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordContextSample, getContextHistory } from '../dist/context-history.js';

async function createTempHome() {
  return await mkdtemp(path.join(tmpdir(), 'claude-hud-history-'));
}

async function makeTranscript(homeDir, name = 'session.jsonl') {
  const transcriptPath = path.join(homeDir, name);
  await writeFile(transcriptPath, '', 'utf8');
  return transcriptPath;
}

function makeSample(timestamp, percent, totalInputTokens = 1000) {
  return { timestamp, percent, totalInputTokens };
}

test('recordContextSample returns single sample when no transcript_path', () => {
  const sample = makeSample(1000, 25);
  const result = recordContextSample({}, sample, undefined);
  assert.deepEqual(result, [sample]);
});

test('recordContextSample persists samples across calls', async () => {
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const deps = { homeDir: () => tempHome, now: () => 5000 };

    const first = recordContextSample(stdin, makeSample(1000, 10), undefined, deps);
    assert.equal(first.length, 1);

    const second = recordContextSample(stdin, makeSample(2000, 15), undefined, deps);
    assert.equal(second.length, 2);
    assert.equal(second[0].percent, 10);
    assert.equal(second[1].percent, 15);

    const persisted = getContextHistory(stdin, deps);
    assert.equal(persisted.length, 2);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('recordContextSample caps window at 10 samples', async () => {
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const deps = { homeDir: () => tempHome, now: () => 100_000 };

    let result;
    for (let i = 0; i < 15; i += 1) {
      result = recordContextSample(stdin, makeSample(i * 1000, i), undefined, deps);
    }
    assert.equal(result.length, 10);
    // Oldest 5 dropped: surviving entries start at percent=5
    assert.equal(result[0].percent, 5);
    assert.equal(result[9].percent, 14);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('recordContextSample resets window after long idle gap', async () => {
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const baseDeps = { homeDir: () => tempHome };

    // Seed with 3 samples one second apart
    recordContextSample(stdin, makeSample(1000, 10), undefined, { ...baseDeps, now: () => 1000 });
    recordContextSample(stdin, makeSample(2000, 12), undefined, { ...baseDeps, now: () => 2000 });
    recordContextSample(stdin, makeSample(3000, 14), undefined, { ...baseDeps, now: () => 3000 });

    // Add a sample 10 minutes later — exceeds IDLE_RESET_MS (5 min)
    const after = recordContextSample(
      stdin,
      makeSample(3000 + 10 * 60_000, 16),
      undefined,
      { ...baseDeps, now: () => 3000 + 10 * 60_000 },
    );
    assert.equal(after.length, 1);
    assert.equal(after[0].percent, 16);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('recordContextSample drops samples taken before compact boundary', async () => {
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const deps = { homeDir: () => tempHome, now: () => 100_000 };

    recordContextSample(stdin, makeSample(1000, 80), undefined, deps);
    recordContextSample(stdin, makeSample(2000, 85), undefined, deps);

    // Compact happened between sample 2 and sample 3 (boundary at t=2500)
    const compactBoundary = new Date(2500);
    const result = recordContextSample(
      stdin,
      makeSample(3000, 5),
      compactBoundary,
      deps,
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].percent, 5);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('recordContextSample rejects samples with non-monotonic timestamps', async () => {
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const deps = { homeDir: () => tempHome, now: () => 100_000 };

    recordContextSample(stdin, makeSample(2000, 10), undefined, deps);
    recordContextSample(stdin, makeSample(3000, 20), undefined, deps);

    // Replay/clock-skew: this sample's timestamp <= last persisted (3000).
    // Should be discarded; the persisted window stays unchanged.
    const after = recordContextSample(stdin, makeSample(2500, 99), undefined, deps);
    assert.equal(after.length, 2);
    assert.equal(after[0].percent, 10);
    assert.equal(after[1].percent, 20);

    // Equal timestamp also rejected.
    const same = recordContextSample(stdin, makeSample(3000, 50), undefined, deps);
    assert.equal(same.length, 2);
    assert.equal(same[1].percent, 20);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('readHistory drops corrupt samples with out-of-range percent', async () => {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const hash = createHash('sha256').update(path.resolve(transcriptPath)).digest('hex');
    const cacheDir = path.join(tempHome, '.claude', 'plugins', 'claude-hud', 'context-history');
    await mkdir(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, `${hash}.json`);
    // Hand-craft a file with mixed valid + invalid samples.
    await writeFile(
      cacheFile,
      JSON.stringify({
        samples: [
          { timestamp: 1000, percent: 10, totalInputTokens: 100 },
          { timestamp: 2000, percent: 200, totalInputTokens: 200 },     // bad: > 100
          { timestamp: 3000, percent: -5, totalInputTokens: 300 },      // bad: < 0
          { timestamp: 4000, percent: 'oops', totalInputTokens: 400 }, // bad: non-numeric
          { timestamp: 5000, percent: 50, totalInputTokens: 500 },
        ],
      }),
      'utf8',
    );
    const result = getContextHistory(stdin, { homeDir: () => tempHome });
    assert.equal(result.length, 2);
    assert.equal(result[0].percent, 10);
    assert.equal(result[1].percent, 50);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('getContextHistory returns empty array when no transcript_path', () => {
  assert.deepEqual(getContextHistory({}), []);
});

test('getContextHistory returns empty array when file does not exist', async () => {
  const tempHome = await createTempHome();
  try {
    const transcriptPath = await makeTranscript(tempHome);
    const stdin = { transcript_path: transcriptPath };
    const result = getContextHistory(stdin, { homeDir: () => tempHome });
    assert.deepEqual(result, []);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
});
