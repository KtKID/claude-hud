import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictContextEta } from '../dist/context-eta.js';

function sample(timestamp, percent, totalInputTokens = 1000) {
  return { timestamp, percent, totalInputTokens };
}

test('predictContextEta returns null when usage is already at 100%', () => {
  const history = [sample(0, 90), sample(60_000, 95)];
  const current = sample(120_000, 100);
  assert.equal(predictContextEta(history, current), null);
});

test('predictContextEta returns null when usage is above 100%', () => {
  const history = [sample(0, 90), sample(60_000, 95)];
  const current = sample(120_000, 101);
  assert.equal(predictContextEta(history, current), null);
});

test('predictContextEta returns null with fewer than 3 total samples', () => {
  // Only 2 samples in total (1 history + 1 current)
  const history = [sample(0, 10)];
  const current = sample(60_000, 20);
  assert.equal(predictContextEta(history, current), null);
});

test('predictContextEta returns null when growth is non-positive', () => {
  // Usage shrinking over time
  const history = [sample(0, 50), sample(60_000, 45)];
  const current = sample(120_000, 40);
  assert.equal(predictContextEta(history, current), null);
});

test('predictContextEta returns null when usage is flat', () => {
  const history = [sample(0, 50), sample(60_000, 50)];
  const current = sample(120_000, 50);
  assert.equal(predictContextEta(history, current), null);
});

test('predictContextEta extrapolates linear growth correctly', () => {
  // 10% growth over 60 seconds = 1% per 6 seconds
  // Current 30%, so 70% remaining => 70 * 6 = 420 seconds = 7 minutes
  const history = [sample(0, 10), sample(60_000, 20)];
  const current = sample(120_000, 30);
  const eta = predictContextEta(history, current);
  assert.ok(eta, 'expected non-null prediction');
  assert.equal(eta.minutesUntilFull, 7);
});

test('predictContextEta marks low confidence when deltas are noisy', () => {
  // Bursty growth: jumps then plateau then jumps. Stddev / mean is high.
  const history = [
    sample(0, 10),
    sample(10_000, 30), // big jump
    sample(20_000, 31), // tiny growth
    sample(30_000, 50), // big jump
  ];
  const current = sample(40_000, 51); // tiny growth
  const eta = predictContextEta(history, current);
  assert.ok(eta);
  assert.equal(eta.confidence, 'low');
});

test('predictContextEta marks high confidence on steady growth', () => {
  // Consistent 10% per 10s growth
  const history = [
    sample(0, 10),
    sample(10_000, 20),
    sample(20_000, 30),
    sample(30_000, 40),
  ];
  const current = sample(40_000, 50);
  const eta = predictContextEta(history, current);
  assert.ok(eta);
  assert.equal(eta.confidence, 'high');
});

test('predictContextEta excludes future samples from history', () => {
  // History contains a sample later than current — should be ignored.
  // After exclusion: only [start, mid] history + current at 30s.
  const history = [sample(0, 10), sample(15_000, 20), sample(60_000, 99)];
  const current = sample(30_000, 30);
  const eta = predictContextEta(history, current);
  assert.ok(eta);
  // Growth: 10 -> 30 over 30s; 70% left at that rate => 105 seconds = 1.75 min
  assert.equal(eta.minutesUntilFull, 1.8);
});

test('predictContextEta returns minutesUntilFull rounded to one decimal', () => {
  // Rate yields exactly 5.7 minutes
  const history = [sample(0, 0), sample(60_000, 10)];
  const current = sample(120_000, 20);
  const eta = predictContextEta(history, current);
  assert.ok(eta);
  // 80% remaining at 10%/60s => 80 / (10/60000) = 480000ms = 8 minutes
  assert.equal(eta.minutesUntilFull, 8);
});
