import test from 'node:test';
import assert from 'node:assert/strict';
import { causeStatusesForEpisode, causeSummaryByEpisode, causeLabel } from '../src/lib/reversibleCauses';
import { createClinicalEvent } from '../src/lib/clinicalEvents';
import type { ClinicalEvent, ReversibleCauseId, ReversibleCauseStatus } from '../src/types';

const cause = (c: ReversibleCauseId, status: ReversibleCauseStatus, t: number, seq: number, episode?: number, note?: string): ClinicalEvent =>
  createClinicalEvent({
    kind: 'REVERSIBLE_CAUSE',
    timestamp: t,
    payload: { cause: c, status, ...(episode ? { arrestEpisodeNumber: episode } : {}), ...(note ? { note } : {}) },
  }, seq);

test('statuses are kept per arrest episode, latest wins', () => {
  const events = [
    cause('HYPOXIA', 'SUSPECTED', 1000, 1, 1),
    cause('HYPOXIA', 'TREATED', 2000, 2, 1, 'intubated'),
    cause('TENSION_PNEUMOTHORAX', 'RULED_OUT', 3000, 3, 1),
    cause('HYPOXIA', 'RULED_OUT', 9000, 4, 2),
  ];
  const ep1 = causeStatusesForEpisode(events, 1);
  assert.equal(ep1.get('HYPOXIA')?.status, 'TREATED');
  assert.equal(ep1.get('HYPOXIA')?.note, 'intubated');
  assert.equal(ep1.get('TENSION_PNEUMOTHORAX')?.status, 'RULED_OUT');

  const ep2 = causeStatusesForEpisode(events, 2);
  assert.equal(ep2.size, 1);
  assert.equal(ep2.get('HYPOXIA')?.status, 'RULED_OUT');
});

test('assessments without an episode number count as episode 1', () => {
  const events = [cause('TOXINS', 'SUSPECTED', 1000, 1)];
  assert.equal(causeStatusesForEpisode(events, 1).get('TOXINS')?.status, 'SUSPECTED');
});

test('summary lists episodes in order, causes in standard H then T order', () => {
  const events = [
    cause('TOXINS', 'SUSPECTED', 1000, 1, 1),
    cause('HYPOVOLEMIA', 'TREATED', 1100, 2, 1),
    cause('POTASSIUM', 'TREATED', 5000, 3, 2, 'calcium gluconate'),
  ];
  const summary = causeSummaryByEpisode(events);
  assert.deepEqual(summary.map(s => `${s.arrestEpisodeNumber}:${s.cause}:${s.status}`), [
    '1:HYPOVOLEMIA:TREATED', '1:TOXINS:SUSPECTED', '2:POTASSIUM:TREATED',
  ]);
  assert.equal(causeLabel('POTASSIUM'), 'Hypo-/Hyperkalemia');
});
