import test from 'node:test';
import assert from 'node:assert/strict';
import { startCode, startCprCycle, deliverShock, confirmRosc } from '../src/lib/codeClock';
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
  const resumed = (await import('../src/lib/codeClock')).advanceClock(atThreeMinutesOfArrest, 251000);
  assert.equal(resumed.epiTimeLeft, 0);
});
