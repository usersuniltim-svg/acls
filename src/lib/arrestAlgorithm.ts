/**
 * The 2025 AHA Adult Cardiac Arrest Algorithm (VF/pVT/Asystole/PEA), as data.
 *
 * Box numbers and wording follow the AHA accessible text version of the
 * algorithm (cpr.heart.org, "Algorithm-ACLS-CA-LngDscrp-250725"). The side
 * boxes (CPR quality, shock energy, drugs, airway, reversible causes) are not
 * here: the app shows them as cues during compressions (lib/compressionCues).
 *
 * `algorithmPosition` walks the recorded events of the current arrest episode
 * through the same transitions the chart draws, so the highlighted step and
 * the arrows on screen always agree.
 *
 * Pure functions only, so they can be tested without a browser.
 */
import type { AclsState, ClinicalEvent } from '../types';

export type ArrestBox = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface ArrestBoxSpec {
  box: ArrestBox;
  /** Where the box sits on the chart. */
  column: 'top' | 'shockable' | 'nonshockable' | 'bottom';
  kind: 'action' | 'shock' | 'rhythm' | 'decision';
  title: string;
  lines: string[];
}

export const ARREST_BOXES: ArrestBoxSpec[] = [
  { box: 1, column: 'top', kind: 'action', title: 'Start CPR', lines: ['Give oxygen, bag-mask ventilation', 'Attach monitor/defibrillator'] },
  { box: 2, column: 'shockable', kind: 'rhythm', title: 'VF/pVT', lines: [] },
  { box: 3, column: 'shockable', kind: 'shock', title: 'Shock', lines: [] },
  { box: 4, column: 'shockable', kind: 'action', title: 'CPR 2 min', lines: ['IV/IO access'] },
  { box: 5, column: 'shockable', kind: 'shock', title: 'Shock', lines: [] },
  { box: 6, column: 'shockable', kind: 'action', title: 'CPR 2 min', lines: ['Epinephrine every 3 to 5 min', 'Consider advanced airway, capnography'] },
  { box: 7, column: 'shockable', kind: 'shock', title: 'Shock', lines: [] },
  { box: 8, column: 'shockable', kind: 'action', title: 'CPR 2 min', lines: ['Amiodarone or lidocaine', 'Treat reversible causes'] },
  { box: 9, column: 'nonshockable', kind: 'rhythm', title: 'Asystole/PEA', lines: ['Give epinephrine as soon as possible'] },
  { box: 10, column: 'nonshockable', kind: 'action', title: 'CPR 2 min', lines: ['IV/IO access', 'Epinephrine every 3 to 5 min', 'Consider advanced airway, capnography'] },
  { box: 11, column: 'nonshockable', kind: 'action', title: 'CPR 2 min', lines: ['Treat reversible causes'] },
  {
    box: 12, column: 'bottom', kind: 'decision', title: 'Signs of ROSC?',
    lines: ['No signs of ROSC: go to 10', 'ROSC: post-cardiac arrest care', 'Consider whether to continue resuscitation'],
  },
];

export function boxSpec(box: ArrestBox): ArrestBoxSpec {
  return ARREST_BOXES.find(b => b.box === box)!;
}

const SHOCK_BOXES: ReadonlySet<ArrestBox> = new Set([3, 5, 7]);

/** A step along the chart: the boxes passed through on the way, then where it ends. */
export interface Move {
  via: ArrestBox[];
  to: ArrestBox;
}

/**
 * Rhythm check after `from` shows VF/pVT.
 *  - Box 1 -> 2 (VF/pVT) -> 3 (shock).
 *  - Boxes 4 and 6 -> 5 and 7 (AHA "If Yes, proceed to Box 5/7").
 *  - Boxes 9, 10 and 11 -> 5 (AHA "If Yes, proceed to Box 5").
 *  - Box 8 -> 5. The accessible text gives no exit for Box 8; the graphical
 *    2025 algorithm labels this arrow "Go to 5", so the loop is 5-6-7-8.
 *  - Already at a shock box: stay there (the shock has not been given yet).
 */
export function afterShockable(from: ArrestBox): Move {
  if (SHOCK_BOXES.has(from)) return { via: [], to: from };
  if (from === 1 || from === 2) return { via: from === 1 ? [2] : [], to: 3 };
  if (from === 4) return { via: [], to: 5 };
  if (from === 6) return { via: [], to: 7 };
  if (from === 9) return { via: [10], to: 5 };
  return { via: [], to: 5 }; // 8, 10, 11, 12
}

