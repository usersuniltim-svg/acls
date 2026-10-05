/**
 * Clinical actions: each one is a clock transition plus the audit event it
 * produces, applied together so a rejected action never leaves an event and
 * an accepted one always does.
 *
 * Pure (state in, state out). The screen adds confirmations, sound and
 * vibration around these; the scenario tests drive exactly the same code.
 */
import type {
  AclsState,
  AdvancedAirwayDevice,
  ClinicalEventKind,
  DispositionDestination,
  EventType,
  LogEvent,
  PatientRhythm,
} from '../types';
import { createClinicalEvent } from './clinicalEvents';
import {
  AMIODARONE_MAX_DOSES,
  LIDOCAINE_MAX_DOSES,
  type ActionOptions,
  amiodaroneDoseLabel,
  arrestSeconds,
  confirmRosc,
  episodeArrestSeconds,
  deliverShock,
  giveAmiodarone,
  giveEpinephrine,
  giveLidocaine,
  lidocaineDoseLabel,
  pauseCpr,
  recordAirway,
  recordDisposition,
  resumeCpr,
  selectRhythm,
  startCode,
  startCprCycle,
  terminateResuscitation,
} from './codeClock';

export interface RecordingActor {
  actorId?: string;
  actorName?: string;
}

export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

/** Text appended to a log line for an action recorded outside the usual sequence. */
export const deviationSuffix = (note?: string) => (note ? ` [Recorded outside usual AHA sequence: ${note}]` : '');

