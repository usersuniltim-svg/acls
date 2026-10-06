import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex } from '../src/lib/sha256';
import {
  amendCase,
  amendmentProblem,
  canonicalJson,
  computeCaseHash,
  isSigned,
  isVoided,
  makeAmendment,
  mergeAmendments,
  sealCase,
  verifyCase,
} from '../src/lib/caseIntegrity';
import { visibleCaseList } from '../src/lib/caseStore';
import { createClinicalEvent } from '../src/lib/clinicalEvents';
import type { SavedCase } from '../src/types';

test('SHA-256 matches the standard (NIST vectors and Node crypto)', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const s of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'नमस्ते résumé ❤', 'x'.repeat(5000)]) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s, 'utf8').digest('hex'));
  }
});

test('canonical JSON ignores key order and undefined values', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } }), '{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

function sampleCase(): SavedCase {
  return {
    id: 'case_1',
    patientCode: 'P-1',
    savedAt: 1_700_000_000_000,
    totalDuration: 300,
    cprCycleCount: 2,
    shocksCount: 1,
    epiCount: 1,
    logs: [{ id: 'l1', timestamp: 1, type: 'SHOCK', description: 'Shock' }],
    clinicalEvents: [createClinicalEvent({ kind: 'SHOCK', timestamp: 1, payload: { energyJ: 200, defibType: 'BIPHASIC', shockNumber: 1, arrestEpisodeNumber: 1 } }, 1)],
    certifiedBy: 'Dr A',
    councilRegistration: 'NMC-1',
    signatureDataUrl: 'data:image/png;base64,AAAA',
    userId: 'alice',
  };
}

/** What comes back from Firestore: keys in another order, undefined values gone, metadata added. */
function roundTrip(c: SavedCase): SavedCase {
  const shuffle = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(shuffle);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).reverse().map(([k, x]) => [k, shuffle(x)]));
    }
    return v;
  };
  return { ...(shuffle(c) as SavedCase), updatedAt: 999, storageVersion: 2 } as SavedCase;
}

test('a signed case verifies, also after a trip through the database', () => {
  const sealed = sealCase(sampleCase(), { uid: 'alice' });
  assert.equal(sealed.hashAlgorithm, 'SHA-256');
  assert.equal(sealed.signedByUid, 'alice');
  assert.equal(sealed.signedAt, sealed.savedAt);
  assert.match(sealed.contentHash ?? '', /^[0-9a-f]{64}$/);
  assert.equal(verifyCase(sealed), 'VERIFIED');
  assert.equal(verifyCase(roundTrip(sealed)), 'VERIFIED');
  // Derived values and amendments are not part of the signature.
  assert.equal(verifyCase({ ...sealed, metrics: { shockCount: 9 } as any }), 'VERIFIED');
  assert.equal(verifyCase(amendCase(sealed, makeAmendment('ADDENDUM', 'late note', { uid: 'alice' }))), 'VERIFIED');
});

test('any change to the signed content is detected', () => {
  const sealed = sealCase(sampleCase(), { uid: 'alice' });
  assert.equal(verifyCase({ ...sealed, patientCode: 'P-2' }), 'ALTERED');
  assert.equal(verifyCase({ ...sealed, shocksCount: 2 }), 'ALTERED');
  assert.equal(verifyCase({ ...sealed, certifiedBy: 'Dr B' }), 'ALTERED');
  const events = sealed.clinicalEvents!.map(e => ({ ...e, payload: { ...e.payload, energyJ: 360 } })) as any;
  assert.equal(verifyCase({ ...sealed, clinicalEvents: events }), 'ALTERED');
  assert.equal(verifyCase({ ...sealed, logs: [] }), 'ALTERED');
  assert.equal(verifyCase({ ...sealed, signatureDataUrl: '' }), 'ALTERED');
  assert.notEqual(computeCaseHash({ ...sealed, patientCode: 'P-2' }), sealed.contentHash);
});

test('cases saved before fingerprinting are reported as such, and still count as signed', () => {
  const old = sampleCase();
  assert.equal(verifyCase(old), 'UNSEALED');
  assert.equal(isSigned(old), true);
  assert.equal(isSigned({ ...old, signatureDataUrl: '' }), false);
});

test('amendments: reasons are required, voiding happens once', () => {
  const sealed = sealCase(sampleCase(), { uid: 'alice' });
  assert.match(amendmentProblem(sealed, 'VOID', '  ') ?? '', /reason/);
  assert.match(amendmentProblem(sealed, 'VOID', 'dup') ?? '', /at least 5/);
  assert.match(amendmentProblem(sealed, 'ADDENDUM', '') ?? '', /addendum/i);
  assert.equal(amendmentProblem(sealed, 'VOID', 'Wrong patient selected'), null);
  const voided = amendCase(sealed, makeAmendment('VOID', 'Wrong patient selected', { uid: 'alice', name: 'Dr A' }, 5));
  assert.equal(isVoided(voided), true);
  assert.match(amendmentProblem(voided, 'VOID', 'again please') ?? '', /already been voided/);
  assert.match(amendmentProblem(voided, 'ADDENDUM', 'more') ?? '', /already been voided/);
  const a = voided.amendments![0];
  assert.deepEqual({ at: a.at, by: a.by, byName: a.byName, kind: a.kind, text: a.text }, { at: 5, by: 'alice', byName: 'Dr A', kind: 'VOID', text: 'Wrong patient selected' });
});

test('merging amendments only ever appends to what the server has', () => {
  const a1 = makeAmendment('ADDENDUM', 'one', { uid: 'u' }, 10);
  const a2 = makeAmendment('ADDENDUM', 'two', { uid: 'u' }, 20);
  const a3 = makeAmendment('VOID', 'three', { uid: 'u' }, 15);
  assert.deepEqual(mergeAmendments([a1], [a1, a2]).map(a => a.text), ['one', 'two']);
  // Another device added a2; this device added a3 (earlier): server order kept, a3 after.
  assert.deepEqual(mergeAmendments([a1, a2], [a1, a3]).map(a => a.text), ['one', 'two', 'three']);
  assert.deepEqual(mergeAmendments(undefined, undefined), []);
});

test('the case list shows amendments still waiting to upload on top of the server copy', () => {
  const server = sealCase(sampleCase(), { uid: 'alice' });
  const note = makeAmendment('ADDENDUM', 'late note', { uid: 'alice' }, 50);
  const tampered = { ...amendCase(server, note), patientCode: 'CHANGED ON DEVICE' };
  const [shown] = visibleCaseList([server], [tampered]);
  assert.equal(shown.patientCode, 'P-1', 'signed content always comes from the server');
  assert.deepEqual(shown.amendments?.map(a => a.text), ['late note']);
  assert.equal(shown.syncPending, true);
  const onlyLocal = visibleCaseList([], [{ ...server, id: 'case_2' }]);
  assert.equal(onlyLocal[0].syncPending, true);
});
