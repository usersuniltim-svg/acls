/**
 * End-tidal CO2 during CPR (2025 AHA Adult Advanced Life Support, Part 9).
 *
 *  - ETCO2 low (< 10 mm Hg) or falling: reassess CPR quality.
 *  - An abrupt increase (about 10 mm Hg or more) may indicate ROSC.
 *  - With an endotracheal tube only: failure to reach > 10 mm Hg after 20
 *    minutes of ALS may be considered as ONE component of a multimodal
 *    decision to stop. Never used on its own, and never in patients without
 *    an endotracheal tube (COR 3: Harm).
 *
 * Pure functions only, so they can be tested without a browser.
 */
import type { AdvancedAirwayDevice, ClinicalEvent } from '../types';

export const ETCO2_LOW_MMHG = 10;
export const ETCO2_ROSC_RISE_MMHG = 10;
export const ETCO2_TERMINATION_ALS_SECONDS = 20 * 60;

export interface Etco2Context {
  /** Previous reading in the same arrest episode, if any. */
  previousMmHg?: number | null;
  /** Highest reading so far in the current arrest episode, before this one. */
  maxSoFarMmHg?: number | null;
  airway: AdvancedAirwayDevice | 'NONE';
  /**
   * ALS time in the CURRENT arrest episode, seconds (episodeArrestSeconds).
   * Must match the episode-scoped readings: after a re-arrest the 20 minutes
   * start again, so earlier episodes can neither suppress nor trigger the note.
   */
  arrestSeconds: number;
}

export function assessEtco2(valueMmHg: number, ctx: Etco2Context): string[] {
  const flags: string[] = [];
  if (valueMmHg < ETCO2_LOW_MMHG) {
    flags.push(`EtCO2 ${valueMmHg} mm Hg is below 10: reassess CPR quality (depth, rate, recoil, ventilation).`);
  }
  if (ctx.previousMmHg != null && valueMmHg - ctx.previousMmHg >= ETCO2_ROSC_RISE_MMHG) {
    flags.push(`Abrupt rise of ${valueMmHg - ctx.previousMmHg} mm Hg: possible ROSC. Check for a pulse at the next rhythm check.`);
  }
  const highest = Math.max(valueMmHg, ctx.maxSoFarMmHg ?? Number.NEGATIVE_INFINITY);
  if (ctx.airway === 'ETT' && ctx.arrestSeconds >= ETCO2_TERMINATION_ALS_SECONDS && highest <= ETCO2_LOW_MMHG) {
    flags.push('EtCO2 has not exceeded 10 mm Hg after 20 minutes of ALS with an endotracheal tube. AHA: this may be considered as one part of a multimodal decision to stop, never on its own.');
  }
  return flags;
}

type Etco2Event = Extract<ClinicalEvent, { kind: 'ETCO2' }>;

export function etco2Readings(events: ClinicalEvent[] | undefined): Etco2Event[] {
  return (events ?? [])
    .filter((e): e is Etco2Event => e.kind === 'ETCO2')
    .sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);
}

/** Context for a new reading from what is already recorded. */
export function etco2Context(
  events: ClinicalEvent[] | undefined,
  arrestEpisodeNumber: number,
  airway: AdvancedAirwayDevice | 'NONE',
  arrestSeconds: number,
): Etco2Context {
  const readings = etco2Readings(events);
  const sameEpisode = readings.filter(r => (r.payload.arrestEpisodeNumber ?? 1) === arrestEpisodeNumber);
  return {
    previousMmHg: sameEpisode.at(-1)?.payload.valueMmHg ?? null,
    maxSoFarMmHg: sameEpisode.length ? Math.max(...sameEpisode.map(r => r.payload.valueMmHg)) : null,
    airway,
    arrestSeconds,
  };
}
