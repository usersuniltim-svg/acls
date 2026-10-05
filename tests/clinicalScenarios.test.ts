/**
 * Clinical scenarios, run through the same action code the screen uses
 * (lib/clinicalActions), with the state-machine rules (lib/codeInvariants)
 * checked after every step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AclsState, ClinicalEvent, ClinicalEventKind, PatientRhythm } from '../src/types';
import { advanceClock } from '../src/lib/codeClock';
import {
  type ActionSpec,
  airwayAction,
  amiodaroneAction,
  appendRecord,
  applyAction,
  applyRoscAtRhythmCheck,
  codeIsOpen,
  cprCycleAction,
  dispositionAction,
  epinephrineAction,
  lidocaineAction,
  pauseAction,
  resumeAction,
  rhythmAction,
  roscAction,
  shockAction,
  startCodeAction,
  stopResuscitationAction,
} from '../src/lib/clinicalActions';
import { codePhase, stateInvariantViolations } from '../src/lib/codeInvariants';
import { episodeOfEvents, summarizeEpisodes } from '../src/lib/arrestEpisodes';
import { calculateResuscitationMetrics } from '../src/lib/resuscitationMetrics';

const T0 = 1_000_000_000_000; // a non-zero epoch: 0 would read as "no code"
const at = (seconds: number) => T0 + seconds * 1000;
const ACTOR = { actorId: 'doc-1', actorName: 'Dr Test' };

function idle(): AclsState {
  return {
    isTimerRunning: false,
    cprTimeLeft: 120,
    epiTimeLeft: 180,
    totalTime: 0,
    shocksCount: 0,
    epiCount: 0,
    currentRhythm: 'UNKNOWN',
    cprCycleCount: 0,
    logs: [],
    clinicalEvents: [],
    showHsAndTs: false,
    activePrompt: null,
    rhythmCheckTimeLeft: 0,
    defibType: 'BIPHASIC',
    selectedEnergy: 200,
  };
}

/** The screen's one-second tick, then the action. Fails if the action was rejected. */
function act(s: AclsState, seconds: number, spec: ActionSpec | ((prev: AclsState) => ActionSpec)): AclsState {
  const ticked = advanceClock(s, at(seconds));
  const resolved = typeof spec === 'function' ? spec(ticked) : spec;
  const next = applyAction(ticked, resolved, at(seconds), ACTOR);
  assert.notEqual(next, ticked, `action ${resolved.kind} at +${seconds}s was rejected`);
  assertConsistent(next, `${resolved.kind} at +${seconds}s`);
  return next;
}

/** An action that must be refused: nothing changes, nothing is recorded. */
function refused(s: AclsState, seconds: number, spec: ActionSpec): void {
  const ticked = advanceClock(s, at(seconds));
  const next = applyAction(ticked, spec, at(seconds), ACTOR);
  assert.equal(next, ticked, `action ${spec.kind} at +${seconds}s should have been refused`);
}

function tick(s: AclsState, seconds: number): AclsState {
  const next = advanceClock(s, at(seconds));
  assertConsistent(next, `tick at +${seconds}s`);
  return next;
}

function observe(s: AclsState, seconds: number, kind: ClinicalEventKind, payload: Record<string, unknown>): AclsState {
  assert.ok(codeIsOpen(s), `cannot record ${kind}: the code is not open`);
  const next = appendRecord(tick(s, seconds), { type: 'INFO', kind, description: kind, payload, timestamp: at(seconds) }, ACTOR);
  assertConsistent(next, `${kind} at +${seconds}s`);
  return next;
}

function assertConsistent(s: AclsState, where: string) {
  assert.deepEqual(stateInvariantViolations(s), [], `state rules broken after ${where}`);
  // The episode stamped on each event when it was recorded matches the
  // episode rebuilt from the timeline afterwards.
  const rebuilt = episodeOfEvents(s.clinicalEvents);
  for (const e of s.clinicalEvents) {
    const stamped = (e.payload as { arrestEpisodeNumber?: number }).arrestEpisodeNumber;
    assert.equal(stamped, rebuilt.get(e.id), `${e.kind} #${e.sequence} stamped episode ${stamped}, timeline says ${rebuilt.get(e.id)}`);
  }
}

const kinds = (s: AclsState) => s.clinicalEvents.map(e => e.kind);
const ofKind = <K extends ClinicalEventKind>(s: AclsState, k: K) =>
  s.clinicalEvents.filter((e): e is Extract<ClinicalEvent, { kind: K }> => e.kind === k);