let logCounter = 0;
const logId = () => `${Date.now().toString(36)}${(logCounter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function nextSequence(s: AclsState): number {
  return s.clinicalEvents.length > 0 ? Math.max(...s.clinicalEvents.map(e => e.sequence)) + 1 : 1;
}

/** Events recorded during a code carry the arrest episode they happened in. */
function withEpisode(s: AclsState, payload: Record<string, unknown>): Record<string, unknown> {
  if (!s.codeStartedAt || payload.arrestEpisodeNumber != null) return payload;
  return { ...payload, arrestEpisodeNumber: s.arrestEpisodeNumber || 1 };
}

export interface RecordInput {
  type: EventType;
  kind: ClinicalEventKind;
  description: string;
  payload?: Record<string, unknown>;
  timestamp: number;
  source?: 'user' | 'system' | 'import';
}

/** Append one event (and its legacy log line) to the record, without a clock transition. */
export function appendRecord(prev: AclsState, rec: RecordInput, actor: RecordingActor = {}): AclsState {
  const log: LogEvent = { id: logId(), timestamp: rec.timestamp, type: rec.type, description: rec.description };
  const event = createClinicalEvent({
    kind: rec.kind,
    timestamp: rec.timestamp,
    source: rec.source ?? 'user',
    actorId: actor.actorId,
    actorName: actor.actorName,
    payload: withEpisode(prev, rec.payload ?? {}) as any,
    description: rec.description,
  }, nextSequence(prev));
  return { ...prev, logs: [log, ...prev.logs], clinicalEvents: [...prev.clinicalEvents, event] };
}

export interface ActionSpec {
  type: EventType;
  kind: ClinicalEventKind;
  transition: (prev: AclsState, now: number) => AclsState;
  description: (prev: AclsState, next: AclsState, now: number) => string;
  payload: (prev: AclsState, next: AclsState, now: number) => Record<string, unknown>;
  /** Return false to apply the transition without an event (e.g. a pause that became a rhythm check). */
  shouldRecord?: (prev: AclsState, next: AclsState) => boolean;
}

/**
 * Apply a transition and record its event in one step. If the transition
 * rejects the action (returns the same state), nothing is recorded.
 * The event is appended to the transition's result, not to `prev`: starting
 * a new code clears the previous patient's events and they must not return.
 */
export function applyAction(prev: AclsState, spec: ActionSpec, now: number, actor: RecordingActor = {}): AclsState {
  const next = spec.transition(prev, now);
  if (next === prev) return prev;
  if (spec.shouldRecord && !spec.shouldRecord(prev, next)) return next;
  return appendRecord(next, {
    type: spec.type,
    kind: spec.kind,
    description: spec.description(prev, next, now),
    payload: spec.payload(prev, next, now),
    timestamp: now,
  }, actor);
}

// ---------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------

export const startCodeAction = (): ActionSpec => ({
  type: 'CPR_START',
  kind: 'CODE_START',
  transition: startCode,
  description: () => 'Resuscitation started - Initial 10s Rhythm Assessment evaluation started.',
  payload: (_p, next) => ({ reason: 'user_started_resuscitation', initialRhythmAssessment: true, arrestEpisodeNumber: next.arrestEpisodeNumber }),
});

export const pauseAction = (): ActionSpec => ({
  type: 'INFO',
  kind: 'CPR_PAUSE',
  transition: pauseCpr,
  description: (prev) => `Compressions paused - CPR cycle held at ${formatClock(prev.cprTimeLeft)}`,
  payload: (prev, next) => ({ cprCycle: prev.cprCycleCount, remainingSeconds: prev.cprTimeLeft, arrestEpisodeNumber: next.arrestEpisodeNumber }),
  // At the exact CPR deadline the pause becomes a rhythm check: no pause event.
  shouldRecord: (_p, next) => next.activePrompt !== 'RHYTHM_CHECK',
});

/** CPR restarted while the patient was in ROSC: a re-arrest, the start of the next episode. */
const reArrestAction = (transition: ActionSpec['transition']): ActionSpec => ({
  type: 'CPR_START',
  kind: 'RE_ARREST',
  transition,
  description: (prev, next, now) => `Re-arrest after ROSC - arrest episode ${next.arrestEpisodeNumber} begins, CPR restarted (arrest time so far ${formatClock(arrestSeconds(prev, prev.roscAt ?? now))})`,
  payload: (prev, next, now) => ({
    priorArrestSeconds: arrestSeconds(prev, prev.roscAt ?? now),
    cprCycleNumber: next.cprCycleCount,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
  }),
});

/** "Resume Code": resumes held CPR, or (in ROSC) records a re-arrest. */
export const resumeAction = (prev: AclsState): ActionSpec => (prev.roscAt ? reArrestAction(resumeCpr) : {
  type: 'INFO',
  kind: 'CPR_RESUME',
  transition: resumeCpr,
  description: () => 'Compressions resumed',
  payload: (p, next) => ({ cprCycle: p.cprCycleCount, arrestEpisodeNumber: next.arrestEpisodeNumber }),
});

/**
 * "Next CPR cycle" / "Begin CPR". In ROSC, starting CPR is a re-arrest and is
 * recorded as one (it used to be recorded as a plain CPR start, leaving the
 * new episode without its RE_ARREST event).
 */
export const cprCycleAction = (prev: AclsState): ActionSpec => (prev.roscAt ? reArrestAction(startCprCycle) : {
  type: 'CPR_START',
  kind: 'CPR_START',
  transition: startCprCycle,
  description: (_p, next) => `CPR Cycle #${next.cprCycleCount} started`,
  payload: (_p, next) => ({ cycleNumber: next.cprCycleCount }),
});

export const rhythmAction = (rhythm: PatientRhythm): ActionSpec => ({
  type: 'RHYTHM_CHECK',
  kind: 'RHYTHM_CHECK',
  transition: (prev, now) => selectRhythm(prev, rhythm, now),
  description: (_p, next) => {
    const label = rhythm === 'SHOCKABLE'
      ? 'VF / pulseless VT (shockable)'
      : rhythm === 'NON_SHOCKABLE'
        ? 'Asystole / PEA (non-shockable)'
        : rhythm;
    return `Rhythm check #${next.rhythmCheckCount}: ${label}`;
  },
  payload: (prev, next, now) => ({
    checkNumber: next.rhythmCheckCount ?? 0,
    rhythm,
    startedAt: prev.rhythmCheckStartedAt ?? now,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
  }),
});

export const shockAction = (opts: ActionOptions = {}, note?: string): ActionSpec => ({
  type: 'SHOCK',
  kind: 'SHOCK',
  transition: (prev, now) => deliverShock(prev, now, opts),
  description: (prev, next) => `Defibrillation administered: ${prev.selectedEnergy}J (Shock #${next.shocksCount}) - Resuming CPR Cycle immediately${deviationSuffix(note)}`,
  payload: (prev, next) => ({
    energyJ: prev.selectedEnergy,
    defibType: prev.defibType,
    shockNumber: next.shocksCount,
    cprCycleNumber: next.cprCycleCount,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
    ...(note ? { protocolNote: note } : {}),
  }),
});

