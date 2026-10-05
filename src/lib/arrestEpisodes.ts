/**
 * Arrest episodes, rebuilt from the event timeline.
 *
 * A code can contain several arrest episodes: CODE_START opens episode 1,
 * each RE_ARREST after ROSC opens the next, and ROSC or CODE_END closes the
 * open one. Events between a ROSC and the next re-arrest (post-ROSC care,
 * vitals, H's and T's) belong to the episode that just ended.
 *
 * Episodes are derived from the order of events, so records saved by older
 * versions (without episode numbers on each event) are measured the same way.
 */
import type { ArrestEpisodeSummary, ClinicalEvent } from '../types';

export type EpisodeSummary = ArrestEpisodeSummary;

function chronological(events: ClinicalEvent[]): ClinicalEvent[] {
  return [...events].sort((a, b) => a.timestamp - b.timestamp || a.sequence - b.sequence);
}

/** Episode number of every event, by its place in the timeline. */
export function episodeOfEvents(events: ClinicalEvent[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  let current = 0;
  for (const e of chronological(events ?? [])) {
    if (e.kind === 'CODE_START') current = Math.max(current, 1);
    else if (e.kind === 'RE_ARREST') current = current + 1;
    else if (current === 0) current = 1; // older records without CODE_START
    map.set(e.id, current);
  }
  return map;
}

const seconds = (from: number, to: number) => Math.max(0, Math.floor((to - from) / 1000));

export function summarizeEpisodes(events: ClinicalEvent[] | undefined): EpisodeSummary[] {
  const sorted = chronological(events ?? []);
  const episodes: EpisodeSummary[] = [];
  let open: EpisodeSummary | null = null;
  let lastEpiAt: number | null = null;

  const start = (episode: number, at: number) => {
    open = {
      episode, startAt: at, endAt: null, endedBy: null, durationSeconds: null,
      shocks: 0, epinephrineDoses: 0, amiodaroneDoses: 0, lidocaineDoses: 0, rhythmChecks: 0,
      firstEpinephrineAfterSeconds: null, epinephrineIntervalsSeconds: [],
    };
    episodes.push(open);
    lastEpiAt = null;
  };

  for (const e of sorted) {
    if (e.kind === 'CODE_START') {
      if (!open && episodes.length === 0) start(1, e.timestamp);
      continue;
    }
    if (e.kind === 'RE_ARREST') {
      start(episodes.length + 1, e.timestamp);
      continue;
    }
    if (!open && episodes.length === 0) start(1, e.timestamp); // older records without CODE_START
    const ep = open as EpisodeSummary | null;
    if (!ep) continue; // in ROSC: not part of an arrest episode's counts

    if (e.kind === 'SHOCK') ep.shocks++;
    else if (e.kind === 'AMIODARONE') ep.amiodaroneDoses++;
    else if (e.kind === 'LIDOCAINE') ep.lidocaineDoses++;
    else if (e.kind === 'RHYTHM_CHECK') ep.rhythmChecks++;
    else if (e.kind === 'EPINEPHRINE') {
      ep.epinephrineDoses++;
      if (ep.firstEpinephrineAfterSeconds == null) ep.firstEpinephrineAfterSeconds = seconds(ep.startAt, e.timestamp);
      if (lastEpiAt != null) ep.epinephrineIntervalsSeconds.push(seconds(lastEpiAt, e.timestamp));
      lastEpiAt = e.timestamp;
    } else if (e.kind === 'ROSC' || e.kind === 'CODE_END') {
      ep.endAt = e.timestamp;
      ep.endedBy = e.kind;
      ep.durationSeconds = seconds(ep.startAt, e.timestamp);
      open = null;
    }
  }
  return episodes;
}
