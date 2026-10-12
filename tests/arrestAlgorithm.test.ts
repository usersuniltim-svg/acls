/**
 * The flowchart (lib/arrestAlgorithm) against the 2025 AHA Adult Cardiac
 * Arrest Algorithm: the boxes, the branches printed under each box, and the
 * "you are here" step, driven by the same actions the screen uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AclsState, PatientRhythm } from '../src/types';
import { advanceClock } from '../src/lib/codeClock';
import {
  type ActionSpec,
  analyzeRhythmAction,
  applyAction,
  applyRoscAtRhythmCheck,
  cprCycleAction,
  rhythmAction,
  shockAction,
  startCodeAction,
  stopResuscitationAction,
} from '../src/lib/clinicalActions';
import {
  ARREST_BOXES,
  type ArrestBox,
  afterNonShockable,
  afterShock,
  afterShockable,
  algorithmPosition,
  boxSpec,
  rhythmCheckExits,
} from '../src/lib/arrestAlgorithm';

const T0 = 1_000_000_000_000;
const at = (seconds: number) => T0 + seconds * 1000;

function idle(): AclsState {
  return {
    isTimerRunning: false, cprTimeLeft: 120, epiTimeLeft: 180, totalTime: 0, shocksCount: 0, epiCount: 0,
    currentRhythm: 'UNKNOWN', cprCycleCount: 0, logs: [], clinicalEvents: [], showHsAndTs: false,
    activePrompt: null, rhythmCheckTimeLeft: 0, defibType: 'BIPHASIC', selectedEnergy: 200,
  };
}

function act(s: AclsState, seconds: number, spec: ActionSpec | ((prev: AclsState) => ActionSpec)): AclsState {
  const ticked = advanceClock(s, at(seconds));
  const resolved = typeof spec === 'function' ? spec(ticked) : spec;
  const next = applyAction(ticked, resolved, at(seconds));
  assert.notEqual(next, ticked, `action ${resolved.kind} at +${seconds}s was rejected`);
  return next;
}

/** Let the 2-minute cycle run out, then answer the rhythm check. */
function checkAt(s: AclsState, seconds: number, rhythm: PatientRhythm): AclsState {
  const ticked = advanceClock(s, at(seconds));
  assert.equal(ticked.activePrompt, 'RHYTHM_CHECK', `expected a rhythm check at +${seconds}s`);
  assert.equal(algorithmPosition(ticked).atRhythmCheck, true);
  return act(ticked, seconds + 3, rhythmAction(rhythm));
}

const where = (s: AclsState) => algorithmPosition(s).box;

