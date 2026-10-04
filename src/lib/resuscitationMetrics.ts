import { ClinicalEvent, ClinicalEventKind, PatientRhythm, ResuscitationMetrics } from '../types';
import { normalizeCaseClinicalEvents } from './clinicalEvents';
import { causeSummaryByEpisode } from './reversibleCauses';
import { postRoscChecklist } from './postRosc';

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
  const firstRhythmCheckEvent = sorted.find((e): e is Extract<ClinicalEvent, { kind: 'RHYTHM_CHECK' }> => e.kind === 'RHYTHM_CHECK');
  const firstRhythmCheckAt = firstRhythmCheckEvent?.payload.startedAt ?? firstRhythmCheckEvent?.timestamp ?? null;
  const firstShockAt = first('SHOCK');
  const firstEpinephrineAt = first('EPINEPHRINE');
  const roscEvents = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'ROSC' }> => e.kind === 'ROSC');
  const roscAt = roscEvents[0]?.timestamp ?? null;
  const finalRoscAt = roscEvents.at(-1)?.timestamp ?? null;

  // Reconstruct closed arrest episodes from the append-only timeline.
  // CODE_START begins the first episode; RE_ARREST begins each subsequent episode;
  // ROSC or CODE_END (resuscitation stopped) closes the currently open episode.
  // ROSC time is therefore excluded from subsequent arrest-duration calculations.
  const arrestEpisodeDurationsSeconds: number[] = [];
  const arrestEpisodeNumbers: number[] = [];
  let episodeStartAt: number | null = null;
  let episodeNumber = 0;
  for (const event of sorted) {
    if (event.kind === 'CODE_START' && episodeStartAt == null) {
      episodeStartAt = event.timestamp;
      episodeNumber = event.payload.arrestEpisodeNumber ?? 1;
    } else if (event.kind === 'RE_ARREST' && episodeStartAt == null) {
      episodeStartAt = event.timestamp;
      episodeNumber = event.payload.arrestEpisodeNumber ?? (episodeNumber + 1);
    } else if ((event.kind === 'ROSC' || event.kind === 'CODE_END') && episodeStartAt != null) {
      arrestEpisodeDurationsSeconds.push(
        Math.max(0, Math.floor((event.timestamp - episodeStartAt) / 1000))
      );
      arrestEpisodeNumbers.push(episodeNumber);
      episodeStartAt = null;
      episodeNumber = 0;
    }
  }
  const totalArrestDurationSeconds =
    arrestEpisodeDurationsSeconds.length > 0
      ? arrestEpisodeDurationsSeconds.reduce((sum, duration) => sum + duration, 0)
      : null;

  const delta = (eventAt: number | null) =>
    codeStartAt != null && eventAt != null ? Math.max(0, Math.floor((eventAt - codeStartAt) / 1000)) : null;

  const rhythmChecks = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'RHYTHM_CHECK' }> => e.kind === 'RHYTHM_CHECK');
  const explicitCprCycles = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'CPR_START' }> => e.kind === 'CPR_START').map(e => e.payload.cycleNumber ?? 0);
  const shockStartedCprCycles = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'SHOCK' }> => e.kind === 'SHOCK').map(e => e.payload.cprCycleNumber ?? 0);
  const reArrestStartedCprCycles = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'RE_ARREST' }> => e.kind === 'RE_ARREST').map(e => e.payload.cprCycleNumber ?? 0);
  const cprCycleNumbers = [...explicitCprCycles, ...shockStartedCprCycles, ...reArrestStartedCprCycles].filter(n => n > 0);
  const medications = sorted.filter(e =>
    e.kind === 'EPINEPHRINE' || e.kind === 'AMIODARONE' || e.kind === 'LIDOCAINE'
  );

  // Outcome = how the last arrest episode closed.
  const lastClosing = [...sorted].reverse().find(e => e.kind === 'ROSC' || e.kind === 'CODE_END' || e.kind === 'RE_ARREST');
  const outcome: ResuscitationMetrics['outcome'] =
    lastClosing?.kind === 'ROSC' ? 'ROSC' :
    lastClosing?.kind === 'CODE_END' ? 'TERMINATED' :
    'NOT_DOCUMENTED';
  const codeEndAt = sorted.filter(e => e.kind === 'CODE_END').at(-1)?.timestamp ?? null;
  const protocolDeviationCount = sorted.filter(e =>
    (e.kind === 'SHOCK' || e.kind === 'EPINEPHRINE' || e.kind === 'AMIODARONE' || e.kind === 'LIDOCAINE') &&
    Boolean(e.payload.protocolNote)
  ).length;

  // Reversible causes: last status of each cause, per arrest episode.
  const reversibleCauses = causeSummaryByEpisode(sorted);

  // Post-ROSC care after the last ROSC.
  const postRoscChecks = postRoscChecklist(sorted, finalRoscAt ?? Number.POSITIVE_INFINITY);
  const postRoscChecklistDone = (Object.keys(postRoscChecks) as (keyof typeof postRoscChecks)[])
    .filter(item => postRoscChecks[item]?.done);
  // Time from the ROSC that preceded it to the first 12-lead ECG.
  const firstEcg = sorted.find(e => e.kind === 'POST_ROSC_CHECK' && e.payload.item === 'ECG_12_LEAD' && e.payload.done);
  const roscBeforeEcg = firstEcg ? [...roscEvents].reverse().find(r => r.timestamp <= firstEcg.timestamp) : undefined;
  const timeFromRoscTo12LeadSeconds = firstEcg && roscBeforeEcg
    ? Math.max(0, Math.floor((firstEcg.timestamp - roscBeforeEcg.timestamp) / 1000))
    : null;
  const vitals = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'VITALS' }> => e.kind === 'VITALS');
  const dispositionEvent = sorted.filter((e): e is Extract<ClinicalEvent, { kind: 'DISPOSITION' }> => e.kind === 'DISPOSITION').at(-1);

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
    finalRoscAt,
    roscCount: roscEvents.length,
    arrestEpisodeDurationsSeconds,
    arrestEpisodeNumbers,
    totalArrestDurationSeconds,
    arrestDurationSeconds: totalArrestDurationSeconds,
    timeToFirstCprSeconds: delta(firstCprAt),
    timeToFirstRhythmCheckSeconds: delta(firstRhythmCheckAt),
    timeToFirstShockSeconds: delta(firstShockAt),
    timeToFirstEpinephrineSeconds: delta(firstEpinephrineAt),
    shockCount: sorted.filter(e => e.kind === 'SHOCK').length,
    epinephrineCount: sorted.filter(e => e.kind === 'EPINEPHRINE').length,
    amiodaroneCount: sorted.filter(e => e.kind === 'AMIODARONE').length,
    lidocaineCount: sorted.filter(e => e.kind === 'LIDOCAINE').length,
    rhythmCheckCount: rhythmChecks.length,
    cprCycleCount: cprCycleNumbers.length > 0 ? Math.max(...cprCycleNumbers) : sorted.filter(e => e.kind === 'CPR_START').length,
    cprPauseCount: sorted.filter(e => e.kind === 'CPR_PAUSE').length,
    reArrestCount: sorted.filter(e => e.kind === 'RE_ARREST').length,
    shockableRhythmChecks: rhythmChecks.filter(e => e.payload.rhythm === 'SHOCKABLE').length,
    nonShockableRhythmChecks: rhythmChecks.filter(e => e.payload.rhythm === 'NON_SHOCKABLE').length,
    medicationIntervalsSeconds,
    outcome,
    codeEndAt,
    protocolDeviationCount,
    reversibleCauses,
    postRoscChecklistDone,
    timeFromRoscTo12LeadSeconds,
    postRoscVitalsCount: vitals.length,
    postRoscVitalsOutsideTargetCount: vitals.filter(v => (v.payload.flags ?? []).length > 0).length,
    disposition: dispositionEvent?.payload.destination ?? null,
    dispositionAt: dispositionEvent?.timestamp ?? null,
  };
}
