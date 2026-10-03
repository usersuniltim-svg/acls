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
  const started = startCode(baseState(), 10000);
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


test('epinephrine interval pauses during ROSC and resumes after re-arrest', () => {
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
  const idle = baseState();
  const next = startCprCycle({ ...idle, codeStartedAt: null, roscAt: null }, 50000);

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
  let state = startCprCycle(startCode(baseState(), 10000), 11000);
  state = selectRhythm(
    startCode(baseState(), 10000),
    'SHOCKABLE',
    10001
  );
  state = startCprCycle(state, 10002);

  assert.strictEqual(giveAmiodarone(state), state);
  assert.strictEqual(giveLidocaine(state), state);

  state = deliverShock(state, 20000);
  state = deliverShock(state, 140000);
  state = deliverShock(state, 260000);

  const amio = giveAmiodarone(state);
  const lido = giveLidocaine(state);

  assert.equal(amio.amioCount, 1);
  assert.equal(lido.lidoCount, 1);
});