const rhythmCheckThen = (s: AclsState, seconds: number, rhythm: PatientRhythm) => {
  const ticked = tick(s, seconds);
  assert.equal(ticked.activePrompt, 'RHYTHM_CHECK', `expected a rhythm check at +${seconds}s`);
  return act(ticked, seconds + 5, rhythmAction(rhythm));
};

// ---------------------------------------------------------------------------

test('VF/pVT: shock, CPR, epinephrine after the 2nd shock, amiodarone after the 3rd, ROSC at a rhythm check', () => {
  let s = act(idle(), 0, startCodeAction());
  assert.equal(codePhase(s), 'ARREST');
  assert.equal(s.activePrompt, 'RHYTHM_CHECK');

  s = act(s, 8, rhythmAction('SHOCKABLE'));
  assert.equal(s.activePrompt, 'SHOCK_ADVISED');
  s = act(s, 15, shockAction());
  assert.equal(s.isTimerRunning, true);

  s = rhythmCheckThen(s, 135, 'SHOCKABLE');
  s = act(s, 145, shockAction());
  s = act(s, 150, epinephrineAction());

  s = rhythmCheckThen(s, 265, 'SHOCKABLE');
  s = act(s, 275, shockAction());
  s = act(s, 280, amiodaroneAction());

  s = tick(s, 395);
  assert.equal(s.activePrompt, 'RHYTHM_CHECK');
  s = applyRoscAtRhythmCheck(s, at(400), ACTOR);
  assertConsistent(s, 'ROSC at rhythm check');
  assert.equal(codePhase(s), 'ROSC');

  // Every action followed the usual sequence: nothing was flagged.
  assert.equal(s.clinicalEvents.filter(e => (e.payload as { protocolNote?: string }).protocolNote).length, 0);
  assert.deepEqual(kinds(s).slice(-2), ['RHYTHM_CHECK', 'ROSC']);

  const m = calculateResuscitationMetrics(s.clinicalEvents, s.logs);
  assert.equal(m.outcome, 'ROSC');
  assert.equal(m.shockCount, 3);
  assert.equal(m.epinephrineCount, 1);
  assert.equal(m.amiodaroneCount, 1);
  assert.equal(m.timeToFirstShockSeconds, 15);
  assert.equal(m.timeToFirstEpinephrineSeconds, 150);
  assert.deepEqual(m.arrestEpisodeDurationsSeconds, [400]);
  assert.equal(m.episodes?.length, 1);
  assert.deepEqual(
    { ...m.episodes![0], startAt: 0, endAt: 0 },
    {
      episode: 1, startAt: 0, endAt: 0, endedBy: 'ROSC', durationSeconds: 400,
      shocks: 3, epinephrineDoses: 1, amiodaroneDoses: 1, lidocaineDoses: 0, rhythmChecks: 4,
      firstEpinephrineAfterSeconds: 150, epinephrineIntervalsSeconds: [],
    },
  );
});

test('asystole/PEA: epinephrine early, every 3-5 minutes, then resuscitation stopped', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 8, rhythmAction('NON_SHOCKABLE'));
  assert.equal(s.activePrompt, 'EPI_ADVISED');
  s = act(s, 10, epinephrineAction());
  s = act(s, 12, cprCycleAction); // "Begin CPR"

  s = rhythmCheckThen(s, 132, 'NON_SHOCKABLE');
  s = act(s, 140, cprCycleAction);
  s = tick(s, 195);
  assert.equal(s.activePrompt, 'EPI_DUE', 'epinephrine falls due 3 minutes after the first dose');
  s = act(s, 200, epinephrineAction());
  assert.equal(s.activePrompt, null);

  s = rhythmCheckThen(s, 260, 'NON_SHOCKABLE');
  s = act(s, 268, cprCycleAction);
  s = act(s, 400, stopResuscitationAction('12:00:00'));
  assert.equal(codePhase(s), 'TERMINATED');

  // Nothing more can be added to a stopped code.
  for (const spec of [shockAction({ override: true }), epinephrineAction({ override: true }), cprCycleAction(s), resumeAction(s),
    rhythmAction('SHOCKABLE'), roscAction(), stopResuscitationAction('x'), airwayAction(null, 'ETT', true), pauseAction()]) {
    refused(s, 410, spec);
  }

  const m = calculateResuscitationMetrics(s.clinicalEvents, s.logs);
  assert.equal(m.outcome, 'TERMINATED');
  assert.equal(m.episodes?.[0].endedBy, 'CODE_END');
  assert.equal(m.episodes?.[0].durationSeconds, 400);
  assert.deepEqual(m.epinephrineIntervalsSeconds, [190]);
  assert.equal(m.timeToFirstEpinephrineSeconds, 10);
});

