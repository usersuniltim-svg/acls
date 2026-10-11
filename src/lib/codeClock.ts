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
/** Plausibility bounds for a typed energy (typing-error check, not an AHA limit). */
export const PLAUSIBLE_MIN_J = 100;
export const PLAUSIBLE_MAX_J = 360;
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

/**
 * Arrest time in the current episode only, in whole seconds: from code start
 * (episode 1) or from the latest re-arrest. An episode never contains ROSC,
 * so this is plain elapsed time, stopping at ROSC or when resuscitation stops.
 */
export function episodeArrestSeconds(s: AclsState, now: number): number {
  if (!s.codeStartedAt) return 0;
  const start = s.arrestEpisodeStartedAt ?? s.codeStartedAt;
  const end = s.roscAt ?? s.terminatedAt ?? now;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Fields that describe a code in progress, all cleared. */
export function clearedClockFields(): Partial<AclsState> {
  return {
    codeStartedAt: null,
    arrestEpisodeNumber: 0,
    arrestEpisodeStartedAt: null,
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
    pauseElapsedSeconds: 0,
    epiAnchorAt: null,
    episodeSecondShockAt: null,
    rhythmCheckCount: 0,
    epiDueElapsed: 0,
    lastAntiarrhythmicShockCount: null,
  };
}

/** Prompts during which compressions are stopped for a rhythm check or acting on its result. */
const PAUSE_PROMPTS: ReadonlySet<AclsState['activePrompt']> = new Set(['RHYTHM_CHECK', 'SHOCK_ADVISED', 'EPI_ADVISED']);
const inRhythmPause = (s: AclsState) =>
  PAUSE_PROMPTS.has(s.activePrompt) && !s.isTimerRunning && s.rhythmCheckStartedAt != null;

/**
 * Why the first epinephrine dose is not due yet, or null if the normal
 * 3-minute timer applies.
 *  - 'RHYTHM': no dose yet and the rhythm is not known (start of the code, or a
 *    re-arrest): the rhythm decides when the first dose is due.
 *  - 'SECOND_SHOCK': no dose yet in VF/pVT and fewer than 2 shocks in this
 *    episode. 2025 AHA: with a shockable rhythm, epinephrine is given after
 *    initial defibrillation attempts have failed, i.e. after the 2nd shock.
 */
export function epinephrineWait(s: AclsState): 'RHYTHM' | 'SECOND_SHOCK' | null {
  if (s.epiCount > 0) return null;
  if (s.currentRhythm === 'UNKNOWN') return 'RHYTHM';
  if (s.currentRhythm === 'SHOCKABLE' && (s.episodeShocksCount ?? 0) < 2) return 'SECOND_SHOCK';
  return null;
}

/** When the next epinephrine dose is due, or null while it waits for the rhythm or the 2nd shock. */
export function epinephrineDueAt(s: AclsState): number | null {
  if (!s.codeStartedAt || epinephrineWait(s)) return null;
  // VF/pVT, first dose: due at the 2nd shock of this episode.
  if (s.epiCount === 0 && s.currentRhythm === 'SHOCKABLE' && s.episodeSecondShockAt != null) {
    return s.episodeSecondShockAt;
  }
  return (s.epiAnchorAt ?? s.codeStartedAt) + EPI_MS;
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
  // long ROSC, a re-arrest finds the next dose already due. Before the first
  // dose, the rhythm decides (see epinephrineWait): in VF/pVT it falls due at
  // the 2nd shock, never before.
  const epiDueAt = epinephrineDueAt(next);
  const epiTimeLeft = epiDueAt == null ? EPI_INTERVAL : Math.max(0, Math.ceil((epiDueAt - now) / 1000));
  const roscElapsedSeconds = next.roscAt ? Math.max(0, Math.floor((now - next.roscAt) / 1000)) : 0;
  // The hands-off pause runs from the end of compressions for a rhythm check
  // until compressions restart: the check itself, then the shock or the
  // epinephrine that follows it.
  const pausing = inRhythmPause(next);
  const rhythmCheckTimeLeft = pausing
    ? Math.max(0, Math.ceil((next.rhythmCheckStartedAt! + RHYTHM_CHECK_MS - now) / 1000))
    : 0;
  const pauseElapsedSeconds = pausing ? Math.max(0, Math.floor((now - next.rhythmCheckStartedAt!) / 1000)) : 0;

  // 3. The hands-off pause has gone past 10 seconds -> urgent alert (once per pause).
  const alreadyAlerted =
    inRhythmPause(prev) && prev.rhythmCheckStartedAt === next.rhythmCheckStartedAt && prev.rhythmCheckTimeLeft === 0;
  if (pausing && rhythmCheckTimeLeft === 0 && !alreadyAlerted) {
    next = withAlert(next, prev, 'urgent');
  }

  // 4. Epinephrine due while compressions are running and nothing else is on screen.
  if (next.isTimerRunning && !next.roscAt && epiTimeLeft === 0 && epiDueAt != null && next.activePrompt === null) {
    next = withAlert({ ...next, activePrompt: 'EPI_DUE' }, prev, 'epi');
  }
  if (next.activePrompt === 'EPI_DUE' && epiDueAt == null) next = { ...next, activePrompt: null };

  let epiDueElapsed = 0;
  if (next.activePrompt === 'EPI_DUE' && epiDueAt != null) {
    epiDueElapsed = Math.max(0, Math.floor((now - epiDueAt) / 1000));
    if (
      prev.activePrompt === 'EPI_DUE' &&
      Math.floor(epiDueElapsed / EPI_REALERT_SECONDS) > Math.floor((prev.epiDueElapsed ?? 0) / EPI_REALERT_SECONDS)
    ) {
      next = withAlert(next, prev, 'epi');
    }
  }

  next = { ...next, totalTime, cprTimeLeft, epiTimeLeft, rhythmCheckTimeLeft, pauseElapsedSeconds, epiDueElapsed, roscElapsedSeconds };

  const unchanged =
    next.totalTime === prev.totalTime &&
    next.cprTimeLeft === prev.cprTimeLeft &&
    next.epiTimeLeft === prev.epiTimeLeft &&
    next.rhythmCheckTimeLeft === prev.rhythmCheckTimeLeft &&
    (next.pauseElapsedSeconds ?? 0) === (prev.pauseElapsedSeconds ?? 0) &&
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

/**
 * Start a new code: the arrest clock starts and CPR begins at once, as in
 * step 1 of the 2025 AHA algorithm (start CPR, attach the monitor/defibrillator).
 * The first rhythm check opens with analyzeRhythmNow as soon as the pads are
 * on, or by itself when this first 2-minute cycle ends.
 */
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
      arrestEpisodeStartedAt: now,
      epiAnchorAt: now,
      rhythmCheckStartedAt: null,
      cprEndsAt: now + CPR_MS,
      cprRemainingMs: CPR_MS,
      isTimerRunning: true,
      shocksCount: 0,
      episodeShocksCount: 0,
      epiCount: 0,
      currentRhythm: 'UNKNOWN',
      cprCycleCount: 1,
      logs: [],
      clinicalEvents: [],
      savedEventSequence: 0,
      showHsAndTs: false,
      amioCount: 0,
      lidoCount: 0,
      alert: null,
      activePrompt: null,
      rhythmCheckTimeLeft: 0,
      totalTime: 0,
      cprTimeLeft: CPR_CYCLE_DURATION,
      epiTimeLeft: EPI_INTERVAL,
    },
    now
  );
}

