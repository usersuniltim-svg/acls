import React, { useState } from 'react';
import { Activity, CheckCircle2, Heart, Clock } from 'lucide-react';
import type { AclsState, ClinicalEvent, DispositionDestination, PostRoscItemId } from '../types';
import {
  DISPOSITION_LABEL,
  POST_ROSC_ITEMS,
  PostRoscItem,
  VitalsInput,
  postRoscChecklist,
} from '../lib/postRosc';

interface PostRoscPanelProps {
  state: AclsState;
  isDark: boolean;
  onCheck: (item: PostRoscItemId, result?: string) => void;
  /** Returns the out-of-target flags for the entry, or null if nothing was recorded. */
  onVitals: (input: VitalsInput) => string[] | null;
  onDisposition: (destination: DispositionDestination) => void;
  onReArrest: () => void;
}

const VITAL_FIELDS: { key: keyof VitalsInput; label: string; unit: string; step?: string }[] = [
  { key: 'sbp', label: 'SBP', unit: 'mm Hg' },
  { key: 'dbp', label: 'DBP', unit: 'mm Hg' },
  { key: 'map', label: 'MAP', unit: 'mm Hg' },
  { key: 'hr', label: 'HR', unit: '/min' },
  { key: 'spo2', label: 'SpO2', unit: '%' },
  { key: 'paco2', label: 'PaCO2', unit: 'mm Hg' },
  { key: 'etco2', label: 'EtCO2', unit: 'mm Hg' },
  { key: 'tempC', label: 'Temp', unit: '°C', step: '0.1' },
  { key: 'glucoseMgDl', label: 'Glucose', unit: 'mg/dL' },
];

const DISPOSITIONS: DispositionDestination[] = ['CATH_LAB', 'ICU', 'TRANSFER', 'DIED', 'OTHER'];

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Post-ROSC care screen (2025 AHA Adult Post-Cardiac Arrest Care Algorithm):
 * time since ROSC, the algorithm checklist, vitals against targets, a one-tap
 * re-arrest, and the disposition that closes the case.
 */