export const epinephrineAction = (opts: ActionOptions = {}, note?: string): ActionSpec => ({
  type: 'DRUG_EPI',
  kind: 'EPINEPHRINE',
  transition: (prev, now) => giveEpinephrine(prev, now, opts),
  description: (_p, next) => `Administered 1mg Epinephrine IV/IO (Total Dose Count: #${next.epiCount}) - 3-5m countdown running${deviationSuffix(note)}`,
  payload: (_p, next) => ({
    doseMg: 1,
    route: 'IV/IO',
    doseNumber: next.epiCount,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
    ...(note ? { protocolNote: note } : {}),
  }),
});

const antiarrhythmicDescription = (name: string, label: string, dose: number, max: number, note?: string) =>
  (dose > max
    ? `${name} IV/IO - additional dose #${dose} (beyond the usual ${max}-dose maximum)`
    : `${name} ${label} IV/IO (dose ${dose} of ${max})`) + deviationSuffix(note);

export const amiodaroneAction = (opts: ActionOptions = {}, note?: string): ActionSpec => ({
  type: 'DRUG_AMIO',
  kind: 'AMIODARONE',
  transition: (prev) => giveAmiodarone(prev, opts),
  description: (_p, next) => antiarrhythmicDescription('Amiodarone', amiodaroneDoseLabel(next.amioCount ?? 0), next.amioCount ?? 0, AMIODARONE_MAX_DOSES, note),
  payload: (_p, next) => ({
    doseLabel: amiodaroneDoseLabel(next.amioCount ?? 0),
    route: 'IV/IO',
    doseNumber: next.amioCount ?? 0,
    maxDoses: AMIODARONE_MAX_DOSES,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
    ...(note ? { protocolNote: note } : {}),
  }),
});

export const lidocaineAction = (opts: ActionOptions = {}, note?: string): ActionSpec => ({
  type: 'DRUG_LIDO',
  kind: 'LIDOCAINE',
  transition: (prev) => giveLidocaine(prev, opts),
  description: (_p, next) => {
    const dose = next.lidoCount ?? 0;
    const base = dose > LIDOCAINE_MAX_DOSES
      ? `Lidocaine IV/IO - additional dose #${dose} (beyond the usual ${LIDOCAINE_MAX_DOSES}-dose maximum; max total 3 mg/kg)`
      : `Lidocaine ${lidocaineDoseLabel(dose)} IV/IO (dose ${dose}; max total 3 mg/kg)`;
    return base + deviationSuffix(note);
  },
  payload: (_p, next) => ({
    doseLabel: lidocaineDoseLabel(next.lidoCount ?? 0),
    route: 'IV/IO',
    doseNumber: next.lidoCount ?? 0,
    maxDoses: LIDOCAINE_MAX_DOSES,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
    ...(note ? { protocolNote: note } : {}),
  }),
});

/** "after 3:20 of arrest time", or for a later episode "in arrest episode 2 after 1:33 (3:20 total arrest time)". */
function roscTiming(prev: AclsState, now: number): string {
  const total = formatClock(arrestSeconds(prev, now));
  const episode = prev.arrestEpisodeNumber || 1;
  if (episode <= 1) return `after ${total} of arrest time`;
  return `in arrest episode ${episode} after ${formatClock(episodeArrestSeconds(prev, now))} (${total} total arrest time)`;
}

export const roscAction = (): ActionSpec => ({
  type: 'ROSC',
  kind: 'ROSC',
  transition: confirmRosc,
  description: (prev, _n, now) => `ROSC achieved ${roscTiming(prev, now)} - Initiating Post-Cardiac Arrest Care Protocol`,
  payload: (prev, next, now) => ({
    arrestDurationSeconds: arrestSeconds(prev, now),
    episodeArrestSeconds: episodeArrestSeconds(prev, now),
    arrestEpisodeNumber: next.arrestEpisodeNumber,
  }),
});