test('two ROSCs: re-arrest from "next CPR cycle" opens episode 2 and every event is attributed to its episode', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 5, rhythmAction('SHOCKABLE'));
  s = act(s, 10, shockAction());
  s = rhythmCheckThen(s, 130, 'SHOCKABLE');
  s = act(s, 140, shockAction());
  s = act(s, 145, epinephrineAction());
  s = act(s, 200, roscAction()); // pulse found mid-cycle
  assert.equal(codePhase(s), 'ROSC');

  // Post-ROSC care belongs to episode 1.
  s = observe(s, 230, 'VITALS', { phase: 'POST_ROSC', systolic: 85, map: 60, flags: ['MAP below 65'] });
  s = observe(s, 260, 'POST_ROSC_CHECK', { item: 'ECG_12_LEAD', done: true });

  // Re-arrest: the small "next CPR cycle" button. It used to log a plain CPR start.
  s = act(s, 500, cprCycleAction);
  assert.equal(codePhase(s), 'ARREST');
  assert.equal(s.arrestEpisodeNumber, 2);
  const reArrest = ofKind(s, 'RE_ARREST');
  assert.equal(reArrest.length, 1);
  assert.equal(reArrest[0].payload.arrestEpisodeNumber, 2);
  assert.equal(ofKind(s, 'CPR_START').length, 0);
  assert.match(reArrest[0].description ?? '', /^Re-arrest after ROSC - arrest episode 2 begins/);

  // Episode 2: PEA. Epinephrine is due on the real clock (last dose 6 minutes ago).
  s = observe(s, 530, 'REVERSIBLE_CAUSE', { cause: 'HYPOVOLEMIA', status: 'SUSPECTED' });
  s = rhythmCheckThen(s, 620, 'NON_SHOCKABLE');
  s = act(s, 630, epinephrineAction());
  s = act(s, 635, cprCycleAction);
  s = act(s, 700, roscAction());
  const rosc2 = ofKind(s, 'ROSC').at(-1)!;
  assert.match(rosc2.description ?? '', /ROSC achieved in arrest episode 2 after 3:20 \(6:40 total arrest time\)/);
  assert.equal(rosc2.payload.episodeArrestSeconds, 200);
  assert.equal(rosc2.payload.arrestDurationSeconds, 400);
  s = act(s, 900, dispositionAction('ICU', 'ICU'));
  assert.equal(codePhase(s), 'CLOSED_AFTER_ROSC');

  for (const spec of [cprCycleAction(s), resumeAction(s), epinephrineAction({ override: true }), roscAction(),
    dispositionAction('CATH_LAB', 'Cath lab'), airwayAction(null, 'SGA', false)]) {
    refused(s, 910, spec);
  }

  const episodeOf = (k: ClinicalEventKind) => s.clinicalEvents.filter(e => e.kind === k)
    .map(e => (e.payload as { arrestEpisodeNumber?: number }).arrestEpisodeNumber);
  assert.deepEqual(episodeOf('VITALS'), [1]);
  assert.deepEqual(episodeOf('POST_ROSC_CHECK'), [1]);
  assert.deepEqual(episodeOf('REVERSIBLE_CAUSE'), [2]);
  assert.deepEqual(episodeOf('EPINEPHRINE'), [1, 2]);
  assert.deepEqual(episodeOf('ROSC'), [1, 2]);
  assert.deepEqual(episodeOf('DISPOSITION'), [2]);

  const m = calculateResuscitationMetrics(s.clinicalEvents, s.logs);
  assert.equal(m.roscCount, 2);
  assert.equal(m.reArrestCount, 1);
  assert.deepEqual(m.arrestEpisodeDurationsSeconds, [200, 200]);
  assert.equal(m.totalArrestDurationSeconds, 400, 'time in ROSC is not arrest time');
  assert.deepEqual(m.episodes?.map(e => [e.episode, e.endedBy, e.durationSeconds, e.shocks, e.epinephrineDoses]), [
    [1, 'ROSC', 200, 2, 1],
    [2, 'ROSC', 200, 0, 1],
  ]);
  assert.equal(m.episodes?.[1].firstEpinephrineAfterSeconds, 130, 'measured from the re-arrest, not the code start');
  // The 485 s between the two doses spans a ROSC: not an epinephrine interval.
  assert.deepEqual(m.epinephrineIntervalsSeconds, []);
  assert.deepEqual(m.medicationIntervalsSeconds, [485], 'legacy whole-code gap is kept for older readers');
  assert.equal(m.timeFromRoscTo12LeadSeconds, 60);
  assert.equal(m.disposition, 'ICU');
});