export default function PostRoscPanel({ state, isDark, onCheck, onVitals, onDisposition, onReArrest }: PostRoscPanelProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [lastFlags, setLastFlags] = useState<string[] | null>(null);

  const roscAt = state.roscAt ?? 0;
  const closed = Boolean(state.dispositionAt);
  const episode = state.arrestEpisodeNumber || 1;
  const checklist = postRoscChecklist(state.clinicalEvents, roscAt);
  const followsCommands = checklist.FOLLOWS_COMMANDS?.done ? checklist.FOLLOWS_COMMANDS.result : undefined;
  const lastVitals = [...state.clinicalEvents]
    .reverse()
    .find((e): e is Extract<ClinicalEvent, { kind: 'VITALS' }> => e.kind === 'VITALS' && e.timestamp >= roscAt);

  const card = isDark ? 'bg-slate-900/70 border-white/10 text-white shadow-lg' : 'bg-white border-gray-200 text-slate-900 shadow-sm';
  const row = isDark ? 'bg-slate-950/60 border-white/5' : 'bg-gray-50 border-gray-200';
  const muted = isDark ? 'text-slate-400' : 'text-gray-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const inputCls = isDark
    ? 'bg-slate-950 border-white/15 text-white placeholder-slate-600'
    : 'bg-white border-gray-300 text-slate-900 placeholder-gray-400';

  const visibleItems = POST_ROSC_ITEMS.filter(i => i.phase !== 'Not following commands' || followsCommands !== 'YES');
  const phases = Array.from(new Set(visibleItems.map(i => i.phase)));

  const submitVitals = () => {
    const input: VitalsInput = {};
    for (const f of VITAL_FIELDS) {
      const raw = (form[f.key] ?? '').trim().replace(',', '.');
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) (input as Record<string, number>)[f.key] = n;
    }
    const flags = onVitals(input);
    if (flags !== null) {
      setLastFlags(flags);
      setForm({});
    }
  };

  const itemButton = (item: PostRoscItem) => {
    const entry = checklist[item.id];
    const done = Boolean(entry?.done);
    if (item.results) {
      return (
        <div className="flex gap-1 shrink-0">
          {item.results.map(r => {
            const active = done && entry?.result === r.value;
            return (
              <button
                key={r.value}
                type="button"
                disabled={closed}
                aria-pressed={active}
                onClick={() => onCheck(item.id, r.value)}
                className={`h-7 px-2 rounded-lg border text-[8px] font-bold uppercase tracking-wide cursor-pointer disabled:cursor-not-allowed ${
                  active
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : isDark ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={closed}
        aria-pressed={done}
        onClick={() => onCheck(item.id)}
        className={`h-7 px-2.5 rounded-lg border text-[8px] font-bold uppercase tracking-wide shrink-0 cursor-pointer disabled:cursor-not-allowed ${
          done
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : isDark ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-white border-gray-300 text-gray-700'
        }`}
      >
        {done ? 'Done' : 'Mark done'}
      </button>
    );
  };

  return (
    <div className={`w-full p-3.5 rounded-2xl border space-y-3 text-left ${card}`} data-testid="post-rosc-panel">
      {/* Header: time since ROSC */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-current" /> Post-ROSC care
          </span>
          <span className={`text-[8.5px] font-bold uppercase tracking-wider ${muted}`}>
            After arrest episode {episode} • ROSC at {hhmm(roscAt)}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-[8px] uppercase font-black block ${muted}`}>{closed ? 'ROSC duration' : 'Time since ROSC'}</span>
          <span className={`font-mono text-lg font-black tabular-nums ${strong}`}>{clock(state.roscElapsedSeconds ?? 0)}</span>
        </div>
      </div>

      {closed ? (
        <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Case closed: {state.disposition ? DISPOSITION_LABEL[state.disposition] : 'disposition recorded'} at {hhmm(state.dispositionAt!)}.
            Save and sign it in the Journal tab.
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReArrest}
          className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider border-none shadow-md cursor-pointer flex items-center justify-center gap-2"
        >
          <Activity className="w-4 h-4" /> Re-arrest: restart CPR (episode {episode + 1})
        </button>
      )}

      {/* AHA post-cardiac arrest checklist */}
      {phases.map(phase => (
        <div key={phase} className="space-y-1.5">
          <span className={`text-[8.5px] uppercase tracking-wider font-black block ${muted}`}>
            {phase === 'Not following commands' && !followsCommands ? 'If not following commands' : phase}
          </span>
          {visibleItems.filter(i => i.phase === phase).map(item => {
            const entry = checklist[item.id];
            return (
              <div key={item.id} className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${row}`}>
                <div className="min-w-0">
                  <span className={`text-[9.5px] font-bold leading-tight block ${strong}`}>{item.label}</span>
                  <span className={`text-[8px] leading-tight block ${muted}`}>
                    {entry?.done ? `Done ${hhmm(entry.at)}` : item.detail}
                  </span>
                </div>
                {itemButton(item)}
              </div>
            );
          })}
        </div>
      ))}

      {/* Vitals against AHA targets */}
      {!closed && (
        <div className="space-y-1.5">
          <span className={`text-[8.5px] uppercase tracking-wider font-black block ${muted}`}>Vitals (targets: MAP ≥ 65, SpO2 90-98%, PaCO2 35-45)</span>
          <div className="grid grid-cols-3 gap-1.5">
            {VITAL_FIELDS.map(f => (
              <label key={f.key} className="block">
                <span className={`text-[7.5px] uppercase font-bold tracking-wide ${muted}`}>{f.label} <span className="normal-case">{f.unit}</span></span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={f.step ?? '1'}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className={`w-full h-8 px-2 rounded-lg border text-[11px] font-mono ${inputCls}`}
                  aria-label={`${f.label} (${f.unit})`}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={submitVitals}
            className="w-full h-9 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold uppercase tracking-wider border-none cursor-pointer"
          >
            Record vitals
          </button>
          {lastFlags && lastFlags.length === 0 && (
            <p className="text-[9px] font-bold text-emerald-600">Recorded. All entered values are within target.</p>
          )}
        </div>
      )}

      {lastVitals && (
        <div className={`p-2 rounded-xl border text-[9px] space-y-1 ${row}`}>
          <div className={`font-bold flex items-center gap-1.5 ${strong}`}>
            <Clock className="w-3 h-3" /> Last vitals {hhmm(lastVitals.timestamp)}
          </div>
          <div className={`font-mono ${muted}`}>{(lastVitals.description ?? '').replace(/^Post-ROSC vitals: /, '').replace(/ \[Outside target:.*$/, '')}</div>
          {(lastVitals.payload.flags ?? []).map(flag => (
            <div key={flag} className="font-bold text-red-600">⚠ {flag}</div>
          ))}
        </div>
      )}

      {/* Disposition closes the case */}
      {!closed && (
        <div className="space-y-1.5">
          <span className={`text-[8.5px] uppercase tracking-wider font-black block ${muted}`}>Disposition (closes the case)</span>
          <div className="grid grid-cols-2 gap-1.5">
            {DISPOSITIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onDisposition(d)}
                className={`h-9 rounded-xl border text-[9px] font-bold uppercase tracking-wide cursor-pointer ${
                  isDark ? 'bg-slate-800 border-white/10 text-slate-200 hover:bg-slate-700' : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200'
                } ${d === 'OTHER' ? 'col-span-2' : ''}`}
              >
                {DISPOSITION_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
