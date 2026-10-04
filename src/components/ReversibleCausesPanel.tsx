import React from 'react';
import { HS_AND_TS } from '../constants';
import type { AclsState, ReversibleCauseId, ReversibleCauseStatus } from '../types';
import { CAUSE_STATUS_LABEL, causeStatusesForEpisode } from '../lib/reversibleCauses';

interface ReversibleCausesPanelProps {
  state: AclsState;
  isDark: boolean;
  onSetStatus: (cause: ReversibleCauseId, status: ReversibleCauseStatus) => void;
}

const STATUSES: ReversibleCauseStatus[] = ['SUSPECTED', 'TREATED', 'RULED_OUT'];

/**
 * H's and T's with a status per cause (suspected / treated / ruled out),
 * recorded against the current arrest episode. After a re-arrest the list
 * starts fresh for the new episode; earlier findings stay visible as hints.
 */
export default function ReversibleCausesPanel({ state, isDark, onSetStatus }: ReversibleCausesPanelProps) {
  const episode = state.arrestEpisodeNumber || 1;
  const current = causeStatusesForEpisode(state.clinicalEvents, episode);
  const earlier = episode > 1 ? causeStatusesForEpisode(state.clinicalEvents, episode - 1) : new Map();
  const assessed = current.size;

  const card = isDark ? 'bg-slate-900/70 border-white/10 text-white shadow-lg' : 'bg-white border-gray-200 text-slate-900 shadow-sm';
  const row = isDark ? 'bg-slate-950/60 border-white/5' : 'bg-gray-50 border-gray-200';
  const muted = isDark ? 'text-slate-400' : 'text-gray-500';

  const chip = (status: ReversibleCauseStatus, active: boolean) => {
    const base = 'flex-1 min-w-0 h-7 rounded-lg border text-[8px] font-bold uppercase tracking-wide transition-colors cursor-pointer px-1';
    if (!active) {
      return `${base} ${isDark ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`;
    }
    if (status === 'SUSPECTED') return `${base} bg-amber-500 border-amber-500 text-white`;
    if (status === 'TREATED') return `${base} bg-blue-600 border-blue-600 text-white`;
    return `${base} bg-slate-600 border-slate-600 text-white`;
  };

  return (
    <div className={`p-3.5 rounded-2xl border space-y-2.5 ${card}`}>
      <div className="flex justify-between items-center border-b pb-1.5 border-inherit gap-2">
        <span className="text-[9px] uppercase tracking-wider font-bold text-red-600">
          Reversible Causes (H's and T's)
        </span>
        <span className={`text-[8px] font-mono font-bold ${muted}`}>
          {state.codeStartedAt ? `Episode ${episode} • ${assessed}/10 assessed` : '10 causes'}
        </span>
      </div>

      <div className="space-y-1.5">
        {HS_AND_TS.map((item) => {
          const now = current.get(item.id);
          const before = earlier.get(item.id);
          return (
            <div key={item.id} className={`p-2 rounded-xl border ${row}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-[9px] font-bold uppercase tracking-tight leading-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {item.term}
                </span>
                {now?.note ? (
                  <span className={`text-[8px] truncate max-w-[45%] ${muted}`} title={now.note}>{now.note}</span>
                ) : before ? (
                  <span className={`text-[8px] truncate max-w-[45%] ${muted}`}>
                    Ep {episode - 1}: {CAUSE_STATUS_LABEL[before.status]}
                  </span>
                ) : null}
              </div>
              <div className="flex gap-1 mt-1.5" role="group" aria-label={`${item.term} status`}>
                {STATUSES.map(status => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={now?.status === status}
                    onClick={() => onSetStatus(item.id, status)}
                    className={chip(status, now?.status === status)}
                  >
                    {CAUSE_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