/**
 * "Analyze rhythm now" is offered from the start of an arrest episode until
 * its first rhythm check: the pads are on, so the team need not wait for the
 * 2-minute cycle to end. Later checks follow the 2-minute cycles.
 */
export function canAnalyzeRhythmNow(s: AclsState): boolean {
  return isCodeActive(s) && (s.rhythmCheckCount ?? 0) === 0 && !PAUSE_PROMPTS.has(s.activePrompt);
}

/** Pads are on: stop compressions and open the first rhythm check of this episode. */
export function analyzeRhythmNow(prev: AclsState, now: number): AclsState {
  if (!canAnalyzeRhythmNow(prev)) return prev;
  // If the CPR cycle ends at this very moment, its own rhythm check stands.
  const current = advanceClock(prev, now);
  if (!canAnalyzeRhythmNow(current)) return current;
  return advanceClock(
    {
      ...current,
      isTimerRunning: false,
      cprEndsAt: null,
      cprRemainingMs: 0,
      activePrompt: 'RHYTHM_CHECK',
      rhythmCheckStartedAt: now,
      rhythmCheckTimeLeft: RHYTHM_CHECK_SECONDS,
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
    arrestEpisodeStartedAt: now,
    // Never carry the prior episode's rhythm or shock-sequence eligibility
    // into a new arrest. Total case counts and drug exposure remain cumulative.
    currentRhythm: 'UNKNOWN',
    episodeShocksCount: 0,
    episodeSecondShockAt: null,
    lastShockEnergyJ: null,
    lastShockDefibType: null,
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
  if (prev.isTimerRunning || prev.terminatedAt || prev.dispositionAt) return prev;
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

/**
 * Rhythm chosen at a rhythm check. Compressions stay on hold until the shock /
 * "Begin CPR", and the hands-off pause that began with the check keeps being
 * timed until then.
 */
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
      rhythmCheckStartedAt: nextPrompt ? prev.rhythmCheckStartedAt ?? now : null,
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

  const episodeShocks = (prev.episodeShocksCount ?? 0) + 1;
  return startCprCycle(
    {
      ...prev,
      isTimerRunning: false,
      cprEndsAt: null,
      shocksCount: prev.shocksCount + 1,
      episodeShocksCount: episodeShocks,
      episodeSecondShockAt: episodeShocks === 2 ? now : prev.episodeSecondShockAt ?? null,
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

  return { ...prev, amioCount: (prev.amioCount ?? 0) + 1, lastAntiarrhythmicShockCount: prev.shocksCount };
}

export function giveLidocaine(prev: AclsState, opts: ActionOptions = {}): AclsState {
  if (!isCodeActive(prev)) return prev;
  if (!opts.override && checkAntiarrhythmic(prev, 'lidocaine').ok === false) return prev;

  return { ...prev, lidoCount: (prev.lidoCount ?? 0) + 1, lastAntiarrhythmicShockCount: prev.shocksCount };
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
  if (s.dispositionAt) return 'This case was closed at disposition. Save it, then start a new code for a new arrest.';
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
  // Not an AHA rule: a check for typing errors in a custom energy. Adult
  // external defibrillators are typically set between 120 and 360 J for
  // cardiac arrest and do not go above 360 J.
  if (energy < PLAUSIBLE_MIN_J || energy > PLAUSIBLE_MAX_J) {
    return `${energy} J is unusual for an adult cardiac-arrest shock (devices are typically set between 120 and 360 J). Check that it was entered correctly.`;
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
  const episodeShocks = s.episodeShocksCount ?? 0;
  if (epinephrineWait(s) === 'RHYTHM') {
    return flagged('The rhythm has not been checked yet. AHA times the first epinephrine by the rhythm: as soon as possible for asystole/PEA, after the 2nd shock for VF/pVT.');
  }
  if (s.currentRhythm === 'SHOCKABLE' && episodeShocks < 2 && s.epiCount === 0) {
    return flagged(`In VF/pVT, AHA gives the first epinephrine after the 2nd shock in this arrest episode (episode shocks so far: ${episodeShocks}).`);
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
  const episodeShocks = prev.episodeShocksCount ?? 0;
  if (episodeShocks < 3) {
    return flagged(`AHA gives an antiarrhythmic for shock-refractory VF/pVT after the 3rd shock in the current arrest episode (episode shocks so far: ${episodeShocks}).`);
  }
  // 2025 AHA: amiodarone OR lidocaine, not both.
  const otherGiven = (drug === 'amiodarone' ? prev.lidoCount : prev.amioCount) ?? 0;
  if (otherGiven > 0) {
    const other = drug === 'amiodarone' ? 'Lidocaine' : 'Amiodarone';
    return flagged(`${other} has already been given. AHA uses amiodarone or lidocaine, not both.`);
  }
  // A second dose is for VF/pVT that persists after further shocks.
  if (given > 0 && prev.lastAntiarrhythmicShockCount != null && prev.shocksCount <= prev.lastAntiarrhythmicShockCount) {
    return flagged(`No shock has been given since the last ${name.toLowerCase()} dose. The second dose is for VF/pVT that persists after further shocks.`);
  }
  return FITS;
}

/**
 * The first antiarrhythmic dose is due: VF/pVT still present after the 3rd
 * shock of this arrest episode and none given yet in this code. The dashboard
 * highlights the drug buttons with this, so it agrees with checkAntiarrhythmic.
 */
export function antiarrhythmicDue(s: AclsState): boolean {
  return (
    isCodeActive(s) &&
    s.currentRhythm === 'SHOCKABLE' &&
    (s.episodeShocksCount ?? 0) >= 3 &&
    (s.amioCount ?? 0) + (s.lidoCount ?? 0) === 0
  );
}
