import test from 'node:test';
import assert from 'node:assert/strict';
import { assessEtco2, etco2Context } from '../src/lib/capnography';
import { createClinicalEvent } from '../src/lib/clinicalEvents';
import type { ClinicalEvent } from '../src/types';

const reading = (v: number, t: number, seq: number, episode = 1): ClinicalEvent =>
  createClinicalEvent({ kind: 'ETCO2', timestamp: t, payload: { valueMmHg: v, airway: 'ETT', flags: [], arrestEpisodeNumber: episode } }, seq);

test('EtCO2 of 10 or more during CPR raises no flag', () => {
  assert.deepEqual(assessEtco2(18, { airway: 'ETT', arrestSeconds: 300 }), []);
  assert.deepEqual(assessEtco2(10, { airway: 'NONE', arrestSeconds: 300 }), []);
});

test('EtCO2 below 10 asks to reassess CPR quality', () => {
  const flags = assessEtco2(8, { airway: 'SGA', arrestSeconds: 300 });
  assert.equal(flags.length, 1);
  assert.match(flags[0], /reassess CPR quality/);
});

test('an abrupt rise of 10 or more suggests possible ROSC', () => {
  assert.match(assessEtco2(32, { previousMmHg: 15, airway: 'ETT', arrestSeconds: 600 })[0], /rise of 17 .*possible ROSC/);
  assert.deepEqual(assessEtco2(24, { previousMmHg: 15, airway: 'ETT', arrestSeconds: 600 }), []);
});

test('20 min of ALS with an ETT and EtCO2 never above 10: shown as one factor only', () => {
  const flags = assessEtco2(8, { airway: 'ETT', arrestSeconds: 20 * 60, maxSoFarMmHg: 10 });
  assert.equal(flags.length, 2);
  assert.match(flags[1], /one part of a multimodal decision to stop, never on its own/);
});

test('that stop-decision note never appears without an ETT, before 20 min, or if EtCO2 ever exceeded 10', () => {
  const note = /multimodal/;
  assert.ok(!assessEtco2(8, { airway: 'SGA', arrestSeconds: 30 * 60, maxSoFarMmHg: 9 }).some(f => note.test(f)), 'SGA');
  assert.ok(!assessEtco2(8, { airway: 'NONE', arrestSeconds: 30 * 60, maxSoFarMmHg: 9 }).some(f => note.test(f)), 'no airway');
  assert.ok(!assessEtco2(8, { airway: 'ETT', arrestSeconds: 19 * 60, maxSoFarMmHg: 9 }).some(f => note.test(f)), 'before 20 min');
  assert.ok(!assessEtco2(8, { airway: 'ETT', arrestSeconds: 30 * 60, maxSoFarMmHg: 14 }).some(f => note.test(f)), 'earlier reading > 10');
});

test('context is isolated to the current arrest episode', () => {
  const events = [reading(22, 1000, 1, 1), reading(9, 2000, 2, 1), reading(12, 9000, 3, 2)];
  const ep2 = etco2Context(events, 2, 'ETT', 100);
  assert.equal(ep2.previousMmHg, 12);
  assert.equal(ep2.maxSoFarMmHg, 12);
  const ep3 = etco2Context(events, 3, 'ETT', 100);
  assert.equal(ep3.previousMmHg, null);
  assert.equal(ep3.maxSoFarMmHg, null);
});
