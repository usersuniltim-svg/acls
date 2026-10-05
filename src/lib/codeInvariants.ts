/**
 * The code's phases and the rules that must always hold between the live
 * state and its event record. Used by the scenario and randomized tests to
 * catch any action that leaves the record inconsistent.
 *
 *   IDLE --start--> ARREST --ROSC--> ROSC --re-arrest--> ARREST (next episode)
 *                     |                |
 *                   stop          disposition
 *                     v                v
 *                TERMINATED    CLOSED_AFTER_ROSC
 *
 * A new code can start from IDLE, TERMINATED or CLOSED_AFTER_ROSC (and from
 * ROSC, which closes nothing and simply starts over).
 */
import type { AclsState, ClinicalEventKind } from '../types';

export type CodePhase = 'IDLE' | 'ARREST' | 'ROSC' | 'TERMINATED' | 'CLOSED_AFTER_ROSC';

export function codePhase(s: AclsState): CodePhase {
  if (!s.codeStartedAt) return 'IDLE';
  if (s.terminatedAt) return 'TERMINATED';
  if (s.dispositionAt) return 'CLOSED_AFTER_ROSC';
  if (s.roscAt) return 'ROSC';
  return 'ARREST';
}

/** Every broken rule, in plain words. Empty means the state is consistent. */
export function stateInvariantViolations(s: AclsState): string[] {
  const v: string[] = [];
  const phase = codePhase(s);
  const count = (k: ClinicalEventKind) => s.clinicalEvents.filter(e => e.kind === k).length;

  if (s.terminatedAt && s.roscAt) v.push('stopped code also has ROSC');
  if (s.terminatedAt && s.dispositionAt) v.push('stopped code also has a disposition');
  if (s.dispositionAt && !s.roscAt) v.push('disposition without ROSC');
  if (s.isTimerRunning && phase !== 'ARREST') v.push(`CPR running in phase ${phase}`);
  if (s.isTimerRunning && s.cprEndsAt == null) v.push('CPR running without an end time');
  if (s.activePrompt && phase !== 'ARREST') v.push(`prompt ${s.activePrompt} shown in phase ${phase}`);

  if (phase !== 'IDLE') {
    const episode = s.arrestEpisodeNumber ?? 0;
    if (episode < 1) v.push('code started but no arrest episode number');
    if (s.arrestEpisodeStartedAt != null && s.arrestEpisodeStartedAt < (s.codeStartedAt ?? 0)) {
      v.push('episode starts before the code');
    }
    const hasRecord = s.clinicalEvents.some(e => e.kind === 'CODE_START');
    if (hasRecord) {
      if (episode !== 1 + count('RE_ARREST')) v.push(`episode ${episode} but ${count('RE_ARREST')} re-arrests recorded`);
      if (s.shocksCount !== count('SHOCK')) v.push(`shock count ${s.shocksCount} vs ${count('SHOCK')} recorded`);
      if (s.epiCount !== count('EPINEPHRINE')) v.push(`epinephrine count ${s.epiCount} vs ${count('EPINEPHRINE')} recorded`);
      if ((s.amioCount ?? 0) !== count('AMIODARONE')) v.push(`amiodarone count ${s.amioCount} vs ${count('AMIODARONE')} recorded`);
      if ((s.lidoCount ?? 0) !== count('LIDOCAINE')) v.push(`lidocaine count ${s.lidoCount} vs ${count('LIDOCAINE')} recorded`);
      if (count('ROSC') < count('RE_ARREST')) v.push('more re-arrests than ROSCs');
      if (phase === 'ROSC' && count('ROSC') !== count('RE_ARREST') + 1) v.push('in ROSC but ROSC/re-arrest events do not match');
      if (phase === 'TERMINATED' && count('CODE_END') !== 1) v.push('stopped code needs exactly one CODE_END event');
    }
  }

  // The record itself.
  for (let i = 1; i < s.clinicalEvents.length; i++) {
    if (s.clinicalEvents[i].sequence <= s.clinicalEvents[i - 1].sequence) {
      v.push('event sequence numbers are not increasing');
      break;
    }
  }
  const closingIndex = s.clinicalEvents.findIndex(e => e.kind === 'CODE_END' || e.kind === 'DISPOSITION');
  if (closingIndex >= 0 && closingIndex < s.clinicalEvents.length - 1) {
    v.push(`events recorded after the case was closed (${s.clinicalEvents[closingIndex].kind})`);
  }
  if (s.clinicalEvents.length > 0 && s.clinicalEvents[0].kind !== 'CODE_START') {
    v.push('record does not begin with CODE_START');
  }
  return v;
}
