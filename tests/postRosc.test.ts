import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessPostRoscVitals,
  completeVitals,
  meanArterialPressure,
  postRoscChecklist,
  POST_ROSC_ITEMS,
} from '../src/lib/postRosc';
import { createClinicalEvent } from '../src/lib/clinicalEvents';
import type { ClinicalEvent, PostRoscItemId } from '../src/types';

const check = (item: PostRoscItemId, t: number, seq: number, done = true, result?: string): ClinicalEvent =>
  createClinicalEvent({ kind: 'POST_ROSC_CHECK', timestamp: t, payload: { item, done, ...(result ? { result } : {}) } }, seq);

test('MAP is (SBP + 2 x DBP) / 3', () => {
  assert.equal(meanArterialPressure(120, 60), 80);
  assert.equal(meanArterialPressure(90, 50), 63);
});

test('MAP is calculated from SBP/DBP only when it was not entered', () => {
  assert.deepEqual(completeVitals({ sbp: 90, dbp: 50 }), { sbp: 90, dbp: 50, map: 63, mapIsCalculated: true });
  assert.deepEqual(completeVitals({ sbp: 90, dbp: 50, map: 70 }), { sbp: 90, dbp: 50, map: 70 });
});

test('vitals inside every 2025 AHA target raise no flags', () => {
  assert.deepEqual(assessPostRoscVitals({ map: 75, spo2: 95, paco2: 40, tempC: 36.5, glucoseMgDl: 140, hr: 90 }), []);
  // boundaries are inside the targets
  assert.deepEqual(assessPostRoscVitals({ map: 65, spo2: 90, paco2: 35, tempC: 37.5, glucoseMgDl: 70 }), []);
  assert.deepEqual(assessPostRoscVitals({ spo2: 98, paco2: 45, tempC: 32 }), []);
});

test('each value outside the 2025 AHA targets is flagged in plain language', () => {
  const flags = assessPostRoscVitals({ sbp: 80, dbp: 50, spo2: 88, paco2: 50, tempC: 38.2, glucoseMgDl: 60 });
  assert.equal(flags.length, 5);
  assert.match(flags[0], /MAP 60 mm Hg is below the 65/);
  assert.match(flags[1], /SpO2 88% is below/);
  assert.match(flags[2], /PaCO2 50/);
  assert.match(flags[3], /above 37.5/);
  assert.match(flags[4], /Glucose 60/);

  assert.match(assessPostRoscVitals({ spo2: 100 })[0], /above the 90-98% target/);
  assert.match(assessPostRoscVitals({ tempC: 31 })[0], /below 32/);
});

test('checklist reflects the latest entry per item since ROSC', () => {
  const events = [
    check('AIRWAY', 500, 1),                 // before ROSC: ignored
    check('ECG_12_LEAD', 1100, 2, true, 'NO_STEMI'),
    check('ECG_12_LEAD', 1200, 3, true, 'STEMI'),   // changed answer
    check('MAP', 1300, 4),
    check('MAP', 1400, 5, false),            // undone
  ];
  const state = postRoscChecklist(events, 1000);
  assert.equal(state.AIRWAY, undefined);
  assert.deepEqual(state.ECG_12_LEAD, { done: true, at: 1200, result: 'STEMI' });
  assert.deepEqual(state.MAP, { done: false, at: 1400 });
});

test('checklist covers the 2025 AHA post-arrest algorithm boxes', () => {
  const ids = POST_ROSC_ITEMS.map(i => i.id);
  for (const id of ['AIRWAY', 'OXYGENATION', 'VENTILATION', 'MAP', 'ECG_12_LEAD', 'FOLLOWS_COMMANDS', 'TEMPERATURE_CONTROL', 'EEG'] as const) {
    assert.ok(ids.includes(id), id);
  }
});

test('glucose above 180 mg/dL is flagged (2025 AHA: avoid hyperglycemia > 180)', () => {
  assert.deepEqual(assessPostRoscVitals({ glucoseMgDl: 180 }), [], '180 is inside the target');
  const flags = assessPostRoscVitals({ glucoseMgDl: 240 });
  assert.equal(flags.length, 1);
  assert.match(flags[0], /Glucose 240 mg\/dL is above 180 mg\/dL/);
  assert.match(POST_ROSC_ITEMS.find(i => i.id === 'GLUCOSE')!.detail, /< 70 mg\/dL.*> 180 mg\/dL/);
});

test('post-ROSC items carry the 2025 AHA wording for angiography and prognostication', () => {
  const item = (id: PostRoscItemId) => POST_ROSC_ITEMS.find(i => i.id === id)!;
  assert.match(item('ECG_12_LEAD').detail, /Persistent ST elevation: emergent coronary angiography, even if comatose/);
  const prognosis = item('PROGNOSTICATION');
  assert.equal(prognosis.phase, 'Not following commands');
  assert.match(prognosis.label, /72 h/);
  assert.match(prognosis.detail, /Multimodal/);
  assert.match(prognosis.detail, /72 h after normothermia/);
  assert.match(item('TEMPERATURE_CONTROL').label, /32-37.5/);
  assert.match(item('TEMPERATURE_CONTROL').detail, /at least 36 hours/);
  assert.match(item('OXYGENATION').label, /90-98%/);
  assert.match(item('MAP').label, /65/);
  assert.ok(!POST_ROSC_ITEMS.some(i => /systolic|SBP/i.test(`${i.label} ${i.detail}`)), 'no systolic target in 2025');
});
