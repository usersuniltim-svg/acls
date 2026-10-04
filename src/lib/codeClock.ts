import { AclsState, AdvancedAirwayDevice, DispositionDestination, PatientRhythm } from '../types';
import { CPR_CYCLE_DURATION, EPI_INTERVAL } from '../constants';

/**
 * Resuscitation clock.
 *
 * Every timer shown on screen (total arrest time, CPR cycle, epinephrine
 * interval, rhythm-check pause) is calculated from real timestamps, never by
 * counting timer ticks. Phones slow down or pause background timers when the
 * screen dims or locks; with this approach the numbers are still exact the
 * moment the screen comes back.
 *
 * All functions here are pure: (state, now) -> new state. No sounds, no logs.
 */

export const RHYTHM_CHECK_SECONDS = 10;
const CPR_MS = CPR_CYCLE_DURATION * 1000;
const EPI_MS = EPI_INTERVAL * 1000;
const RHYTHM_CHECK_MS = RHYTHM_CHECK_SECONDS * 1000;
/** Re-sound the "epinephrine due" alert this often while it is overdue. */
const EPI_REALERT_SECONDS = 7;

export const AMIODARONE_MAX_DOSES = 2; // 300 mg, then 150 mg
/** 2025 AHA: biphasic per manufacturer (e.g. initial 120-200 J; maximum if unknown); monophasic 360 J. */
export const MONOPHASIC_J = 360;
export const LIDOCAINE_MAX_DOSES = 2; // 1-1.5 mg/kg, then 0.5-0.75 mg/kg per 2025 AHA cardiac-arrest algorithm

type AlertKind = NonNullable<AclsState['alert']>['kind'];
const ALERT_PRIORITY: Record<AlertKind, number> = { urgent: 3, cycleEnd: 2, epi: 1 };

function withAlert(state: AclsState, prev: AclsState, kind: AlertKind): AclsState {
  // If two alerts fall in the same tick, keep the more important one.
  if (state.alert && state.alert.seq !== prev.alert?.seq && ALERT_PRIORITY[state.alert.kind] >= ALERT_PRIORITY[kind]) {
    return state;
  }
  return { ...state, alert: { seq: (prev.alert?.seq ?? 0) + 1, kind } };
}

/** A patient is in arrest right now: a code was started and has not reached ROSC or been stopped. */
export function isCodeActive(s: AclsState): boolean {
  return Boolean(s.codeStartedAt) && !s.roscAt && !s.terminatedAt;
}

/** Arrest time in whole seconds (stops at ROSC or when resuscitation is stopped; excludes time spent in ROSC). */
export function arrestSeconds(s: AclsState, now: number): number {
  if (!s.codeStartedAt) return s.totalTime;
  const end = s.roscAt ?? s.terminatedAt ?? now;
  return Math.max(0, Math.floor((end - s.codeStartedAt - (s.roscPausedMs ?? 0)) / 1000));
}

/** Fields that describe a code in progress, all cleared. */
export function clearedClockFields(): Partial<AclsState> {
  return {
    codeStartedAt: null,
    arrestEpisodeNumber: 0,
    roscAt: null,
    terminatedAt: null,
    roscElapsedSeconds: 0,
    dispositionAt: null,
    disposition: null,
    advancedAirway: null,
    lastShockEnergyJ: null,
    lastShockDefibType: null,
    roscPausedMs: 0,
    cprEndsAt: null,
    cprRemainingMs: CPR_MS,
    rhythmCheckStartedAt: null,
    epiAnchorAt: null,
    rhythmCheckCount: 0,
    epiDueElapsed: 0,
  };
}

/**
 * Recalculate the on-screen timers from the real clock and apply the
 * time-based events (CPR cycle ending, epinephrine becoming due).
 * Returns the same object when nothing visible changed, so React skips a render.
 */
