import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startCode,
  startCprCycle,
  deliverShock,
  confirmRosc,
  advanceClock,
  pauseCpr,
  selectRhythm,
  giveEpinephrine,
  giveAmiodarone,
  giveLidocaine,
  terminateResuscitation,
  isCodeActive,
  checkShock,
  checkEpinephrine,
  checkAntiarrhythmic,
  resumeCpr,
} from '../src/lib/codeClock';
import type { AclsState } from '../src/types';

function baseState(): AclsState {
  return {
    isTimerRunning: true,
    cprTimeLeft: 90,
    epiTimeLeft: 100,
    totalTime: 250,
    shocksCount: 3,
    epiCount: 4,
    currentRhythm: 'SHOCKABLE',
    cprCycleCount: 4,
    logs: [{ id: 'old', timestamp: 1, type: 'SHOCK', description: 'old' }],
    clinicalEvents: [],
    showHsAndTs: true,
    activePrompt: 'EPI_DUE',
    rhythmCheckTimeLeft: 0,
    defibType: 'BIPHASIC',
    selectedEnergy: 200,
    epiDueElapsed: 10,
    codeStartedAt: 1000,
    roscAt: 2000,
    roscPausedMs: 500,
    cprEndsAt: 3000,
    cprRemainingMs: 1000,
    rhythmCheckStartedAt: 1000,
    epiAnchorAt: 1000,
    rhythmCheckCount: 3,
    amioCount: 2,
    lidoCount: 3,
    alert: { seq: 4, kind: 'epi' },
  };
}

test('startCode creates a clean case boundary while preserving device preferences', () => {
  const next = startCode(baseState(), 10000);

  assert.equal(next.codeStartedAt, 10000);
  assert.equal(next.shocksCount, 0);
  assert.equal(next.epiCount, 0);
  assert.equal(next.cprCycleCount, 0);
  assert.equal(next.currentRhythm, 'UNKNOWN');
  assert.deepEqual(next.logs, []);
  assert.deepEqual(next.clinicalEvents, []);
  assert.equal(next.showHsAndTs, false);
  assert.equal(next.amioCount, 0);
  assert.equal(next.lidoCount, 0);
  assert.equal(next.alert, null);
  assert.equal(next.defibType, 'BIPHASIC');
  assert.equal(next.selectedEnergy, 200);
  assert.equal(next.activePrompt, 'RHYTHM_CHECK');
});

test('shock starts the next CPR cycle and increments the state cycle count once', () => {
  const started = selectRhythm(startCode(baseState(), 10000), 'SHOCKABLE', 10001);
  const shock = deliverShock({ ...started, cprCycleCount: 1 }, 20000);

  assert.equal(shock.shocksCount, 1);
  assert.equal(shock.cprCycleCount, 2);
  assert.equal(shock.isTimerRunning, true);
  assert.equal(shock.cprEndsAt, 20000 + 120000);
});

test('ROSC stops the active CPR cycle', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const rosc = confirmRosc(started, 50000);

  assert.equal(rosc.roscAt, 50000);
  assert.equal(rosc.isTimerRunning, false);
  assert.equal(rosc.cprEndsAt, null);
  assert.equal(rosc.activePrompt, null);
});


test('epinephrine interval runs on the real clock through ROSC and re-arrest', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const afterEpi = { ...started, epiAnchorAt: 11000, epiCount: 1 };
  const rosc = confirmRosc(afterEpi, 70000);
  const duringRosc = rosc;
  const atThreeMinutesOfArrest = { ...duringRosc, roscAt: null, roscPausedMs: 120000 };

  assert.equal(duringRosc.epiTimeLeft, 121);
  const resumed = advanceClock(atThreeMinutesOfArrest, 251000);
  assert.equal(resumed.epiTimeLeft, 0);
});


test('CPR deadline is resolved exactly at the timestamp boundary', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const atDeadline = advanceClock(started, 131000);

  assert.equal(atDeadline.activePrompt, 'RHYTHM_CHECK');
  assert.equal(atDeadline.cprEndsAt, null);
  assert.equal(atDeadline.cprRemainingMs, 0);
  assert.equal(atDeadline.isTimerRunning, false);
  assert.equal(atDeadline.rhythmCheckStartedAt, 131000);
});

test('CPR deadline is resolved after background/sleep time is skipped', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const afterSleep = advanceClock(started, 250000);

  assert.equal(afterSleep.activePrompt, 'RHYTHM_CHECK');
  assert.equal(afterSleep.cprEndsAt, null);
  assert.equal(afterSleep.rhythmCheckStartedAt, 131000);
  assert.equal(afterSleep.isTimerRunning, false);
});