test('the chart has the 12 boxes of the 2025 AHA algorithm with the AHA wording', () => {
  assert.deepEqual(ARREST_BOXES.map(b => b.box), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const text = (b: ArrestBox) => [boxSpec(b).title, ...boxSpec(b).lines].join(' | ');
  assert.match(text(1), /Start CPR/);
  assert.match(text(1), /bag-mask ventilation/);
  assert.match(text(1), /Attach monitor\/defibrillator/);
  assert.equal(boxSpec(3).kind, 'shock');
  assert.equal(boxSpec(5).kind, 'shock');
  assert.equal(boxSpec(7).kind, 'shock');
  assert.match(text(4), /CPR 2 min \| IV\/IO access/);
  assert.match(text(6), /Epinephrine every 3 to 5 min/);
  assert.match(text(6), /Consider advanced airway, capnography/);
  assert.match(text(8), /Amiodarone or lidocaine/);
  assert.match(text(8), /Treat reversible causes/);
  assert.match(text(9), /Asystole\/PEA/);
  assert.match(text(9), /epinephrine as soon as possible/);
  assert.match(text(10), /IV\/IO access/);
  assert.match(text(10), /Epinephrine every 3 to 5 min/);
  assert.match(text(10), /Consider advanced airway, capnography/);
  assert.match(text(11), /Treat reversible causes/);
  assert.match(text(12), /No signs of ROSC: go to 10/);
  assert.match(text(12), /ROSC: post-cardiac arrest care/);
  assert.match(text(12), /continue resuscitation/);
  for (const b of ARREST_BOXES) {
    assert.doesNotMatch([b.title, ...b.lines].join(' '), /intubate/i, `box ${b.box} must say "consider advanced airway", not "intubate"`);
  }
});

test('the branches printed under each box follow the AHA text', () => {
  // "Is rhythm shockable?" after Boxes 1, 4, 6, 8, 10 and 11.
  assert.deepEqual(rhythmCheckExits(1), { shockable: 2, nonShockable: 9 });
  assert.deepEqual(rhythmCheckExits(4), { shockable: 5, nonShockable: 12 });
  assert.deepEqual(rhythmCheckExits(6), { shockable: 7, nonShockable: 12 });
  assert.deepEqual(rhythmCheckExits(8), { shockable: 5, nonShockable: 12 });
  assert.deepEqual(rhythmCheckExits(10), { shockable: 5, nonShockable: 11 });
  assert.deepEqual(rhythmCheckExits(11), { shockable: 5, nonShockable: 12 });
  // Box 12 with no ROSC goes back to Box 10.
  assert.equal(afterNonShockable(11).to, 10);
  assert.deepEqual(afterNonShockable(11).via, [12]);
});

test('every transition lands on a real box, and shocks always lead to the next CPR box', () => {
  const boxes = ARREST_BOXES.map(b => b.box);
  for (const from of boxes) {
    for (const move of [afterShockable(from), afterNonShockable(from), afterShock(from)]) {
      assert.ok(boxes.includes(move.to), `from ${from} to ${move.to}`);
      for (const v of move.via) assert.ok(boxes.includes(v));
    }
    const shocked = afterShock(from);
    assert.ok([4, 6, 8].includes(shocked.to), `a shock from box ${from} leads to a CPR box, got ${shocked.to}`);
    assert.equal(boxSpec(shocked.via[shocked.via.length - 1]).kind, 'shock');
    // The chart's printed branches agree with where the team is then taken.
    if ([4, 6, 8, 10, 11].includes(from)) {
      const exits = rhythmCheckExits(from);
      assert.equal(exits.shockable, afterShockable(from).to);
      const no = afterNonShockable(from);
      assert.equal(exits.nonShockable, no.via[0] ?? no.to);
    }
  }
});

test('before a code there is no current step', () => {
  const p = algorithmPosition(idle());
  assert.equal(p.box, null);
  assert.equal(p.atRhythmCheck, false);
});

test('VF/pVT: the highlighted step walks Boxes 1 to 8 and loops back to 5', () => {
  let s = act(idle(), 0, startCodeAction());
  assert.equal(where(s), 1);
  s = act(s, 30, analyzeRhythmAction());
  assert.equal(algorithmPosition(s).atRhythmCheck, true, 'first rhythm check after Box 1');
  s = act(s, 33, rhythmAction('SHOCKABLE'));
  assert.equal(where(s), 3, 'VF/pVT: shock');
  s = act(s, 35, shockAction());
  assert.equal(where(s), 4);
  assert.equal(algorithmPosition(s).atRhythmCheck, false);

  s = checkAt(s, 155, 'SHOCKABLE');
  assert.equal(where(s), 5);
  s = act(s, 160, shockAction());
  assert.equal(where(s), 6, 'CPR with epinephrine');

  s = checkAt(s, 280, 'SHOCKABLE');
  assert.equal(where(s), 7);
  s = act(s, 285, shockAction());
  assert.equal(where(s), 8, 'CPR with amiodarone or lidocaine');

  s = checkAt(s, 405, 'SHOCKABLE');
  assert.equal(where(s), 5, 'still shockable after Box 8: back to Box 5');
  s = act(s, 410, shockAction());
  assert.equal(where(s), 6);
  assert.deepEqual(algorithmPosition(s).path, [1, 2, 3, 4, 5, 6, 7, 8, 5, 6]);
});

test('VF/pVT that turns into asystole goes through Box 12 to Box 10', () => {
  let s = act(act(idle(), 0, startCodeAction()), 10, analyzeRhythmAction());
  s = act(act(s, 12, rhythmAction('SHOCKABLE')), 14, shockAction());
  s = checkAt(s, 134, 'NON_SHOCKABLE');
  assert.equal(where(s), 10);
  assert.deepEqual(algorithmPosition(s).path, [1, 2, 3, 4, 12, 10]);
});

test('asystole/PEA: Box 9, then 10 and 11 in turn, and back to Box 5 if it becomes shockable', () => {
  let s = act(act(idle(), 0, startCodeAction()), 20, analyzeRhythmAction());
  s = act(s, 23, rhythmAction('NON_SHOCKABLE'));
  assert.equal(where(s), 9, 'asystole/PEA: epinephrine as soon as possible');
  s = act(s, 26, cprCycleAction);
  assert.equal(where(s), 10, 'CPR restarted: Box 10');

  s = checkAt(s, 146, 'NON_SHOCKABLE');
  assert.equal(where(s), 11);
  s = act(s, 150, cprCycleAction);
  assert.equal(where(s), 11);

  s = checkAt(s, 270, 'NON_SHOCKABLE');
  assert.equal(where(s), 10, 'Box 11, not shockable: Box 12, no ROSC: Box 10');
  s = act(s, 274, cprCycleAction);

  s = checkAt(s, 394, 'SHOCKABLE');
  assert.equal(where(s), 5, 'shockable from the nonshockable side: Box 5');
  s = act(s, 398, shockAction());
  assert.equal(where(s), 6);
  assert.deepEqual(algorithmPosition(s).path, [1, 9, 10, 11, 12, 10, 5, 6]);
});

test('ROSC shows post-cardiac arrest care; a re-arrest starts again at Box 1', () => {
  let s = act(act(idle(), 0, startCodeAction()), 10, analyzeRhythmAction());
  s = act(act(s, 12, rhythmAction('SHOCKABLE')), 14, shockAction());
  const atCheck = advanceClock(s, at(134));
  s = applyRoscAtRhythmCheck(atCheck, at(137));
  let p = algorithmPosition(s);
  assert.equal(p.rosc, true);
  assert.equal(p.box, 12);
  assert.equal(p.atRhythmCheck, false);

  s = act(s, 400, cprCycleAction); // re-arrest
  p = algorithmPosition(s);
  assert.equal(p.rosc, false);
  assert.equal(p.box, 1);
  assert.deepEqual(p.path, [1]);
  assert.equal(p.arrestEpisodeNumber, 2);
});

test('stopping resuscitation is shown as stopped', () => {
  let s = act(act(idle(), 0, startCodeAction()), 10, analyzeRhythmAction());
  s = act(s, 12, rhythmAction('NON_SHOCKABLE'));
  s = act(s, 15, cprCycleAction);
  s = act(s, 600, stopResuscitationAction('10:10'));
  const p = algorithmPosition(s);
  assert.equal(p.stopped, true);
  assert.equal(p.atRhythmCheck, false);
});