export function advanceClock(prev: AclsState, now: number): AclsState {
  // Nothing moves once resuscitation has been stopped or the patient has been
  // handed over after ROSC: the record is final.
  if (!prev.codeStartedAt || prev.terminatedAt || prev.dispositionAt) return prev;
  let next: AclsState = { ...prev };

  // 1. The 2-minute CPR cycle has run out -> rhythm check.
  if (next.cprEndsAt != null && !next.roscAt && now >= next.cprEndsAt) {
    next = {
      ...next,
      activePrompt: 'RHYTHM_CHECK',
      rhythmCheckStartedAt: next.cprEndsAt, // when it really ended, even if the screen was off
      cprEndsAt: null,
      cprRemainingMs: 0,
      isTimerRunning: false,
    };
    next = withAlert(next, prev, 'cycleEnd');
  }

  // 2. Recalculate every displayed timer.
  const totalTime = arrestSeconds(next, now);
  const cprTimeLeft =
    next.cprEndsAt != null
      ? Math.max(0, Math.ceil((next.cprEndsAt - now) / 1000))
      : Math.ceil((next.cprRemainingMs ?? CPR_MS) / 1000);
  // Epinephrine is timed on the real clock from the last dose. The drug wears
  // off whether or not the patient is in ROSC, so time in ROSC counts: after a
  // long ROSC, a re-arrest finds the next dose already due.
  const epiDueAt = (next.epiAnchorAt ?? next.codeStartedAt!) + EPI_MS;
  const epiTimeLeft = Math.max(0, Math.ceil((epiDueAt - now) / 1000));
  const roscElapsedSeconds = next.roscAt ? Math.max(0, Math.floor((now - next.roscAt) / 1000)) : 0;
  const rhythmCheckTimeLeft =
    next.activePrompt === 'RHYTHM_CHECK' && next.rhythmCheckStartedAt != null
      ? Math.max(0, Math.ceil((next.rhythmCheckStartedAt + RHYTHM_CHECK_MS - now) / 1000))
      : 0;

  // 3. Rhythm-check pause has gone past 10 seconds -> urgent alert (once).
  if (
    next.activePrompt === 'RHYTHM_CHECK' &&
    rhythmCheckTimeLeft === 0 &&
    (prev.activePrompt !== 'RHYTHM_CHECK' || prev.rhythmCheckTimeLeft > 0)
  ) {
    next = withAlert(next, prev, 'urgent');
  }

  // 4. Epinephrine due while compressions are running and nothing else is on screen.
  if (next.isTimerRunning && !next.roscAt && epiTimeLeft === 0 && next.activePrompt === null) {
    next = withAlert({ ...next, activePrompt: 'EPI_DUE' }, prev, 'epi');
  }

  let epiDueElapsed = 0;
  if (next.activePrompt === 'EPI_DUE') {
    epiDueElapsed = Math.max(0, Math.floor((now - epiDueAt) / 1000));
    if (
      prev.activePrompt === 'EPI_DUE' &&
      Math.floor(epiDueElapsed / EPI_REALERT_SECONDS) > Math.floor((prev.epiDueElapsed ?? 0) / EPI_REALERT_SECONDS)
    ) {
      next = withAlert(next, prev, 'epi');
    }
  }

  next = { ...next, totalTime, cprTimeLeft, epiTimeLeft, rhythmCheckTimeLeft, epiDueElapsed, roscElapsedSeconds };

  const unchanged =
    next.totalTime === prev.totalTime &&
    next.cprTimeLeft === prev.cprTimeLeft &&
    next.epiTimeLeft === prev.epiTimeLeft &&
    next.rhythmCheckTimeLeft === prev.rhythmCheckTimeLeft &&
    next.epiDueElapsed === prev.epiDueElapsed &&
    next.roscElapsedSeconds === prev.roscElapsedSeconds &&
    next.activePrompt === prev.activePrompt &&
    next.isTimerRunning === prev.isTimerRunning &&
    next.cprEndsAt === prev.cprEndsAt &&
    next.alert === prev.alert;
  return unchanged ? prev : next;
}

// ---------------------------------------------------------------------------
// Actions. Each takes the current state and the time the button was pressed.
// ---------------------------------------------------------------------------

