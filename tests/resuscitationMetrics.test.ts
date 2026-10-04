import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateResuscitationMetrics } from '../src/lib/resuscitationMetrics';
import { createClinicalEvent } from '../src/lib/clinicalEvents';
import type { ClinicalEvent, ClinicalEventPayloadMap, LogEvent } from '../src/types';

function event<K extends ClinicalEvent['kind']>(
  kind: K,
  timestamp: number,
  payload: ClinicalEventPayloadMap[K],
  sequence: number,
) {
  return createClinicalEvent({ kind, timestamp, payload }, sequence);
}

test('metrics derive objective first-event times, counts, and medication intervals', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest' }, 1),
    event('CPR_START', 2000, { cycleNumber: 1 }, 2),
    event('RHYTHM_CHECK', 125000, { checkNumber: 1, rhythm: 'SHOCKABLE', startedAt: 120000 }, 3),
    event('SHOCK', 121000, { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1, cprCycleNumber: 2 }, 4),
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
  assert.equal(metrics.cprCycleCount, 2);
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


test('CPR cycles started implicitly by re-arrest are represented in metrics', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest' }, 1),
    event('CPR_START', 1000, { cycleNumber: 1 }, 2),
    event('ROSC', 120000, { arrestDurationSeconds: 120 }, 3),
    event('RE_ARREST', 180000, { priorArrestSeconds: 120, cprCycleNumber: 2 }, 4),
    event('ROSC', 300000, { arrestDurationSeconds: 120 }, 5),
  ];
  const metrics = calculateResuscitationMetrics(events, undefined);
  assert.equal(metrics.cprCycleCount, 2);
  assert.equal(metrics.reArrestCount, 1);
  assert.deepEqual(metrics.arrestEpisodeDurationsSeconds, [120, 120]);
});

test('a code stopped without ROSC is measured to the time of death', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest' }, 1),
    event('CPR_START', 1000, { cycleNumber: 1 }, 2),
    event('EPINEPHRINE', 30000, { route: 'IV/IO', doseNumber: 1, doseMg: 1 }, 3),
    event('CODE_END', 1500000, { outcome: 'TERMINATED', timeOfDeath: 1500000, arrestDurationSeconds: 1500 }, 4),
  ];

  const metrics = calculateResuscitationMetrics(events, undefined);

  assert.equal(metrics.outcome, 'TERMINATED');
  assert.equal(metrics.codeEndAt, 1500000);
  assert.deepEqual(metrics.arrestEpisodeDurationsSeconds, [1500]);
  assert.equal(metrics.totalArrestDurationSeconds, 1500);
  assert.equal(metrics.roscCount, 0);
});

test('outcome follows the last episode: ROSC, then re-arrest, then stopped', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest' }, 1),
    event('ROSC', 60000, { arrestDurationSeconds: 60 }, 2),
    event('RE_ARREST', 120000, { priorArrestSeconds: 60 }, 3),
    event('CODE_END', 300000, { outcome: 'TERMINATED', timeOfDeath: 300000, arrestDurationSeconds: 240 }, 4),
  ];
  const stopped = calculateResuscitationMetrics(events, undefined);
  assert.equal(stopped.outcome, 'TERMINATED');
  assert.deepEqual(stopped.arrestEpisodeDurationsSeconds, [60, 180]);

  const stillInArrest = calculateResuscitationMetrics(events.slice(0, 3), undefined);
  assert.equal(stillInArrest.outcome, 'NOT_DOCUMENTED');

  const rosc = calculateResuscitationMetrics(events.slice(0, 2), undefined);
  assert.equal(rosc.outcome, 'ROSC');
});

test('actions recorded outside the usual AHA sequence are counted', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest' }, 1),
    event('EPINEPHRINE', 10000, { route: 'IV/IO', doseNumber: 1, protocolNote: 'before 2nd shock' }, 2),
    event('SHOCK', 20000, { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1, protocolNote: 'during CPR' }, 3),
    event('EPINEPHRINE', 200000, { route: 'IV/IO', doseNumber: 2 }, 4),
  ];
  assert.equal(calculateResuscitationMetrics(events, undefined).protocolDeviationCount, 2);
});


test('post-ROSC care and reversible causes are summarised', () => {
  const events: ClinicalEvent[] = [
    event('CODE_START', 0, { reason: 'arrest', arrestEpisodeNumber: 1 }, 1),
    event('REVERSIBLE_CAUSE', 30000, { cause: 'HYPOXIA', status: 'SUSPECTED', arrestEpisodeNumber: 1 }, 2),
    event('REVERSIBLE_CAUSE', 60000, { cause: 'HYPOXIA', status: 'TREATED', note: 'intubated', arrestEpisodeNumber: 1 }, 3),
    event('ROSC', 300000, { arrestDurationSeconds: 300, arrestEpisodeNumber: 1 }, 4),
    event('POST_ROSC_CHECK', 420000, { item: 'ECG_12_LEAD', done: true, result: 'STEMI', arrestEpisodeNumber: 1 }, 5),
    event('POST_ROSC_CHECK', 450000, { item: 'MAP', done: true, arrestEpisodeNumber: 1 }, 6),
    event('VITALS', 460000, { phase: 'POST_ROSC', map: 58, spo2: 96, flags: ['MAP 58 mm Hg is below the 65 mm Hg target'], arrestEpisodeNumber: 1 }, 7),
    event('VITALS', 900000, { phase: 'POST_ROSC', map: 72, spo2: 95, flags: [], arrestEpisodeNumber: 1 }, 8),
    event('DISPOSITION', 1200000, { destination: 'CATH_LAB', roscDurationSeconds: 900, arrestEpisodeNumber: 1 }, 9),
  ];
  const m = calculateResuscitationMetrics(events, undefined);

  assert.deepEqual(m.reversibleCauses?.map(c => `${c.arrestEpisodeNumber}:${c.cause}:${c.status}`), ['1:HYPOXIA:TREATED']);
  assert.deepEqual([...(m.postRoscChecklistDone ?? [])].sort(), ['ECG_12_LEAD', 'MAP']);
  assert.equal(m.timeFromRoscTo12LeadSeconds, 120);
  assert.equal(m.postRoscVitalsCount, 2);
  assert.equal(m.postRoscVitalsOutsideTargetCount, 1);
  assert.equal(m.disposition, 'CATH_LAB');
  assert.equal(m.dispositionAt, 1200000);
  assert.equal(m.outcome, 'ROSC');
});