test('rhythm-check timeout fires at exactly 10 seconds', () => {
  const started = startCode(baseState(), 10000);
  const timedOut = advanceClock(started, 20000);

  assert.equal(timedOut.activePrompt, 'RHYTHM_CHECK');
  assert.equal(timedOut.rhythmCheckTimeLeft, 0);
  assert.equal(timedOut.alert?.kind, 'urgent');
});

test('epinephrine becomes due exactly at the interval boundary', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const running = { ...started, epiAnchorAt: 1000, cprEndsAt: 500000 };
  const due = advanceClock(running, 181000);

  assert.equal(due.epiTimeLeft, 0);
  assert.equal(due.activePrompt, 'EPI_DUE');
  assert.equal(due.alert?.kind, 'epi');
});

test('pause action at the exact CPR deadline cannot freeze an expired cycle', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const pausedAtDeadline = pauseCpr(started, 131000);

  assert.equal(pausedAtDeadline.activePrompt, 'RHYTHM_CHECK');
  assert.equal(pausedAtDeadline.cprEndsAt, null);
  assert.equal(pausedAtDeadline.cprRemainingMs, 0);
  assert.equal(pausedAtDeadline.isTimerRunning, false);
});


test('CPR cannot implicitly create an arrest episode', () => {
  const idle = { ...baseState(), codeStartedAt: null, roscAt: null };
  const next = startCprCycle(idle, 50000);

  assert.strictEqual(next, idle);
});

test('shock cannot occur without an active shockable arrest', () => {
  const idle = { ...baseState(), codeStartedAt: null, roscAt: null };
  assert.strictEqual(deliverShock(idle, 50000), idle);

  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const nonShockable = selectRhythm(
    startCode(baseState(), 10000),
    'NON_SHOCKABLE',
    10001
  );
  assert.equal(nonShockable.currentRhythm, 'NON_SHOCKABLE');
  assert.strictEqual(deliverShock(nonShockable, 20000), nonShockable);
  assert.equal(started.shocksCount, 0);
});

test('rhythm selection is rejected outside the rhythm-check transition', () => {
  const started = startCprCycle(startCode(baseState(), 10000), 11000);
  const next = selectRhythm(started, 'SHOCKABLE', 20000);

  assert.strictEqual(next, started);
});

test('medication actions cannot create or continue a non-existent arrest', () => {
  const idle = { ...baseState(), codeStartedAt: null, roscAt: null };

  assert.strictEqual(giveEpinephrine(idle, 50000), idle);
  assert.strictEqual(giveAmiodarone(idle), idle);
  assert.strictEqual(giveLidocaine(idle), idle);
});

test('antiarrhythmics are gated until a shockable rhythm has received three shocks', () => {
  let state = selectRhythm(
    startCode(baseState(), 10000),
    'SHOCKABLE',
    10001
  );

  assert.strictEqual(giveAmiodarone(state), state);
  assert.strictEqual(giveLidocaine(state), state);

  state = deliverShock(state, 20000);
  state = selectRhythm(advanceClock(state, 140000), 'SHOCKABLE', 140001);
  state = deliverShock(state, 140002);
  state = selectRhythm(advanceClock(state, 260002), 'SHOCKABLE', 260003);
  state = deliverShock(state, 260004);

  const amio = giveAmiodarone(state);
  const lido = giveLidocaine(state);

  assert.equal(amio.amioCount, 1);
  assert.equal(lido.lidoCount, 1);
});


test('epinephrine rejects an early duplicate administration', () => {
  let state = startCprCycle(startCode(baseState(), 10000), 11000);
  state = selectRhythm(
    startCode(baseState(), 10000),
    'NON_SHOCKABLE',
    10001
  );
  state = giveEpinephrine(state, 10002);

  assert.equal(state.epiCount, 1);
  assert.strictEqual(giveEpinephrine(state, 10003), state);
});

test('shockable epinephrine is not available before two initial shocks', () => {
  let state = selectRhythm(
    startCode(baseState(), 10000),
    'SHOCKABLE',
    10001
  );
  state = startCprCycle(state, 10002);

  assert.strictEqual(giveEpinephrine(state, 20000), state);

  state = selectRhythm(advanceClock(state, 130002), 'SHOCKABLE', 130003);
  state = deliverShock(state, 130004);
  assert.strictEqual(giveEpinephrine(state, 140000), state);

  state = selectRhythm(advanceClock(state, 250004), 'SHOCKABLE', 250005);
  state = deliverShock(state, 250006);
  const epi = giveEpinephrine(state, 250007);

  assert.equal(epi.epiCount, 1);
});


test('starting a new code cannot overwrite an active arrest timeline', () => {
  const started = startCode(baseState(), 10000);
  const next = startCode(started, 20000);

  assert.strictEqual(next, started);
  assert.equal(next.codeStartedAt, 10000);
  assert.equal(next.logs.length, 0);
});