/** Start a new code: arrest clock starts, first rhythm check begins. */
export function startCode(prev: AclsState, now: number): AclsState {
  // Starting a new case while an arrest is active would erase the live
  // clinical timeline. Require the current arrest to be closed first.
  if (isCodeActive(prev)) return prev;

  return advanceClock(
    {
      ...prev,
      ...clearedClockFields(),
      codeStartedAt: now,
      arrestEpisodeNumber: 1,
      epiAnchorAt: now,
      rhythmCheckStartedAt: now,
      cprRemainingMs: CPR_MS,
      isTimerRunning: false,
      shocksCount: 0,
      epiCount: 0,
      currentRhythm: 'UNKNOWN',
      cprCycleCount: 0,
      logs: [],
      clinicalEvents: [],
      savedEventSequence: 0,
      showHsAndTs: false,
      amioCount: 0,
      lidoCount: 0,
      alert: null,
      activePrompt: 'RHYTHM_CHECK',
      rhythmCheckTimeLeft: RHYTHM_CHECK_SECONDS,
      totalTime: 0,
      cprTimeLeft: CPR_CYCLE_DURATION,
      epiTimeLeft: EPI_INTERVAL,
    },
    now
  );
}

/** If the patient is in ROSC, this is a re-arrest: resume the arrest clock. */
function reArrestIfInRosc(prev: AclsState, now: number): AclsState {
  if (!prev.roscAt) return prev;
  return {
    ...prev,
    roscPausedMs: (prev.roscPausedMs ?? 0) + (now - prev.roscAt),
    roscAt: null,
    // Each re-arrest after ROSC is a new arrest episode within the same code.
    arrestEpisodeNumber: (prev.arrestEpisodeNumber || 1) + 1,
    rhythmCheckCount: 0,
  };
}

/** Begin a fresh 2-minute CPR cycle (after a shock, "Begin CPR", or "next cycle"). */
export function startCprCycle(prev: AclsState, now: number): AclsState {
  // CPR is a child transition of an established arrest episode. Never create
  // an arrest implicitly from a CPR/shock action because that would produce
  // clinical events without a CODE_START boundary.
  if (!prev.codeStartedAt || prev.terminatedAt || prev.dispositionAt || prev.isTimerRunning) return prev;

  const base = reArrestIfInRosc(prev, now);
  return advanceClock(
    {
      ...base,
      cprEndsAt: now + CPR_MS,
      cprRemainingMs: CPR_MS,
      cprCycleCount: base.cprCycleCount + 1,
      isTimerRunning: true,
      activePrompt: base.activePrompt === 'EPI_DUE' ? 'EPI_DUE' : null,
      rhythmCheckStartedAt: null,
      rhythmCheckTimeLeft: 0,
    },
    now
  );
}

/** "Pause Code": hold the CPR cycle where it is. Arrest time and the epinephrine interval keep running. */
export function pauseCpr(prev: AclsState, now: number): AclsState {
  if (!prev.isTimerRunning) return prev;

  // Resolve timestamp boundaries before freezing the CPR cycle. If the UI
  // action lands exactly when the cycle expires, the required rhythm-check
  // transition must win over the pause action.
  const current = advanceClock(prev, now);
  if (!current.isTimerRunning) return current;

  const remaining =
    current.cprEndsAt != null
      ? Math.max(0, current.cprEndsAt - now)
      : current.cprRemainingMs ?? CPR_MS;

  return advanceClock(
    { ...current, isTimerRunning: false, cprEndsAt: null, cprRemainingMs: remaining },
    now
  );
}

/** "Resume Code": continue the held CPR cycle (or restart CPR after a re-arrest). */
export function resumeCpr(prev: AclsState, now: number): AclsState {
  if (prev.isTimerRunning) return prev;
  if (!prev.codeStartedAt || prev.roscAt || !prev.cprRemainingMs) {
    return startCprCycle(prev, now);
  }
  return advanceClock(
    {
      ...prev,
      isTimerRunning: true,
      cprEndsAt: now + prev.cprRemainingMs,
      activePrompt: prev.activePrompt === 'RHYTHM_CHECK' ? null : prev.activePrompt,
      rhythmCheckStartedAt: null,
      rhythmCheckTimeLeft: 0,
    },
    now
  );
}

