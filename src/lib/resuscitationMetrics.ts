import { ClinicalEvent, ClinicalEventKind, PatientRhythm, ResuscitationMetrics } from '../types';
import { normalizeCaseClinicalEvents } from './clinicalEvents';

/**
 * Derives objective timeline metrics from recorded events only.
 * This function does not decide whether care was guideline-concordant.
 */
export function calculateResuscitationMetrics(
  events: ClinicalEvent[] | undefined,
  logs: import('../types').LogEvent[] | undefined
): ResuscitationMetrics {
  const normalized = normalizeCaseClinicalEvents(events, logs);
  const sorted = [...normalized].sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence);
  const first = (kind: ClinicalEventKind) => sorted.find(e => e.kind === kind)?.timestamp ?? null;

  const codeStartAt = first('CODE_START');
  const firstCprAt = first('CPR_START');
  const firstRhythmCheckAt = first('RHYTHM_CHECK');
  const firstShockAt = first('SHOCK');
  const firstEpinephrineAt = first('EPINEPHRINE');
  const roscAt = first('ROSC');

  const delta = (eventAt: number | null) =>
    codeStartAt != null && eventAt != null ? Math.max(0, Math.floor((eventAt - codeStartAt) / 1000)) : null;

  const rhythmChecks = sorted.filter(e => e.kind === 'RHYTHM_CHECK');
  const medications = sorted.filter(e =>
    e.kind === 'EPINEPHRINE' || e.kind === 'AMIODARONE' || e.kind === 'LIDOCAINE'
  );

  const medicationIntervalsSeconds: number[] = [];
  for (let i = 1; i < medications.length; i++) {
    medicationIntervalsSeconds.push(Math.max(0, Math.floor(
      (medications[i].timestamp - medications[i - 1].timestamp) / 1000
    )));
  }

  return {
    codeStartAt,
    firstCprAt,
    firstRhythmCheckAt,
    firstShockAt,
    firstEpinephrineAt,
    roscAt,
    arrestDurationSeconds: codeStartAt != null && roscAt != null
      ? Math.max(0, Math.floor((roscAt - codeStartAt) / 1000))
      : null,
    timeToFirstCprSeconds: delta(firstCprAt),
    timeToFirstRhythmCheckSeconds: delta(firstRhythmCheckAt),
    timeToFirstShockSeconds: delta(firstShockAt),
    timeToFirstEpinephrineSeconds: delta(firstEpinephrineAt),
    shockCount: sorted.filter(e => e.kind === 'SHOCK').length,
    epinephrineCount: sorted.filter(e => e.kind === 'EPINEPHRINE').length,
    amiodaroneCount: sorted.filter(e => e.kind === 'AMIODARONE').length,
    lidocaineCount: sorted.filter(e => e.kind === 'LIDOCAINE').length,
    rhythmCheckCount: rhythmChecks.length,
    cprCycleCount: sorted.filter(e => e.kind === 'CPR_START').length,
    cprPauseCount: sorted.filter(e => e.kind === 'CPR_PAUSE').length,
    reArrestCount: sorted.filter(e => e.kind === 'RE_ARREST').length,
    shockableRhythmChecks: rhythmChecks.filter(e => e.payload.rhythm === 'SHOCKABLE').length,
    nonShockableRhythmChecks: rhythmChecks.filter(e => e.payload.rhythm === 'NON_SHOCKABLE').length,
    medicationIntervalsSeconds,
  };
}