test('re-arrest from the main "Re-Arrest: Restart CPR" button is recorded the same way', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 5, rhythmAction('NON_SHOCKABLE'));
  s = act(s, 60, roscAction());
  s = act(s, 90, resumeAction);
  assert.deepEqual(kinds(s), ['CODE_START', 'RHYTHM_CHECK', 'ROSC', 'RE_ARREST']);
  assert.equal(s.isTimerRunning, true);
  assert.equal(s.arrestEpisodeNumber, 2);
});

test('a pause at the exact end of the CPR cycle becomes the rhythm check and records no pause', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 5, rhythmAction('NON_SHOCKABLE'));
  s = act(s, 10, cprCycleAction); // ends at +130
  const ticked = advanceClock(s, at(129));
  const paused = applyAction(ticked, pauseAction(), at(130), ACTOR);
  assert.equal(paused.activePrompt, 'RHYTHM_CHECK');
  assert.equal(ofKind(paused, 'CPR_PAUSE').length, 0);
  assertConsistent(paused, 'pause at deadline');
});

test('out-of-sequence actions are recorded only when confirmed, and carry the reason', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 5, rhythmAction('NON_SHOCKABLE'));
  s = act(s, 10, cprCycleAction);
  refused(s, 20, shockAction()); // CPR running, non-shockable: not without confirmation
  s = act(s, 20, shockAction({ override: true }, 'A CPR cycle is running.'));
  const shock = ofKind(s, 'SHOCK')[0];
  assert.equal(shock.payload.protocolNote, 'A CPR cycle is running.');
  assert.match(shock.description ?? '', /Recorded outside usual AHA sequence/);
  s = act(s, 25, lidocaineAction({ override: true }, 'Not shock-refractory VF.'));
  assert.equal(calculateResuscitationMetrics(s.clinicalEvents, s.logs).protocolDeviationCount, 2);
});

test('starting a new code clears the previous patient\'s record', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 5, rhythmAction('SHOCKABLE'));
  s = act(s, 10, shockAction());
  s = act(s, 100, stopResuscitationAction('10:00'));
  s = act(s, 4000, startCodeAction());
  assert.deepEqual(kinds(s), ['CODE_START']);
  assert.equal(s.clinicalEvents[0].sequence, 1);
  assert.equal(s.shocksCount, 0);
  assert.equal(s.arrestEpisodeNumber, 1);
});

// ---------------------------------------------------------------------------
// Randomized: any sequence of taps, at any time, keeps the record consistent.
// ---------------------------------------------------------------------------

function prng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

type Step = { name: string; run: (s: AclsState, now: number) => AclsState };

const STEPS: Step[] = [
  { name: 'start', run: (s, now) => (codeIsOpen(s) && !s.roscAt ? s : applyAction(s, startCodeAction(), now, ACTOR)) },
  { name: 'pause/resume', run: (s, now) => applyAction(s, s.isTimerRunning ? pauseAction() : resumeAction(s), now, ACTOR) },
  { name: 'next cycle', run: (s, now) => applyAction(s, cprCycleAction(s), now, ACTOR) },
  { name: 'rhythm VF', run: (s, now) => applyAction(s, rhythmAction('SHOCKABLE'), now, ACTOR) },
  { name: 'rhythm PEA', run: (s, now) => applyAction(s, rhythmAction('NON_SHOCKABLE'), now, ACTOR) },
  { name: 'shock', run: (s, now) => applyAction(s, shockAction(), now, ACTOR) },
  { name: 'shock (confirmed)', run: (s, now) => applyAction(s, shockAction({ override: true }, 'confirmed'), now, ACTOR) },
  { name: 'epinephrine', run: (s, now) => applyAction(s, epinephrineAction(), now, ACTOR) },
  { name: 'epinephrine (confirmed)', run: (s, now) => applyAction(s, epinephrineAction({ override: true }, 'confirmed'), now, ACTOR) },
  { name: 'amiodarone (confirmed)', run: (s, now) => applyAction(s, amiodaroneAction({ override: true }, 'confirmed'), now, ACTOR) },
  { name: 'lidocaine', run: (s, now) => applyAction(s, lidocaineAction(), now, ACTOR) },
  { name: 'ROSC', run: (s, now) => applyAction(s, roscAction(), now, ACTOR) },
  { name: 'ROSC at check', run: (s, now) => applyRoscAtRhythmCheck(s, now, ACTOR) },
  { name: 'stop', run: (s, now) => applyAction(s, stopResuscitationAction('t'), now, ACTOR) },
  { name: 'disposition', run: (s, now) => applyAction(s, dispositionAction('ICU', 'ICU'), now, ACTOR) },
  { name: 'airway', run: (s, now) => applyAction(s, airwayAction(s.advancedAirway, 'ETT', Math.floor(now / 1000) % 2 === 0), now, ACTOR) },
  {
    name: 'H&T',
    run: (s, now) => (codeIsOpen(s)
      ? appendRecord(s, { type: 'INFO', kind: 'REVERSIBLE_CAUSE', description: 'H&T', payload: { cause: 'HYPOXIA', status: 'TREATED' }, timestamp: now }, ACTOR)
      : s),
  },
  {
    name: 'vitals',
    run: (s, now) => (codeIsOpen(s) && s.roscAt
      ? appendRecord(s, { type: 'INFO', kind: 'VITALS', description: 'vitals', payload: { phase: 'POST_ROSC', map: 70, flags: [] }, timestamp: now }, ACTOR)
      : s),
  },
];