/** Rhythm chosen at a rhythm check. Compressions stay on hold until the shock / "Begin CPR". */
export function selectRhythm(prev: AclsState, rhythm: PatientRhythm, now: number): AclsState {
  // A rhythm selection is valid only during the explicit rhythm-check pause.
  // Reject stale/double taps and background UI actions after the check is closed.
  if (!isCodeActive(prev) || prev.activePrompt !== 'RHYTHM_CHECK') return prev;

  const nextPrompt = rhythm === 'SHOCKABLE' ? 'SHOCK_ADVISED' : rhythm === 'NON_SHOCKABLE' ? 'EPI_ADVISED' : null;
  return advanceClock(
    {
      ...prev,
      currentRhythm: rhythm,
      activePrompt: nextPrompt,
      isTimerRunning: false,
      cprEndsAt: null,
      cprRemainingMs: CPR_MS,
      rhythmCheckStartedAt: null,
      rhythmCheckTimeLeft: 0,
      rhythmCheckCount: (prev.rhythmCheckCount ?? 0) + 1,
    },
    now
  );
}

/**
 * Shock delivered: count it and start a new CPR cycle immediately.
 *
 * Normally only valid right after a rhythm check showed VF/pVT. With
 * `override` (the clinician confirmed a shock outside that sequence, see
 * checkShock) it is still recorded: it interrupts whatever was running and
 * starts a fresh 2-minute cycle, because that is what happened at the bedside.
 */
export function deliverShock(prev: AclsState, now: number, opts: ActionOptions = {}): AclsState {
  if (!isCodeActive(prev)) return prev;
  if (!opts.override && checkShock(prev, now).ok === false) return prev;

  return startCprCycle(
    {
      ...prev,
      isTimerRunning: false,
      cprEndsAt: null,
      shocksCount: prev.shocksCount + 1,
      lastShockEnergyJ: prev.selectedEnergy,
      lastShockDefibType: prev.defibType,
      currentRhythm: 'SHOCKABLE',
      activePrompt: prev.activePrompt === 'EPI_DUE' ? 'EPI_DUE' : null,
    },
    now
  );
}

/**
 * Epinephrine given: the next 3-5 minute interval is timed from now.
 * Outside the usual sequence (see checkEpinephrine) it is only recorded with
 * `override`, i.e. after the clinician confirmed it really was given.
 */
export function giveEpinephrine(prev: AclsState, now: number, opts: ActionOptions = {}): AclsState {
  // Medication administration must always belong to an active arrest episode.
  if (!isCodeActive(prev)) return prev;
  if (!opts.override && checkEpinephrine(prev, now).ok === false) return prev;

  // Resolve timestamp-driven due state before recording the dose.
  const current = advanceClock(prev, now);

  return advanceClock(
    {
      ...current,
      epiCount: current.epiCount + 1,
      epiAnchorAt: now,
      epiDueElapsed: 0,
      activePrompt: current.activePrompt === 'EPI_DUE' ? null : current.activePrompt,
    },
    now
  );
}

/** Antiarrhythmics are for shock-refractory VF/pVT; outside that they need `override`. */
export function giveAmiodarone(prev: AclsState, opts: ActionOptions = {}): AclsState {
  if (!isCodeActive(prev)) return prev;
  if (!opts.override && checkAntiarrhythmic(prev, 'amiodarone').ok === false) return prev;

  return { ...prev, amioCount: (prev.amioCount ?? 0) + 1 };
}

export function giveLidocaine(prev: AclsState, opts: ActionOptions = {}): AclsState {
  if (!isCodeActive(prev)) return prev;
  if (!opts.override && checkAntiarrhythmic(prev, 'lidocaine').ok === false) return prev;

  return { ...prev, lidoCount: (prev.lidoCount ?? 0) + 1 };
}

/** ROSC confirmed: the arrest clock stops, CPR and drug reminders stop. */
export function confirmRosc(prev: AclsState, now: number): AclsState {
  if (!prev.codeStartedAt || prev.roscAt || prev.terminatedAt) return prev;
  return advanceClock(
    {
      ...prev,
      roscAt: now,
      isTimerRunning: false,
      cprEndsAt: null,
      cprRemainingMs: 0,
      activePrompt: null,
      rhythmCheckStartedAt: null,
      rhythmCheckTimeLeft: 0,
    },
    now
  );
}

/**
 * Stop resuscitation without ROSC: the code is closed and `now` is the time of
 * death. Every timer freezes; the case can then be saved and a new code
 * started. Only possible while the patient is in arrest.
 */
