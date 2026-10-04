/**
 * Reversible causes (H's and T's), attributed to arrest episodes.
 *
 * Each assessment is an append-only REVERSIBLE_CAUSE event carrying the
 * episode it was made in. Episode 1 starts at CODE_START; each re-arrest
 * after ROSC starts the next one. The current picture for an episode is the
 * latest assessment of each cause in that episode.
 *
 * Pure functions only, so they can be tested without a browser.
 */
import { HS_AND_TS } from '../constants';
import type { ClinicalEvent, ReversibleCauseId, ReversibleCauseStatus } from '../types';

export interface CauseAssessment {
  arrestEpisodeNumber: number;
  cause: ReversibleCauseId;
  status: ReversibleCauseStatus;
  at: number;
  note?: string;
}

export const CAUSE_STATUS_LABEL: Record<ReversibleCauseStatus, string> = {
  SUSPECTED: 'Suspected',
  TREATED: 'Treated',
  RULED_OUT: 'Ruled out',
};

export function causeLabel(cause: ReversibleCauseId): string {
  return HS_AND_TS.find(c => c.id === cause)?.term ?? cause;
}

type CauseEvent = Extract<ClinicalEvent, { kind: 'REVERSIBLE_CAUSE' }>;

function causeEvents(events: ClinicalEvent[] | undefined): CauseEvent[] {
  return (events ?? [])
    .filter((e): e is CauseEvent => e.kind === 'REVERSIBLE_CAUSE')
    .sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);
}

/** Latest assessment of each cause within one episode. */
export function causeStatusesForEpisode(
  events: ClinicalEvent[] | undefined,
  arrestEpisodeNumber: number,
): Map<ReversibleCauseId, CauseAssessment> {
  const latest = new Map<ReversibleCauseId, CauseAssessment>();
  for (const e of causeEvents(events)) {
    const episode = e.payload.arrestEpisodeNumber ?? 1;
    if (episode !== arrestEpisodeNumber) continue;
    latest.set(e.payload.cause, {
      arrestEpisodeNumber: episode,
      cause: e.payload.cause,
      status: e.payload.status,
      at: e.timestamp,
      ...(e.payload.note ? { note: e.payload.note } : {}),
    });
  }
  return latest;
}

/**
 * Final status of every assessed cause, per episode, in episode order and
 * then in the standard H's and T's order. Used by the report and metrics.
 */
export function causeSummaryByEpisode(events: ClinicalEvent[] | undefined): CauseAssessment[] {
  const episodes = Array.from(new Set(causeEvents(events).map(e => e.payload.arrestEpisodeNumber ?? 1))).sort((a, b) => a - b);
  const order = HS_AND_TS.map(c => c.id);
  const out: CauseAssessment[] = [];
  for (const episode of episodes) {
    const statuses = causeStatusesForEpisode(events, episode);
    out.push(...Array.from(statuses.values()).sort((a, b) => order.indexOf(a.cause) - order.indexOf(b.cause)));
  }
  return out;
}