test('lidocaine cannot be administered beyond the second AHA-specified dose', () => {
  let state = selectRhythm(
    startCode(baseState(), 10000),
    'SHOCKABLE',
    10001
  );
  state = deliverShock(state, 20000);
  state = selectRhythm(advanceClock(state, 140000), 'SHOCKABLE', 140001);
  state = deliverShock(state, 140002);
  state = selectRhythm(advanceClock(state, 260002), 'SHOCKABLE', 260003);
  state = deliverShock(state, 260004);

  state = giveLidocaine(state);
  state = giveLidocaine(state);
  assert.equal(state.lidoCount, 2);
  assert.strictEqual(giveLidocaine(state), state);
});


// ---------------------------------------------------------------------------
// Epinephrine timing across ROSC (real clock from the last dose)
// ---------------------------------------------------------------------------

test('after a long ROSC, a re-arrest finds epinephrine already due', () => {
  let state = selectRhythm(startCode(baseState(), 10000), 'NON_SHOCKABLE', 10001);
  state = giveEpinephrine(state, 12000);                 // dose 1 at 12 s
  state = startCprCycle(state, 13000);
  state = confirmRosc(state, 60000);                     // ROSC at 60 s
  state = resumeCpr(state, 60000 + 10 * 60 * 1000);      // re-arrest 10 min later

  assert.equal(isCodeActive(state), true);
  assert.equal(state.epiTimeLeft, 0);
  assert.equal(state.activePrompt, 'EPI_DUE');
  assert.equal(checkEpinephrine(state, 60000 + 10 * 60 * 1000 + 1000).ok, true);
});

test('a brief ROSC does not reset the epinephrine interval', () => {
  let state = selectRhythm(startCode(baseState(), 10000), 'NON_SHOCKABLE', 10001);
  state = giveEpinephrine(state, 12000);
  state = startCprCycle(state, 13000);
  state = confirmRosc(state, 60000);
  state = resumeCpr(state, 90000);                       // 30 s of ROSC

  // 78 s since the dose on the real clock -> 102 s left of the 180 s interval
  assert.equal(state.epiTimeLeft, 102);
});

// ---------------------------------------------------------------------------
// Stopping resuscitation (time of death)
// ---------------------------------------------------------------------------

test('stopping resuscitation closes the code and freezes every timer', () => {
  let state = startCprCycle(startCode(baseState(), 10000), 11000);
  state = terminateResuscitation(state, 10000 + 25 * 60 * 1000);

  assert.equal(state.terminatedAt, 10000 + 25 * 60 * 1000);
  assert.equal(isCodeActive(state), false);
  assert.equal(state.totalTime, 25 * 60);
  assert.equal(state.isTimerRunning, false);
  assert.equal(state.cprEndsAt, null);
  assert.equal(state.cprTimeLeft, 0);
  assert.equal(state.activePrompt, null);

  // Time passing changes nothing.
  assert.strictEqual(advanceClock(state, 10000 + 60 * 60 * 1000), state);
});

test('after stopping, CPR, ROSC and drugs cannot be added to that code', () => {
  const stopped = terminateResuscitation(startCprCycle(startCode(baseState(), 10000), 11000), 300000);

  assert.strictEqual(startCprCycle(stopped, 310000), stopped);
  assert.strictEqual(resumeCpr(stopped, 310000), stopped);
  assert.strictEqual(confirmRosc(stopped, 310000), stopped);
  assert.strictEqual(giveEpinephrine(stopped, 310000, { override: true }), stopped);
  assert.strictEqual(deliverShock(stopped, 310000, { override: true }), stopped);
  assert.equal(checkEpinephrine(stopped, 310000).canRecord, false);
});

test('a new code can start after resuscitation was stopped', () => {
  const stopped = terminateResuscitation(startCode(baseState(), 10000), 300000);
  const next = startCode(stopped, 400000);

  assert.equal(next.codeStartedAt, 400000);
  assert.equal(next.terminatedAt, null);
  assert.equal(isCodeActive(next), true);
  assert.equal(next.savedEventSequence, 0);
});

test('resuscitation cannot be stopped during ROSC or with no code running', () => {
  const rosc = confirmRosc(startCprCycle(startCode(baseState(), 10000), 11000), 60000);
  assert.strictEqual(terminateResuscitation(rosc, 70000), rosc);

  const idle = { ...baseState(), codeStartedAt: null, roscAt: null };
  assert.strictEqual(terminateResuscitation(idle, 70000), idle);
});

// ---------------------------------------------------------------------------
// Out-of-sequence actions: flagged, then recorded when the clinician confirms
// ---------------------------------------------------------------------------

