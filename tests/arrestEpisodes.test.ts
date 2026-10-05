import test from 'node:test';
import assert from 'node:assert/strict';
import { episodeOfEvents, summarizeEpisodes } from '../src/lib/arrestEpisodes';
import { createClinicalEvent, normalizeCaseClinicalEvents } from '../src/lib/clinicalEvents';
import { calculateResuscitationMetrics } from '../src/lib/resuscitationMetrics';
import type { ClinicalEvent, ClinicalEventPayloadMap, LogEvent } from '../src/types';

const s = (n: number) => n * 1000;
let seq = 0;
function ev<K extends ClinicalEvent['kind']>(kind: K, seconds: number, payload: ClinicalEventPayloadMap[K]) {
  return createClinicalEvent({ kind, timestamp: s(seconds), payload }, ++seq);
}

test('episodes are rebuilt from the timeline, with drugs and epinephrine timing per episode', () => {
  seq = 0;
  const events: ClinicalEvent[] = [
    ev('CODE_START', 0, {}),
    ev('SHOCK', 10, { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1 }),
    ev('EPINEPHRINE', 150, { route: 'IV/IO', doseNumber: 1 }),
    ev('EPINEPHRINE', 360, { route: 'IV/IO', doseNumber: 2 }),
    ev('ROSC', 400, { arrestDurationSeconds: 400 }),
    ev('VITALS', 450, { phase: 'POST_ROSC', map: 70, flags: [] }),
    ev('RE_ARREST', 900, { priorArrestSeconds: 400 }),
    ev('EPINEPHRINE', 960, { route: 'IV/IO', doseNumber: 3 }),
    ev('LIDOCAINE', 970, { route: 'IV/IO', doseNumber: 1 }),
    ev('CODE_END', 1500, { outcome: 'TERMINATED', timeOfDeath: s(1500), arrestDurationSeconds: 1000 }),
  ];
  const episodes = summarizeEpisodes(events);
  assert.deepEqual(episodes.map(e => [e.episode, e.endedBy, e.durationSeconds, e.shocks, e.epinephrineDoses, e.lidocaineDoses]), [
    [1, 'ROSC', 400, 1, 2, 0],
    [2, 'CODE_END', 600, 0, 1, 1],
  ]);
  assert.deepEqual(episodes[0].epinephrineIntervalsSeconds, [210]);
  assert.equal(episodes[1].firstEpinephrineAfterSeconds, 60);

  // Post-ROSC vitals belong to the episode that just ended.
  const byId = episodeOfEvents(events);
  assert.deepEqual(events.map(e => byId.get(e.id)), [1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);

  const m = calculateResuscitationMetrics(events, undefined);
  assert.deepEqual(m.epinephrineIntervalsSeconds, [210]);
  assert.deepEqual(m.medicationIntervalsSeconds, [210, 600, 10]);
  assert.equal(m.episodes?.length, 2);
});

test('an episode still in progress has no end', () => {
  seq = 0;
  const episodes = summarizeEpisodes([ev('CODE_START', 0, {}), ev('SHOCK', 30, { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1 })]);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].endAt, null);
  assert.equal(episodes[0].endedBy, null);
  assert.equal(episodes[0].durationSeconds, null);
});

test('IV/IO access is a procedure, timed from the code start', () => {
  seq = 0;
  const m = calculateResuscitationMetrics([
    ev('CODE_START', 0, {}),
    ev('PROCEDURE', 95, { procedure: 'IV_IO_ACCESS' }),
  ], undefined);
  assert.equal(m.timeToVascularAccessSeconds, 95);
});

test('records saved by older versions (logs only) still split into episodes', () => {
  const logs: LogEvent[] = [
    { id: 'a', timestamp: s(0), type: 'CPR_START', description: 'Resuscitation started - Initial 10s Rhythm Assessment evaluation started.' },
    { id: 'b', timestamp: s(20), type: 'SHOCK', description: 'Defibrillation administered: 200J (Shock #1)' },
    { id: 'c', timestamp: s(300), type: 'ROSC', description: 'ROSC achieved after 5:00 of arrest time' },
    { id: 'd', timestamp: s(600), type: 'CPR_START', description: 'Re-arrest after ROSC - CPR restarted (arrest time so far 5:00)' },
    { id: 'e', timestamp: s(620), type: 'DRUG_EPI', description: 'Administered 1mg Epinephrine IV/IO' },
    { id: 'f', timestamp: s(720), type: 'ROSC', description: 'ROSC achieved after 7:00 of arrest time' },
  ];
  const events = normalizeCaseClinicalEvents(undefined, logs);
  assert.deepEqual(events.map(e => e.kind), ['CODE_START', 'SHOCK', 'ROSC', 'RE_ARREST', 'EPINEPHRINE', 'ROSC']);
  const m = calculateResuscitationMetrics(undefined, logs);
  assert.deepEqual(m.arrestEpisodeDurationsSeconds, [300, 120]);
  assert.deepEqual(m.episodes?.map(e => [e.episode, e.shocks, e.epinephrineDoses]), [[1, 1, 0], [2, 0, 1]]);
  assert.equal(m.reArrestCount, 1);
});
