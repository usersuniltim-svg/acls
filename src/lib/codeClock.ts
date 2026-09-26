import { AclsState, PatientRhythm } from '../types';
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
export const LIDOCAINE_MAX_DOSES = 3; // 1-1.5 mg/kg, then 0.5-0.75 mg/kg; max total 3 mg/kg

type AlertKind = NonNullable<AclsState['alert']>['kind'];
const ALERT_PRIORITY: Record<AlertKind, number> = { urgent: 3, cycleEnd: 2, epi: 1 };

function withAlert(state: AclsState, prev: AclsState, kind: AlertKind): AclsState {
  // If two alerts fall in the same tick, keep the more important one.
  if (state.alert && state.alert.seq !== prev.alert?.seq && ALERT_PRIORITY[state.alert.kind] >= ALERT_PRIORITY[kind]) {
    return state;
  }
  return { ...state, alert: { seq: (prev.alert?.seq ?? 0) + 1, kind } };
}

export function isCodeActive(s: AclsState): boolean {
  return Boolean(s.codeStartedAt) && !s.roscAt;
}

/** Arrest time in whole seconds (stops at ROSC, excludes time spent in ROSC). */
export function arrestSeconds(s: AclsState, now: number): number {
  if (!s.codeStartedAt) return s.totalTime;
  const end = s.roscAt ?? now;
  return Math.max(0, Math.floor((end - s.codeStartedAt - (s.roscPausedMs ?? 0)) / 1000));
}

/** Fields that describe a code in progress, all cleared. */
export function clearedClockFields(): Partial<AclsState> {
  return {
    codeStartedAt: null,
    roscAt: null,
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
  if (!prev.codeStartedAt) return prev;
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
  const arrestNow = next.roscAt ?? now;
  const totalTime = arrestSeconds(next, now);
  const cprTimeLeft =
    next.cprEndsAt != null
      ? Math.max(0, Math.ceil((next.cprEndsAt - now) / 1000))
      : Math.ceil((next.cprRemainingMs ?? CPR_MS) / 1000);
  const epiDueAt = (next.epiAnchorAt ?? next.codeStartedAt!) + EPI_MS;
  const epiTimeLeft = Math.max(0, Math.ceil((epiDueAt - arrestNow) / 1000));
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
    epiDueElapsed = Math.max(0, Math.floor((arrestNow - epiDueAt) / 1000));
    if (
      prev.activePrompt === 'EPI_DUE' &&
      Math.floor(epiDueElapsed / EPI_REALERT_SECONDS) > Math.floor((prev.epiDueElapsed ?? 0) / EPI_REALERT_SECONDS)
    ) {
      next = withAlert(next, prev, 'epi');
    }
  }

  next = { ...next, totalTime, cprTimeLeft, epiTimeLeft, rhythmCheckTimeLeft, epiDueElapsed };

  const unchanged =
    next.totalTime === prev.totalTime &&
    next.cprTimeLeft === prev.cprTimeLeft &&
    next.epiTimeLeft === prev.epiTimeLeft &&
    next.rhythmCheckTimeLeft === prev.rhythmCheckTimeLeft &&
    next.epiDueElapsed === prev.epiDueElapsed &&
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
  return advanceClock(
    {
      ...prev,
      ...clearedClockFields(),
      codeStartedAt: now,
      epiAnchorAt: now,
      rhythmCheckStartedAt: now,
      cprRemainingMs: CPR_MS,
      isTimerRunning: false,
      cprCycleCount: 0,
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
    rhythmCheckCount: 0,
  };
}

/** Begin a fresh 2-minute CPR cycle (after a shock, "Begin CPR", or "next cycle"). */
export function startCprCycle(prev: AclsState, now: number): AclsState {
  const base = prev.codeStartedAt ? reArrestIfInRosc(prev, now) : { ...prev, codeStartedAt: now, epiAnchorAt: now };
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
  const remaining = prev.cprEndsAt != null ? Math.max(0, prev.cprEndsAt - now) : prev.cprRemainingMs ?? CPR_MS;
  return advanceClock({ ...prev, isTimerRunning: false, cprEndsAt: null, cprRemainingMs: remaining }, now);
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

/** Shock delivered: count it and start a new CPR cycle immediately. */
export function deliverShock(prev: AclsState, now: number): AclsState {
  return startCprCycle({ ...prev, shocksCount: prev.shocksCount + 1, currentRhythm: 'SHOCKABLE' }, now);
}

/** Epinephrine given: the next 3-5 minute interval is timed from now. */
export function giveEpinephrine(prev: AclsState, now: number): AclsState {
  return advanceClock(
    {
      ...prev,
      epiCount: prev.epiCount + 1,
      epiAnchorAt: now,
      epiDueElapsed: 0,
      activePrompt: prev.activePrompt === 'EPI_DUE' ? null : prev.activePrompt,
    },
    now
  );
}

export function giveAmiodarone(prev: AclsState): AclsState {
  return { ...prev, amioCount: Math.min(AMIODARONE_MAX_DOSES, (prev.amioCount ?? 0) + 1) };
}

export function giveLidocaine(prev: AclsState): AclsState {
  return { ...prev, lidoCount: Math.min(LIDOCAINE_MAX_DOSES, (prev.lidoCount ?? 0) + 1) };
}

/** ROSC confirmed: the arrest clock stops, CPR and drug reminders stop. */
export function confirmRosc(prev: AclsState, now: number): AclsState {
  if (!prev.codeStartedAt || prev.roscAt) return prev;
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

/** Stop the clock without starting anything (used on sign-out). Values on screen freeze. */
export function stopClock(prev: AclsState): AclsState {
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
  return doseNumber <= 1 ? '300 mg' : '150 mg';
}

export function lidocaineDoseLabel(doseNumber: number): string {
  return doseNumber <= 1 ? '1-1.5 mg/kg' : '0.5-0.75 mg/kg';
}