test('randomized: 400 random codes keep every state rule and attribute every event to the right episode', () => {
  const rand = prng(20251005);
  const reached = { multiEpisode: 0, terminated: 0, closedAfterRosc: 0, overrides: 0 };
  for (let run = 0; run < 400; run++) {
    let s = idle();
    let t = 0;
    const trail: string[] = [];
    const steps = 10 + Math.floor(rand() * 70);
    for (let i = 0; i < steps; i++) {
      t += Math.floor(rand() * 4) === 0 ? 0 : Math.floor(rand() * 150); // some taps land in the same second
      const step = STEPS[Math.floor(rand() * STEPS.length)];
      trail.push(`+${t}s ${step.name}`);
      const ticked = advanceClock(s, at(t));
      s = step.run(ticked, at(t));
      try {
        assertConsistent(s, step.name);
      } catch (err) {
        throw new Error(`run ${run}: ${(err as Error).message}\n${trail.join('\n')}`);
      }
    }

    // The rebuilt episodes add up to the live counters.
    const episodes = summarizeEpisodes(s.clinicalEvents);
    if (s.codeStartedAt) {
      assert.equal(episodes.length, s.arrestEpisodeNumber, `run ${run}: episodes`);
      assert.equal(episodes.reduce((n, e) => n + e.shocks, 0), s.shocksCount, `run ${run}: shocks`);
      assert.equal(episodes.reduce((n, e) => n + e.epinephrineDoses, 0), s.epiCount, `run ${run}: epinephrine`);
      assert.equal(episodes.reduce((n, e) => n + e.amiodaroneDoses, 0), s.amioCount ?? 0, `run ${run}: amiodarone`);
      // Only the last episode can still be open, and only while in arrest.
      episodes.slice(0, -1).forEach(e => assert.equal(e.endedBy, 'ROSC', `run ${run}: earlier episodes end in ROSC`));
      const last = episodes.at(-1)!;
      const phase = codePhase(s);
      assert.equal(last.endedBy, phase === 'ARREST' ? null : phase === 'TERMINATED' ? 'CODE_END' : 'ROSC', `run ${run}: last episode end (${phase})`);
      if (episodes.length > 1) reached.multiEpisode++;
      if (phase === 'TERMINATED') reached.terminated++;
      if (phase === 'CLOSED_AFTER_ROSC') reached.closedAfterRosc++;
      if (s.clinicalEvents.some(e => (e.payload as { protocolNote?: string }).protocolNote)) reached.overrides++;
    }
  }
  // The walk really explored the interesting paths.
  for (const [path, runs] of Object.entries(reached)) assert.ok(runs >= 20, `only ${runs} runs reached ${path}`);
});

test('the rules catch the old bug: CPR restarted in ROSC but recorded as a plain CPR start', () => {
  let s = act(idle(), 0, startCodeAction());
  s = act(s, 5, rhythmAction('NON_SHOCKABLE'));
  s = act(s, 60, roscAction());
  const oldStyle: ActionSpec = { ...cprCycleAction({ ...s, roscAt: null }), transition: cprCycleAction(s).transition };
  const buggy = applyAction(s, oldStyle, at(90), ACTOR);
  assert.equal(buggy.clinicalEvents.at(-1)?.kind, 'CPR_START');
  assert.ok(stateInvariantViolations(buggy).some(v => v.includes('re-arrests recorded')));
});
