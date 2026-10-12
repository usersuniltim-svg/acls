/**
 * The side boxes of the 2025 AHA Adult Cardiac Arrest Algorithm (CPR quality,
 * shock energy, drug therapy, advanced airway, reversible causes), turned into
 * short cues that rotate on the Timers screen while compressions are running.
 *
 * Wording follows the AHA accessible text version of the algorithm; the
 * compression depth upper limit is from 2025 AHA Part 7 (Adult BLS).
 * The cues adapt to the code: 30:2 or 1 breath every 6 s depending on the
 * airway, shock energy and antiarrhythmics only in VF/pVT, the airway cue only
 * while no confirmed tube is in place.
 *
 * Pure functions only, so they can be tested without a browser.
 */
import type { AclsState } from '../types';
import { CPR_CYCLE_DURATION } from '../constants';
import { awaitingCompressionsAfterShock, isCodeActive } from './codeClock';

export type CueGroup = 'CPR quality' | 'Ventilation' | 'Capnography' | 'Shock energy' | 'Drug therapy' | 'Advanced airway' | 'Reversible causes' | 'Rhythm check';

export interface CompressionCue {
  id: string;
  group: CueGroup;
  text: string;
}

/**
 * Shown at every rhythm check, while hands are off the chest.
 * 2025 AHA: change compressor about every 2 minutes (at the rhythm check);
 * check a pulse only for an organized rhythm, for no more than 10 s.
 */
export const RHYTHM_CHECK_REMINDERS = [
  'Switch compressors now (every 2 minutes)',
  'Organized rhythm? Check for a pulse, no more than 10 s',
] as const;

/** Each cue stays on screen this long. */
export const CUE_SECONDS = 5;
/** In the last seconds of a cycle the cue becomes "get ready to switch compressors". */
export const SWITCH_WARNING_SECONDS = 15;

/** Compressions are running: a CPR cycle is live and nothing has stopped the hands. */
export function isCompressing(s: AclsState): boolean {
  return (
    isCodeActive(s) &&
    s.isTimerRunning &&
    (s.activePrompt === null || s.activePrompt === 'EPI_DUE') &&
    !awaitingCompressionsAfterShock(s)
  );
}

/** All cues for the current state of the code, in rotation order. */
export function compressionCues(s: AclsState): CompressionCue[] {
  const airway = s.advancedAirway ?? null;
  const shockable = s.currentRhythm === 'SHOCKABLE';
  const cues: CompressionCue[] = [
    { id: 'depth', group: 'CPR quality', text: 'Push hard: at least 5 cm (2 in), but not more than 6 cm' },
    { id: 'rate', group: 'CPR quality', text: 'Push fast: 100 to 120 per minute. Follow the metronome' },
    { id: 'recoil', group: 'CPR quality', text: 'Allow complete chest recoil after each compression' },
    airway
      ? { id: 'ventilation', group: 'Ventilation', text: 'Advanced airway in place: 1 breath every 6 s (10 per minute), compressions continuous' }
      : { id: 'ventilation', group: 'Ventilation', text: 'No advanced airway: 30 compressions, then 2 breaths' },
    { id: 'interruptions', group: 'CPR quality', text: 'Minimize interruptions. Avoid excessive ventilation' },
    { id: 'capnography', group: 'Capnography', text: 'Continuous waveform capnography: if ETCO2 is low or falling, reassess CPR quality' },
    { id: 'compressor', group: 'CPR quality', text: 'Change compressor every 2 minutes, or sooner if tired' },
  ];

  if (shockable) {
    cues.push(
      s.defibType === 'MONOPHASIC'
        ? { id: 'energy', group: 'Shock energy', text: 'Monophasic: 360 J' }
        : { id: 'energy', group: 'Shock energy', text: 'Biphasic: device recommendation (for example 120 to 200 J); if unknown, use the maximum. Later shocks: same or higher' },
    );
  }

  cues.push({ id: 'epinephrine', group: 'Drug therapy', text: 'Epinephrine 1 mg IV/IO every 3 to 5 minutes' });

  if (shockable) {
    cues.push({
      id: 'antiarrhythmic',
      group: 'Drug therapy',
      text: 'Shock-refractory VF/pVT: amiodarone 300 mg, then 150 mg, or lidocaine 1 to 1.5 mg/kg, then 0.5 to 0.75 mg/kg',
    });
  }

  if (!airway) {
    cues.push({ id: 'airway', group: 'Advanced airway', text: 'Consider an advanced airway: endotracheal tube or supraglottic airway' });
  } else if (airway.device === 'ETT' && !airway.confirmedByCapnography) {
    cues.push({ id: 'airway', group: 'Advanced airway', text: 'Confirm and monitor tube placement with continuous waveform capnography' });
  }

  cues.push(
    { id: 'hs', group: 'Reversible causes', text: "H's: hypovolemia, hypoxia, hydrogen ion (acidosis), hypo/hyperkalemia, hypothermia" },
    { id: 'ts', group: 'Reversible causes', text: "T's: tension pneumothorax, tamponade, toxins, pulmonary thrombosis, coronary thrombosis" },
  );
  return cues;
}

/**
 * The cue to show now, or null when compressions are not running. The
 * rotation follows the CPR cycle clock, so it needs no timer of its own and
 * always starts again at "push hard" with each new cycle.
 */
export function currentCompressionCue(s: AclsState): { cue: CompressionCue; index: number; count: number } | null {
  if (!isCompressing(s)) return null;
  if (s.cprTimeLeft > 0 && s.cprTimeLeft <= SWITCH_WARNING_SECONDS) {
    return {
      cue: { id: 'switch', group: 'Rhythm check', text: `Rhythm check in ${s.cprTimeLeft} s: next compressor, get ready to switch` },
      index: -1,
      count: 0,
    };
  }
  const cues = compressionCues(s);
  const elapsed = Math.max(0, CPR_CYCLE_DURATION - s.cprTimeLeft);
  const index = Math.floor(elapsed / CUE_SECONDS) % cues.length;
  return { cue: cues[index], index, count: cues.length };
}