export function terminateResuscitation(prev: AclsState, now: number): AclsState {
  if (!isCodeActive(prev)) return prev;
  const current = advanceClock(prev, now);
  return {
    ...current,
    terminatedAt: now,
    totalTime: arrestSeconds(current, now),
    isTimerRunning: false,
    cprEndsAt: null,
    cprRemainingMs: 0,
    cprTimeLeft: 0,
    activePrompt: null,
    rhythmCheckStartedAt: null,
    rhythmCheckTimeLeft: 0,
    epiDueElapsed: 0,
    alert: prev.alert ?? null, // no alarm sound at the moment of stopping
  };
}

/**
 * Patient handed over / left after ROSC (cath lab, ICU, transfer, or died
 * after ROSC). Closes the case: the ROSC timer freezes and no re-arrest can be
 * added to this record. Only possible while the patient is in ROSC.
 */
export function recordDisposition(prev: AclsState, now: number, destination: DispositionDestination): AclsState {
  if (!prev.codeStartedAt || !prev.roscAt || prev.terminatedAt || prev.dispositionAt) return prev;
  const current = advanceClock(prev, now);
  return {
    ...current,
    dispositionAt: now,
    disposition: destination,
    roscElapsedSeconds: Math.max(0, Math.floor((now - prev.roscAt) / 1000)),
    isTimerRunning: false,
    activePrompt: null,
  };
}

/** Stop the clock without starting anything (used on sign-out). Values on screen freeze. */
export function stopClock(prev: AclsState): AclsState {
  // Session termination is intentionally not a clinical transition. It clears
  // live timing only; the saved event history remains untouched.
  return {
    ...prev,
    codeStartedAt: null,
    cprEndsAt: null,
    rhythmCheckStartedAt: null,
    isTimerRunning: false,
    activePrompt: null,
    rhythmCheckTimeLeft: 0,
  };
}

export function amiodaroneDoseLabel(doseNumber: number): string {
  if (doseNumber <= 1) return '300 mg';
  return doseNumber === 2 ? '150 mg' : 'additional dose';
}

export function lidocaineDoseLabel(doseNumber: number): string {
  if (doseNumber <= 1) return '1-1.5 mg/kg';
  return doseNumber === 2 ? '0.5-0.75 mg/kg' : 'additional dose';
}

// ---------------------------------------------------------------------------
// Sequence checks.
//
// The app records what the team actually did. When an action falls outside
// the usual AHA sequence, these say why, so the screen can ask "record it
// anyway?" instead of silently refusing. A confirmed action is recorded with
// the reason attached (protocolNote), so the record is complete and honest.
// ---------------------------------------------------------------------------

export interface ActionOptions {
  /** The clinician confirmed the action really happened despite the check. */
  override?: boolean;
}

export interface ActionCheck {
  /** True when the action fits the usual sequence. */
  ok: boolean;
  /** Plain-language reason it was flagged. */
  reason?: string;
  /** False when it cannot be recorded at all right now (e.g. no code running). */
  canRecord: boolean;
}

const FITS: ActionCheck = { ok: true, canRecord: true };
const flagged = (reason: string): ActionCheck => ({ ok: false, reason, canRecord: true });
const notNow = (reason: string): ActionCheck => ({ ok: false, reason, canRecord: false });

function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Why nothing can be recorded against the patient's arrest right now. */
function noArrestReason(s: AclsState): string {
  if (!s.codeStartedAt) return 'No code is running. Start the code first.';
  if (s.terminatedAt) return 'Resuscitation has already been stopped for this case.';
  return 'The patient is in ROSC. If they have re-arrested, tap "Re-Arrest: Restart CPR" first.';
}

/**
 * Is the selected shock energy in line with the 2025 AHA algorithm?
 * Biphasic: manufacturer's dose (e.g. initial 120-200 J; maximum if unknown),
 * second and subsequent doses the same or higher. Monophasic: 360 J.
 * Returns the reason it is unusual, or null.
 */
export function shockEnergyConcern(prev: AclsState): string | null {
  const energy = prev.selectedEnergy;
  if (prev.defibType === 'MONOPHASIC' && energy !== MONOPHASIC_J) {
    return `Monophasic shocks are given at ${MONOPHASIC_J} J (selected ${energy} J).`;
  }
  if (
    prev.lastShockEnergyJ != null &&
    prev.lastShockDefibType === prev.defibType &&
    energy < prev.lastShockEnergyJ
  ) {
    return `${energy} J is lower than the previous shock (${prev.lastShockEnergyJ} J). AHA: second and subsequent biphasic shocks should follow the device/manufacturer strategy; equivalent or higher energy may be used.`;
  }
  return null;
}