/**
 * Rhythm check after `from` shows asystole/PEA.
 *  - Box 1 -> 9 (asystole/PEA, epinephrine as soon as possible).
 *  - Box 10 -> 11 (AHA "If No, proceed to Box 11").
 *  - Boxes 4, 6, 8 and 11 -> 12, and with no ROSC on to 10.
 *  - Shock boxes (the rhythm changed before the shock) -> 12 -> 10.
 */
export function afterNonShockable(from: ArrestBox): Move {
  if (from === 1) return { via: [], to: 9 };
  if (from === 9) return { via: [10], to: 11 };
  if (from === 10) return { via: [], to: 11 };
  return { via: [12], to: 10 }; // 2-8, 11, 12
}

/** Where a delivered shock leaves the team: the CPR box after the shock box. */
export function afterShock(from: ArrestBox): Move {
  const atShock = SHOCK_BOXES.has(from) ? { via: [] as ArrestBox[], to: from } : afterShockable(from);
  const shockBox = atShock.to;
  return { via: [...atShock.via, shockBox], to: (shockBox + 1) as ArrestBox };
}

/** What the chart prints under a CPR box: where each rhythm-check answer leads. */
export function rhythmCheckExits(from: ArrestBox): { shockable: ArrestBox; nonShockable: ArrestBox } {
  const yes = afterShockable(from);
  const no = afterNonShockable(from);
  // Box 12 is passed on the way when the answer is "not shockable" from a
  // shockable-side box: the chart names 12, as AHA does.
  return { shockable: yes.via[0] === 10 ? 5 : yes.via[0] ?? yes.to, nonShockable: no.via[0] ?? no.to };
}

export interface AlgorithmPosition {
  /** Box the team is in now, or null before a code starts. */
  box: ArrestBox | null;
  /** Compressions are stopped for a rhythm check after `box`. */
  atRhythmCheck: boolean;
  /** Boxes passed in the current arrest episode, oldest first (may repeat). */
  path: ArrestBox[];
  /** ROSC in this episode: post-cardiac arrest care (Box 12, ROSC branch). */
  rosc: boolean;
  /** Resuscitation was stopped. */
  stopped: boolean;
  arrestEpisodeNumber: number;
}

const NOT_STARTED: AlgorithmPosition = { box: null, atRhythmCheck: false, path: [], rosc: false, stopped: false, arrestEpisodeNumber: 0 };

/**
 * Where the team is on the algorithm, from the events of the current arrest
 * episode (CODE_START or the latest RE_ARREST onward).
 */
export function algorithmPosition(state: Pick<AclsState, 'codeStartedAt' | 'clinicalEvents' | 'activePrompt' | 'isTimerRunning'>): AlgorithmPosition {
  if (!state.codeStartedAt) return NOT_STARTED;
  const events = [...(state.clinicalEvents ?? [])].sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);

  let box: ArrestBox = 1;
  let path: ArrestBox[] = [1];
  let rosc = false;
  let stopped = false;
  let episode = 1;

  const go = (move: Move): ArrestBox => {
    for (const b of [...move.via, move.to]) {
      if (path[path.length - 1] !== b) path.push(b);
    }
    return move.to;
  };

  for (const e of events as ClinicalEvent[]) {
    switch (e.kind) {
      case 'CODE_START':
      case 'RE_ARREST':
        box = 1;
        path = [1];
        rosc = false;
        stopped = false;
        episode = e.payload.arrestEpisodeNumber ?? (e.kind === 'CODE_START' ? 1 : episode + 1);
        break;
      case 'RHYTHM_CHECK':
        if (e.payload.rhythm === 'SHOCKABLE') box = go(afterShockable(box));
        else if (e.payload.rhythm === 'NON_SHOCKABLE') box = go(afterNonShockable(box));
        break;
      case 'SHOCK':
        box = go(afterShock(box));
        break;
      case 'CPR_START':
      case 'CPR_RESUME':
        // Box 9 ("give epinephrine as soon as possible") leads into the CPR of Box 10.
        if (box === 9) box = go({ via: [], to: 10 });
        break;
      case 'ROSC':
        rosc = true;
        if (box !== 12) path.push(12);
        box = 12;
        break;
      case 'CODE_END':
        stopped = true;
        break;
      default:
        break;
    }
  }

  return {
    box,
    atRhythmCheck: !rosc && !stopped && state.activePrompt === 'RHYTHM_CHECK',
    path,
    rosc,
    stopped,
    arrestEpisodeNumber: episode,
  };
}