test('early epinephrine is flagged with a reason and recorded only with override', () => {
  let state = selectRhythm(startCode(baseState(), 10000), 'NON_SHOCKABLE', 10001);
  state = giveEpinephrine(state, 10002);

  const check = checkEpinephrine(state, 70002);
  assert.equal(check.ok, false);
  assert.equal(check.canRecord, true);
  assert.match(check.reason ?? '', /1:00 ago/);

  assert.strictEqual(giveEpinephrine(state, 70002), state);
  const recorded = giveEpinephrine(state, 70002, { override: true });
  assert.equal(recorded.epiCount, 2);
  assert.equal(recorded.epiAnchorAt, 70002);
});

test('epinephrine before the 2nd shock in VF is flagged, and recordable', () => {
  const state = selectRhythm(startCode(baseState(), 10000), 'SHOCKABLE', 10001);
  const check = checkEpinephrine(state, 20000);

  assert.equal(check.ok, false);
  assert.match(check.reason ?? '', /2nd shock/);
  assert.equal(giveEpinephrine(state, 20000, { override: true }).epiCount, 1);
});

test('a shock during a running CPR cycle is flagged; when confirmed it starts a fresh cycle', () => {
  const running = startCprCycle(selectRhythm(startCode(baseState(), 10000), 'NON_SHOCKABLE', 10001), 11000);
  const check = checkShock(running, 50000);

  assert.equal(check.ok, false);
  assert.equal(check.canRecord, true);
  assert.strictEqual(deliverShock(running, 50000), running);

  const shocked = deliverShock(running, 50000, { override: true });
  assert.equal(shocked.shocksCount, 1);
  assert.equal(shocked.currentRhythm, 'SHOCKABLE');
  assert.equal(shocked.isTimerRunning, true);
  assert.equal(shocked.cprEndsAt, 50000 + 120000);
  assert.equal(shocked.cprCycleCount, running.cprCycleCount + 1);
});

test('the normal shock after a VF rhythm check is not flagged', () => {
  const state = selectRhythm(startCode(baseState(), 10000), 'SHOCKABLE', 10001);
  assert.equal(checkShock(state, 12000).ok, true);
});

test('antiarrhythmics before the 3rd shock or beyond the maximum are flagged, and recordable', () => {
  let state = selectRhythm(startCode(baseState(), 10000), 'SHOCKABLE', 10001);
  const early = checkAntiarrhythmic(state, 'amiodarone');
  assert.equal(early.ok, false);
  assert.match(early.reason ?? '', /3rd shock/);
  assert.equal(giveAmiodarone(state, { override: true }).amioCount, 1);

  state = { ...state, shocksCount: 3, lidoCount: 2 };
  const beyondMax = checkAntiarrhythmic(state, 'lidocaine');
  assert.equal(beyondMax.ok, false);
  assert.match(beyondMax.reason ?? '', /at most 2 doses/);
  assert.equal(giveLidocaine(state, { override: true }).lidoCount, 3);
});

test('nothing can be recorded against a code that is not running, even with override', () => {
  const idle = { ...baseState(), codeStartedAt: null, roscAt: null };
  assert.equal(checkShock(idle, 1000).canRecord, false);
  assert.equal(checkEpinephrine(idle, 1000).canRecord, false);
  assert.equal(checkAntiarrhythmic(idle, 'amiodarone').canRecord, false);
  assert.strictEqual(giveEpinephrine(idle, 1000, { override: true }), idle);
  assert.strictEqual(giveAmiodarone(idle, { override: true }), idle);

  const rosc = confirmRosc(startCprCycle(startCode(baseState(), 10000), 11000), 60000);
  const inRosc = checkEpinephrine(rosc, 61000);
  assert.equal(inRosc.canRecord, false);
  assert.match(inRosc.reason ?? '', /ROSC/);
});


test('arrest episode increments on re-arrest and rhythm numbering restarts locally', () => {
  let state = startCode(baseState(), 10000);
  assert.equal(state.arrestEpisodeNumber, 1);

  state = selectRhythm(state, 'NON_SHOCKABLE', 10001);
  state = startCprCycle(state, 10002);
  state = confirmRosc(state, 60000);

  state = resumeCpr(state, 120000);

  assert.equal(state.arrestEpisodeNumber, 2);
  assert.equal(state.rhythmCheckCount, 0);

  state = advanceClock(state, 240000);
  assert.equal(state.activePrompt, 'RHYTHM_CHECK');
  state = selectRhythm(state, 'NON_SHOCKABLE', 240001);
  assert.equal(state.rhythmCheckCount, 1);
});

test('a new code resets the arrest episode number to episode 1', () => {
  let state = startCode(baseState(), 10000);
  state = selectRhythm(state, 'NON_SHOCKABLE', 10001);
  state = startCprCycle(state, 10002);
  state = confirmRosc(state, 60000);
  state = resumeCpr(state, 120000);
  assert.equal(state.arrestEpisodeNumber, 2);

  state = terminateResuscitation(state, 250000);
  state = startCode(state, 300000);
  assert.equal(state.arrestEpisodeNumber, 1);
});
