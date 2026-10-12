/**
 * The AHA side boxes shown as cues during compressions (lib/compressionCues):
 * only while hands are on the chest, adapted to the code, and in AHA wording.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AclsState } from '../src/types';
import {
  advanceClock,
  analyzeRhythmNow,
  confirmCompressionsRestarted,
  confirmRosc,
  deliverShock,
  pauseCpr,
  recordAirway,
  selectRhythm,
  startCode,
  startCprCycle,
} from '../src/lib/codeClock';
import {
  CUE_SECONDS,
  RHYTHM_CHECK_REMINDERS,
  SWITCH_WARNING_SECONDS,
  compressionCues,
  currentCompressionCue,
  isCompressing,
} from '../src/lib/compressionCues';

const T0 = 1_000_000_000_000;
const at = (seconds: number) => T0 + seconds * 1000;

function idle(): AclsState {
  return {
    isTimerRunning: false, cprTimeLeft: 120, epiTimeLeft: 180, totalTime: 0, shocksCount: 0, epiCount: 0,
    currentRhythm: 'UNKNOWN', cprCycleCount: 0, logs: [], clinicalEvents: [], showHsAndTs: false,
    activePrompt: null, rhythmCheckTimeLeft: 0, defibType: 'BIPHASIC', selectedEnergy: 200,
  };
}

const ids = (s: AclsState) => compressionCues(s).map(c => c.id);
const textOf = (s: AclsState, id: string) => compressionCues(s).find(c => c.id === id)?.text ?? '';

/** VF/pVT, first shock given and compressions confirmed restarted. */
function vfCompressing(): AclsState {
  let s = analyzeRhythmNow(startCode(idle(), at(0)), at(20));
  s = deliverShock(selectRhythm(s, 'SHOCKABLE', at(23)), at(25));
  return confirmCompressionsRestarted(s, at(27));
}

test('cues show only while compressions are running', () => {
  assert.equal(isCompressing(idle()), false, 'no code');
  let s = startCode(idle(), at(0));
  assert.equal(isCompressing(s), true, 'CPR starts with the code');
  s = analyzeRhythmNow(s, at(20));
  assert.equal(isCompressing(s), false, 'hands off for the rhythm check');
  assert.equal(currentCompressionCue(s), null);
  s = selectRhythm(s, 'SHOCKABLE', at(23));
  assert.equal(isCompressing(s), false, 'shock advised: hands off');
  s = deliverShock(s, at(25));
  assert.equal(isCompressing(s), false, 'waiting for the recorder to confirm compressions restarted');
  s = confirmCompressionsRestarted(s, at(27));
  assert.equal(isCompressing(s), true);
  assert.equal(isCompressing(pauseCpr(s, at(40))), false, 'code paused');
  assert.equal(isCompressing(confirmRosc(s, at(50))), false, 'ROSC');
});

test('the epinephrine reminder does not hide the cues (compressions continue while it shows)', () => {
  let s = analyzeRhythmNow(startCode(idle(), at(0)), at(20));
  s = startCprCycle(selectRhythm(s, 'NON_SHOCKABLE', at(23)), at(26));
  assert.equal(s.activePrompt, 'EPI_DUE');
  assert.equal(isCompressing(s), true);
  assert.ok(currentCompressionCue(s));
});

test('ventilation cue follows the airway: 30:2 without one, 1 breath every 6 s with one', () => {
  const s = vfCompressing();
  assert.match(textOf(s, 'ventilation'), /30 compressions, then 2 breaths/);
  const withTube = recordAirway(s, at(60), 'ETT', true);
  assert.match(textOf(withTube, 'ventilation'), /1 breath every 6 s \(10 per minute\), compressions continuous/);
});