export function checkShock(prev: AclsState, now: number): ActionCheck {
  if (!isCodeActive(prev)) return notNow(noArrestReason(prev));
  const s = advanceClock(prev, now);
  let sequence: string | null = null;
  if (s.activePrompt === 'SHOCK_ADVISED' && s.currentRhythm === 'SHOCKABLE' && !s.isTimerRunning) sequence = null;
  else if (s.activePrompt === 'RHYTHM_CHECK') sequence = 'The rhythm for this rhythm check has not been recorded yet.';
  else if (s.isTimerRunning) sequence = `A CPR cycle is running (${mmss(s.cprTimeLeft)} left). Shocks are usually given right after a rhythm check shows VF/pVT.`;
  else if (s.currentRhythm !== 'SHOCKABLE') sequence = 'No shockable rhythm (VF/pVT) is recorded at the last rhythm check.';
  else sequence = 'No rhythm check is in progress. Shocks are usually given right after a rhythm check shows VF/pVT.';

  const reasons = [sequence, shockEnergyConcern(s)].filter((r): r is string => Boolean(r));
  return reasons.length === 0 ? FITS : flagged(reasons.join(' '));
}

/**
 * Advanced airway placed (or its placement confirmed with waveform
 * capnography). Stays in place for the rest of the code, across ROSC and
 * re-arrest. Only while the code is open.
 */
export function recordAirway(
  prev: AclsState,
  now: number,
  device: AdvancedAirwayDevice,
  confirmedByCapnography: boolean,
): AclsState {
  if (!prev.codeStartedAt || prev.terminatedAt || prev.dispositionAt) return prev;
  const existing = prev.advancedAirway;
  const sameDevice = existing != null && existing.device === device;
  // Confirming the airway already in place keeps its placement time;
  // a different device (e.g. SGA exchanged for an ETT) is a new placement.
  const at = sameDevice ? existing!.at : now;
  const confirmed = confirmedByCapnography || (sameDevice && existing!.confirmedByCapnography);
  if (sameDevice && existing!.confirmedByCapnography === confirmed) return prev; // nothing new
  return { ...prev, advancedAirway: { device, at, confirmedByCapnography: confirmed } };
}

export function checkEpinephrine(prev: AclsState, now: number): ActionCheck {
  if (!isCodeActive(prev)) return notNow(noArrestReason(prev));
  const s = advanceClock(prev, now);
  if (s.currentRhythm === 'SHOCKABLE' && s.shocksCount < 2 && s.epiCount === 0) {
    return flagged(`In VF/pVT, AHA gives the first epinephrine after the 2nd shock (shocks so far: ${s.shocksCount}).`);
  }
  if (s.epiCount > 0 && s.epiTimeLeft > 0) {
    const sinceLast = (now - (s.epiAnchorAt ?? now)) / 1000;
    return flagged(`The last epinephrine dose was ${mmss(sinceLast)} ago. AHA interval is every 3-5 minutes (next due in ${mmss(s.epiTimeLeft)}).`);
  }
  return FITS;
}

export function checkAntiarrhythmic(prev: AclsState, drug: 'amiodarone' | 'lidocaine'): ActionCheck {
  if (!isCodeActive(prev)) return notNow(noArrestReason(prev));
  const name = drug === 'amiodarone' ? 'Amiodarone' : 'Lidocaine';
  const given = (drug === 'amiodarone' ? prev.amioCount : prev.lidoCount) ?? 0;
  const max = drug === 'amiodarone' ? AMIODARONE_MAX_DOSES : LIDOCAINE_MAX_DOSES;
  if (given >= max) {
    return flagged(`${name} has already been given ${given} times. The AHA cardiac-arrest algorithm uses at most ${max} doses.`);
  }
  if (prev.currentRhythm !== 'SHOCKABLE') {
    return flagged(`${name} is for VF/pVT that persists after shocks, and the current rhythm is not recorded as shockable.`);
  }
  if (prev.shocksCount < 3) {
    return flagged(`AHA gives the first antiarrhythmic dose after the 3rd shock (shocks so far: ${prev.shocksCount}).`);
  }
  return FITS;
}