/** ROSC found at a rhythm check: the rhythm-check event and the ROSC are recorded together. */
export function applyRoscAtRhythmCheck(prev: AclsState, now: number, actor: RecordingActor = {}): AclsState {
  if (!prev.codeStartedAt || prev.roscAt || prev.terminatedAt || prev.activePrompt !== 'RHYTHM_CHECK') return prev;
  const checkNumber = (prev.rhythmCheckCount ?? 0) + 1;
  const next = confirmRosc({ ...prev, rhythmCheckCount: checkNumber }, now);
  if (next.roscAt == null) return prev;
  const withCheck = appendRecord(next, {
    type: 'RHYTHM_CHECK',
    kind: 'RHYTHM_CHECK',
    description: `Rhythm check #${checkNumber}: organized rhythm with pulse`,
    payload: { checkNumber, rhythm: 'ORGANIZED_WITH_PULSE', startedAt: prev.rhythmCheckStartedAt ?? now, arrestEpisodeNumber: next.arrestEpisodeNumber },
    timestamp: now,
  }, actor);
  return appendRecord(withCheck, {
    type: 'ROSC',
    kind: 'ROSC',
    description: `ROSC confirmed at rhythm check #${checkNumber} ${roscTiming(prev, now)} - Initiating Post-Cardiac Arrest Care Protocol`,
    payload: {
      arrestDurationSeconds: arrestSeconds(prev, now),
      episodeArrestSeconds: episodeArrestSeconds(prev, now),
      rhythmCheckNumber: checkNumber,
      arrestEpisodeNumber: next.arrestEpisodeNumber,
    },
    timestamp: now,
  }, actor);
}

/** Resuscitation stopped. `timeOfDeathLabel` is the clock time as shown to the clinician. */
export const stopResuscitationAction = (timeOfDeathLabel: string): ActionSpec => ({
  type: 'INFO',
  kind: 'CODE_END',
  transition: terminateResuscitation,
  description: (_p, next) => `Resuscitation stopped - time of death ${timeOfDeathLabel} after ${formatClock(next.totalTime)} of arrest time`,
  payload: (_p, next, now) => ({ outcome: 'TERMINATED', timeOfDeath: now, arrestDurationSeconds: next.totalTime, arrestEpisodeNumber: next.arrestEpisodeNumber }),
});

export const dispositionAction = (destination: DispositionDestination, label: string, note?: string): ActionSpec => ({
  type: 'INFO',
  kind: 'DISPOSITION',
  transition: (prev, now) => recordDisposition(prev, now, destination),
  description: (_p, next) => `Disposition: ${label}${note ? ` (${note})` : ''} after ${formatClock(next.roscElapsedSeconds ?? 0)} of ROSC`,
  payload: (_p, next) => ({
    destination,
    ...(note ? { note } : {}),
    roscDurationSeconds: next.roscElapsedSeconds ?? 0,
    arrestEpisodeNumber: next.arrestEpisodeNumber,
  }),
});

const airwayName = (d: AdvancedAirwayDevice) => (d === 'ETT' ? 'Endotracheal tube' : 'Supraglottic airway');

export const airwayAction = (prevAirway: AclsState['advancedAirway'], device: AdvancedAirwayDevice, confirmedByCapnography: boolean): ActionSpec => {
  const confirmationOnly = Boolean(prevAirway && prevAirway.device === device && confirmedByCapnography && !prevAirway.confirmedByCapnography);
  const note = device === 'ETT' && !confirmedByCapnography
    ? 'AHA: confirm and monitor endotracheal tube placement with continuous waveform capnography.'
    : undefined;
  return {
    type: 'ADVANCED_AIRWAY',
    kind: 'AIRWAY',
    transition: (prev, now) => recordAirway(prev, now, device, confirmedByCapnography),
    description: () => confirmationOnly
      ? `${airwayName(device)} placement confirmed by waveform capnography`
      : `Advanced airway placed: ${airwayName(device)} - ${confirmedByCapnography ? 'placement confirmed by waveform capnography' : 'confirmed clinically only'}${note ? ` [${note}]` : ''}`,
    payload: (_p, next) => ({
      device,
      confirmation: confirmedByCapnography ? 'WAVEFORM_CAPNOGRAPHY' : 'CLINICAL_ONLY',
      ...(confirmationOnly ? { confirmationOnly: true } : {}),
      arrestEpisodeNumber: next.arrestEpisodeNumber || 1,
    }),
  };
};

/** Is the code open for documentation (started, not stopped, not handed over)? */
export const codeIsOpen = (s: AclsState) => Boolean(s.codeStartedAt) && !s.terminatedAt && !s.dispositionAt;