test('shock energy and antiarrhythmic cues only in VF/pVT, with the AHA doses', () => {
  const vf = vfCompressing();
  assert.ok(ids(vf).includes('energy'));
  assert.match(textOf(vf, 'energy'), /120 to 200 J/);
  assert.match(textOf(vf, 'energy'), /maximum/);
  assert.match(textOf(vf, 'antiarrhythmic'), /amiodarone 300 mg, then 150 mg/);
  assert.match(textOf(vf, 'antiarrhythmic'), /lidocaine 1 to 1.5 mg\/kg, then 0.5 to 0.75 mg\/kg/);
  assert.match(textOf({ ...vf, defibType: 'MONOPHASIC' }, 'energy'), /360 J/);

  let pea = analyzeRhythmNow(startCode(idle(), at(0)), at(20));
  pea = startCprCycle(selectRhythm(pea, 'NON_SHOCKABLE', at(23)), at(26));
  assert.ok(!ids(pea).includes('energy'));
  assert.ok(!ids(pea).includes('antiarrhythmic'));
  assert.match(textOf(pea, 'epinephrine'), /1 mg IV\/IO every 3 to 5 minutes/);
});

test('airway cue: consider one when none, confirm an unconfirmed tube, nothing once confirmed', () => {
  const s = vfCompressing();
  assert.match(textOf(s, 'airway'), /endotracheal tube or supraglottic airway/);
  assert.match(textOf(recordAirway(s, at(60), 'ETT', false), 'airway'), /waveform capnography/);
  assert.ok(!ids(recordAirway(s, at(60), 'ETT', true)).includes('airway'));
  assert.ok(!ids(recordAirway(s, at(60), 'SGA', false)).includes('airway'));
});

test('CPR quality cues carry the 2025 AHA numbers', () => {
  const s = vfCompressing();
  assert.match(textOf(s, 'depth'), /at least 5 cm \(2 in\), but not more than 6 cm/);
  assert.match(textOf(s, 'rate'), /100 to 120 per minute/);
  assert.match(textOf(s, 'recoil'), /complete chest recoil/);
  assert.match(textOf(s, 'interruptions'), /Avoid excessive ventilation/);
  assert.match(textOf(s, 'capnography'), /ETCO2 is low or falling, reassess CPR quality/);
  assert.match(textOf(s, 'compressor'), /every 2 minutes/);
  assert.match(textOf(s, 'hs'), /hypovolemia, hypoxia, hydrogen ion/);
  assert.match(textOf(s, 'ts'), /tension pneumothorax, tamponade, toxins/);
});

test('the cue rotates every few seconds with the CPR clock and starts each cycle at "push hard"', () => {
  const s = vfCompressing(); // cycle started at +25 s
  const first = currentCompressionCue(advanceClock(s, at(26)))!;
  assert.equal(first.cue.id, 'depth');
  const next = currentCompressionCue(advanceClock(s, at(25 + CUE_SECONDS + 1)))!;
  assert.equal(next.cue.id, 'rate');
  // Every second of the cycle has a cue while compressions run.
  for (let t = 26; t < 25 + 120; t++) {
    assert.ok(currentCompressionCue(advanceClock(s, at(t))), `cue at +${t}s`);
  }
});

test('in the last seconds of a cycle the cue asks the next compressor to get ready', () => {
  const s = vfCompressing();
  const late = advanceClock(s, at(25 + 120 - 10));
  const c = currentCompressionCue(late)!;
  assert.equal(c.cue.id, 'switch');
  assert.match(c.cue.text, /Rhythm check in 10 s: next compressor, get ready to switch/);
  const before = advanceClock(s, at(25 + 120 - SWITCH_WARNING_SECONDS - 1));
  assert.notEqual(currentCompressionCue(before)!.cue.id, 'switch');
});

test('the rhythm check reminds the team to switch compressors and keep pulse checks short', () => {
  assert.ok(RHYTHM_CHECK_REMINDERS.some(r => /Switch compressors/.test(r)));
  assert.ok(RHYTHM_CHECK_REMINDERS.some(r => /pulse, no more than 10 s/.test(r)));
});
