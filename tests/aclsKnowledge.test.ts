/**
 * The AI copilot's built-in notes and role instructions against the 2025 AHA
 * Guidelines: no outdated 2020 values, the 2025 numbers present, and honest
 * sources (app notes based on named AHA pages, never presented as AHA text).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACLS_RAG_KNOWLEDGE_BASE, AHA_REFERENCES, offlineNotesText, referenceLines } from '../src/lib/aclsRagKnowledge';
import { COPILOT_ROLE_INSTRUCTIONS } from '../src/lib/copilotRoles';

const chunk = (id: string) => {
  const c = ACLS_RAG_KNOWLEDGE_BASE.find(k => k.id === id);
  assert.ok(c, id);
  return c!;
};
const allNotes = ACLS_RAG_KNOWLEDGE_BASE.map(c => `${c.summary}\n${c.protocolContent}`).join('\n');
const allRoles = Object.values(COPILOT_ROLE_INSTRUCTIONS).join('\n');

test('no outdated (2020) or non-AHA values remain in the notes or the AI instructions', () => {
  const outdated: [RegExp, string][] = [
    [/92\s*%?\s*(-|to)\s*98/, 'SpO2 92-98% (2025: 90-98%)'],
    [/systolic\s*(BP|blood pressure)?\s*>\s*90/i, 'systolic BP > 90 target (removed in 2025)'],
    [/32\s*°?C?\s*(and|-|to)\s*36\s*°?C/, 'temperature 32-36 °C (2025: 32-37.5 °C)'],
    [/at least 24 hours/i, 'temperature control 24 h (2025: at least 36 h)'],
    [/\d{3}J\b/, 'a fixed joule value written as "200J"'],
    [/adult maximum of 200/i, 'pediatric "adult maximum of 200 J"'],
    [/50\s*-\s*100\s*J/, 'cardioversion 50-100 J (2025: narrow 100 J, flutter 200 J)'],
    [/120\s*-\s*200\s*J\s*Biphasic/i, 'AF cardioversion 120-200 J (2025: 200 J)'],
    [/may repeat up to 2 times/i, 'pediatric amiodarone repeat (2025: up to 3 doses, later doses max 150 mg)'],
    [/3 mg\/kg/, 'lidocaine 3 mg/kg cap (not in the 2025 algorithm)'],
    [/limit defib/i, 'hypothermia "limit defib/epi" stated as AHA'],
    [/\bhyperventilation\s*\(/i, 'hyperventilation recommended for acidosis'],
    [/post-arrest\.?\s*$/m, 'prognostication timed from the arrest instead of normothermia'],
    [/SBP\s*<\s*90/, 'tachycardia instability defined as SBP < 90 (AHA says hypotension)'],
  ];
  for (const [re, what] of outdated) {
    assert.doesNotMatch(allNotes, re, `notes: ${what}`);
    assert.doesNotMatch(allRoles, re, `AI instructions: ${what}`);
  }
  assert.doesNotMatch(allNotes, /hyperventilat/i, 'the notes never recommend hyperventilation');
});

test('post-ROSC notes carry the 2025 targets', () => {
  const t = chunk('rag-post-rosc-care').protocolContent;
  for (const s of ['SpO2 90 to 98%', 'PaO2 60 to 105', 'PaCO2 35 to 45', 'MAP at least 65', 'removed the old systolic', '32 to 37.5 °C for at least 36 hours', '0.5 °C per hour', 'below 70 mg/dL', 'above 180 mg/dL', '72 hours after normothermia', 'even if the patient is comatose']) {
    assert.ok(t.includes(s), s);
  }
  const role = COPILOT_ROLE_INSTRUCTIONS.post_rosc_care;
  for (const s of ['SpO2 90-98%', 'MAP at least 65', '32-37.5 °C for at least 36 hours', '72 h after normothermia', '> 180 mg/dL', 'persistent ST elevation']) {
    assert.ok(role.includes(s), `post-ROSC AI role: ${s}`);
  }
});

test('pediatric amiodarone: 5 mg/kg (max 300 mg), up to 3 doses, later doses max 150 mg', () => {
  assert.match(chunk('rag-pals-pediatric-resus').protocolContent, /5 mg\/kg IV\/IO bolus \(maximum 300 mg\); may repeat up to 3 doses for refractory VF\/pVT, maximum 150 mg for later doses/);
  assert.match(COPILOT_ROLE_INSTRUCTIONS.pals_pediatric, /max 300 mg\); may repeat up to 3 doses for refractory VF\/pVT, max 150 mg for later doses/);
  assert.match(chunk('rag-pals-pediatric-resus').protocolContent, /up to 10 J\/kg or the adult dose/);
});

test('cardioversion energies match the 2025 Electrical Cardioversion Algorithm', () => {
  const t = chunk('rag-tachycardia-algorithm').protocolContent;
  for (const s of ['atrial fibrillation 200 J', 'atrial flutter 200 J', 'narrow-complex tachycardia 100 J', 'monomorphic VT 100 J', 'unsynchronized, high-energy shock']) {
    assert.ok(t.includes(s), s);
  }
  assert.doesNotMatch(t, /sotalol/i, 'sotalol is not in the 2025 tachyarrhythmia algorithm');
});

test('adult VF/pVT shock energy: device dose (e.g. 120 to 200 J), maximum if unknown, monophasic 360 J', () => {
  const t = chunk('rag-vf-pvt-shockable').protocolContent;
  assert.match(t, /for example 120 to 200 J; if unknown, use the maximum available/);
  assert.match(t, /Monophasic: 360 J/);
  assert.match(chunk('rag-vf-pvt-shockable').summary, /120 to 200 J/);
});

test('drug notes say which drugs AHA does not recommend routinely in cardiac arrest', () => {
  const t = chunk('rag-resuscitation-medications-table').protocolContent;
  assert.match(t, /Not recommended routinely in adult cardiac arrest \(2025 AHA\)\*\*: calcium, sodium bicarbonate and magnesium/);
  assert.match(t, /Vasopressin.*no advantage/);
  assert.match(t, /The algorithm gives these two doses/);
});

test('H\'s and T\'s: AHA cautions on calcium and bicarbonate, rewarming alongside resuscitation', () => {
  const t = chunk('rag-hs-and-ts-matrix').protocolContent;
  assert.match(t, /evidence for IV calcium or sodium bicarbonate in hyperkalemic arrest is limited/);
  assert.match(t, /Routine sodium bicarbonate is not recommended \(2025 AHA\)/);
  assert.match(t, /Rewarm alongside resuscitation \(2025 AHA\)/);
  assert.match(t, /European \(ERC\) guidance/);
  assert.match(t, /without overventilating/);
});

test('every note says honestly what it is and links only to real AHA pages', () => {
  const invented = /AHA\/ACC|Neurocritical|ILCOR Pediatric Task Force|Drug Compendium|Resuscitation Standards|Core Guidelines/i;
  for (const c of ACLS_RAG_KNOWLEDGE_BASE) {
    assert.match(c.source, /^App reference notes/, `${c.id}: source must say these are app notes`);
    assert.doesNotMatch(c.source, invented, `${c.id}: no invented guideline names`);
    assert.ok(c.references.length > 0, `${c.id}: names the AHA pages it is based on`);
    for (const r of c.references) {
      assert.match(r.url, /^https:\/\/cpr\.heart\.org\//, `${c.id}: ${r.url}`);
      assert.match(r.title, /^2025 AHA /);
    }
  }
  assert.match(chunk('rag-toxicology-antidotes').source, /not an AHA guideline/);
  for (const r of Object.values(AHA_REFERENCES)) assert.match(r.url, /^https:\/\/cpr\.heart\.org\//);
});

test('offline answers list the AHA pages behind the notes and say they are not AHA text', () => {
  const notes = [chunk('rag-post-rosc-care'), chunk('rag-vf-pvt-shockable')];
  const text = offlineNotesText(notes, 'BODY');
  assert.ok(text.startsWith('BODY'));
  assert.match(text, /Based on:/);
  assert.ok(text.includes(AHA_REFERENCES.postArrest.url));
  assert.ok(text.includes(AHA_REFERENCES.arrestAlgorithm.url));
  assert.match(text, /not a live AI answer and not AHA text/);
  // Each page is listed once even when two notes share it.
  const lines = referenceLines([chunk('rag-vf-pvt-shockable'), chunk('rag-pea-asystole-non-shockable')]).split('\n');
  assert.equal(lines.length, new Set(lines).size);
});
