import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResuscitationMetrics } from '../src/lib/resuscitationMetrics';
import { createClinicalEvent } from '../src/lib/clinicalEvents';
import type { ClinicalEvent, LogEvent } from '../src/types';

function event<K extends ClinicalEvent['kind']>(
  kind: K,
  timestamp: number,
  payload: Extract<ClinicalEvent, { kind: K }>['payload'],
  sequence: number,
) {
  return createClinicalEvent({ kind, timestamp, payload }, sequence);
}

test('metrics derive objective first-event times, counts, and medication intervals', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest' }, 1),
    event('CPR_START', 2000, { cycleNumber: 1 }, 2),
    event('RHYTHM_CHECK', 125000, { checkNumber: 1, rhythm: 'SHOCKABLE', startedAt: 120000 }, 3),
    event('SHOCK', 121000, { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1 }, 4),
    event('EPINEPHRINE', 181000, { route: 'IV/IO', doseNumber: 1, doseMg: 1 }, 5),
    event('RHYTHM_CHECK', 305000, { checkNumber: 2, rhythm: 'NON_SHOCKABLE', startedAt: 300000 }, 6),
    event('AMIODARONE', 302000, { route: 'IV/IO', doseNumber: 1, doseMg: 300, doseLabel: '300 mg' }, 7),
    event('ROSC', 360000, { arrestDurationSeconds: 360, rhythmCheckNumber: 2 }, 8),
  ];

  const metrics = calculateResuscitationMetrics(events, undefined);

  assert.equal(metrics.codeStartAt, 0);
  assert.equal(metrics.firstCprAt, 2000);
  assert.equal(metrics.firstRhythmCheckAt, 120000);
  assert.equal(metrics.firstShockAt, 121000);
  assert.equal(metrics.firstEpinephrineAt, 181000);
  assert.equal(metrics.roscAt, 360000);
  assert.equal(metrics.timeToFirstCprSeconds, 2);
  assert.equal(metrics.timeToFirstRhythmCheckSeconds, 120);
  assert.equal(metrics.timeToFirstShockSeconds, 121);
  assert.equal(metrics.timeToFirstEpinephrineSeconds, 181);
  assert.equal(metrics.arrestDurationSeconds, 360);
  assert.equal(metrics.totalArrestDurationSeconds, 360);
  assert.equal(metrics.roscCount, 1);
  assert.equal(metrics.finalRoscAt, 360000);
  assert.deepEqual(metrics.arrestEpisodeDurationsSeconds, [360]);
  assert.equal(metrics.shockCount, 1);
  assert.equal(metrics.epinephrineCount, 1);
  assert.equal(metrics.amiodaroneCount, 1);
  assert.equal(metrics.lidocaineCount, 0);
  assert.equal(metrics.rhythmCheckCount, 2);
  assert.equal(metrics.shockableRhythmChecks, 1);
  assert.equal(metrics.nonShockableRhythmChecks, 1);
  assert.equal(metrics.cprCycleCount, 1);
  assert.deepEqual(metrics.medicationIntervalsSeconds, [121]);
});

test('metrics count pauses and re-arrests from the event timeline', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 10000, { reason: 'arrest' }, 1),
    event('CPR_START', 11000, { cycleNumber: 1 }, 2),
    event('CPR_PAUSE', 60000, { cprCycle: 1, remainingSeconds: 0 }, 3),
    event('ROSC', 61000, { arrestDurationSeconds: 51 }, 4),
    event('RE_ARREST', 120000, { priorArrestSeconds: 59 }, 5),
    event('CPR_START', 121000, { cycleNumber: 2 }, 6),
    event('ROSC', 180000, { arrestDurationSeconds: 59, rhythmCheckNumber: 2 }, 7),
  ];

  const metrics = calculateResuscitationMetrics(events, undefined);

  assert.equal(metrics.cprPauseCount, 1);
  assert.equal(metrics.reArrestCount, 1);
  assert.equal(metrics.cprCycleCount, 2);
  assert.equal(metrics.roscAt, 61000);
  assert.equal(metrics.finalRoscAt, 180000);
  assert.equal(metrics.roscCount, 2);
  assert.deepEqual(metrics.arrestEpisodeDurationsSeconds, [51, 60]);
  assert.equal(metrics.totalArrestDurationSeconds, 111);
  assert.equal(metrics.arrestDurationSeconds, 111);
});

test('legacy logs remain measurable without inventing clinical payload details', () => {
  const logs: LogEvent[] = [
    { id: 'c', timestamp: 1000, type: 'CPR_START', description: 'CPR started' },
    { id: 's', timestamp: 60000, type: 'SHOCK', description: 'Shock administered' },
    { id: 'e', timestamp: 120000, type: 'DRUG_EPI', description: 'Epinephrine administered' },
  ];

  const metrics = calculateResuscitationMetrics(undefined, logs);

  assert.equal(metrics.codeStartAt, null);
  assert.equal(metrics.firstCprAt, 1000);
  assert.equal(metrics.firstShockAt, 60000);
  assert.equal(metrics.firstEpinephrineAt, 120000);
  assert.equal(metrics.shockCount, 1);
  assert.equal(metrics.epinephrineCount, 1);
});
