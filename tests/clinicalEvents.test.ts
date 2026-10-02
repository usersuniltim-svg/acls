import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicalEvent, clinicalEventToLegacyLog, normalizeCaseClinicalEvents } from '../src/lib/clinicalEvents';
import type { ClinicalEvent, LogEvent } from '../src/types';

test('createClinicalEvent preserves typed payload, timestamp, source, and sequence', () => {
  const event = createClinicalEvent({
    kind: 'SHOCK',
    timestamp: 1000,
    source: 'system',
    actorId: 'user-1',
    payload: { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1 },
    description: 'First shock',
  }, 4);

  assert.equal(event.kind, 'SHOCK');
  assert.deepEqual(event.payload, { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1 });
  assert.equal(event.timestamp, 1000);
  assert.equal(event.sequence, 4);
  assert.equal(event.source, 'system');
  assert.equal(event.actorId, 'user-1');
  assert.equal(event.description, 'First shock');
  assert.match(event.id, /^evt_/);
});

test('structured events normalize by sequence before timestamp', () => {
  const events = [
    createClinicalEvent({ kind: 'CPR_START', timestamp: 3000, payload: { cycleNumber: 2 } }, 2),
    createClinicalEvent({ kind: 'CODE_START', timestamp: 1000, payload: { reason: 'arrest' } }, 1),
  ];

  const normalized = normalizeCaseClinicalEvents(events, undefined);

  assert.deepEqual(normalized.map(e => e.kind), ['CODE_START', 'CPR_START']);
});

test('legacy logs are normalized with explicit safe payload defaults', () => {
  const logs: LogEvent[] = [
    { id: 's1', timestamp: 1000, type: 'SHOCK', description: 'Shock 200J' },
    { id: 'r1', timestamp: 2000, type: 'RHYTHM_CHECK', description: 'VF' },
    { id: 'e1', timestamp: 3000, type: 'DRUG_EPI', description: 'Epinephrine 1mg' },
  ];

  const normalized = normalizeCaseClinicalEvents(undefined, logs);

  assert.equal(normalized[0].kind, 'SHOCK');
  assert.deepEqual(normalized[0].payload, { energyJ: 0, defibType: 'BIPHASIC', shockNumber: 0 });
  assert.equal(normalized[1].kind, 'RHYTHM_CHECK');
  assert.deepEqual(normalized[1].payload, { checkNumber: 2, rhythm: 'UNKNOWN' });
  assert.equal(normalized[2].kind, 'EPINEPHRINE');
  assert.deepEqual(normalized[2].payload, { route: 'IV/IO', doseNumber: 0 });
  assert.ok(normalized.every(e => e.source === 'import'));
});

test('structured events retain compatibility with legacy logs', () => {
  const event = createClinicalEvent({
    kind: 'EPINEPHRINE',
    timestamp: 5000,
    payload: { route: 'IV/IO', doseNumber: 2, doseMg: 1 },
    description: 'Epinephrine 1mg',
  }, 7);

  const legacy = clinicalEventToLegacyLog(event);

  assert.equal(legacy.id, event.id);
  assert.equal(legacy.timestamp, 5000);
  assert.equal(legacy.type, 'DRUG_EPI');
  assert.equal(legacy.description, 'Epinephrine 1mg');
});
