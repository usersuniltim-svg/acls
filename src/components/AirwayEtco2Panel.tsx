import React, { useState } from 'react';
import { AlertTriangle, Wind } from 'lucide-react';
import type { AclsState, AdvancedAirwayDevice } from '../types';
import { isCodeActive } from '../lib/codeClock';
import { etco2Readings } from '../lib/capnography';

interface AirwayEtco2PanelProps {
  state: AclsState;
  isDark: boolean;
  onAirway: (device: AdvancedAirwayDevice, confirmedByCapnography: boolean) => void;
  /** Returns what the reading may mean, or null if it was not recorded. */
  onEtco2: (valueMmHg: number) => string[] | null;
}

const DEVICE_LABEL: Record<AdvancedAirwayDevice, string> = {
  ETT: 'Endotracheal tube',
  SGA: 'Supraglottic airway',
};

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Advanced airway and end-tidal CO2 during CPR (2025 AHA):
 * - confirm and monitor ETT placement with continuous waveform capnography
 * - with an advanced airway: 1 breath every 6 s, continuous compressions
 * - EtCO2 < 10 mm Hg: reassess CPR quality; abrupt rise: possible ROSC
 */
export default function AirwayEtco2Panel({ state, isDark, onAirway, onEtco2 }: AirwayEtco2PanelProps) {
  const [choosing, setChoosing] = useState<AdvancedAirwayDevice | null>(null);
  const [changing, setChanging] = useState(false);
  const [value, setValue] = useState('');
  const airway = state.advancedAirway;
  const readings = etco2Readings(state.clinicalEvents);
  const latest = readings.at(-1);
  const active = isCodeActive(state);

  const card = isDark ? 'bg-slate-900/70 border-white/10 text-white shadow-lg' : 'bg-white border-gray-200 text-slate-900 shadow-sm';
  const row = isDark ? 'bg-slate-950/60 border-white/5' : 'bg-gray-50 border-gray-200';
  const muted = isDark ? 'text-slate-400' : 'text-gray-500';
  const btn = isDark
    ? 'bg-slate-800 border-white/10 text-slate-200 hover:bg-slate-700'
    : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100';

  const pick = (device: AdvancedAirwayDevice, confirmed: boolean) => {
    onAirway(device, confirmed);
    setChoosing(null);
    setChanging(false);
  };

  const submit = () => {
    const n = Number(value.trim().replace(',', '.'));
    if (!value.trim() || !Number.isFinite(n)) return;
    if (onEtco2(n) !== null) setValue('');
  };

  const showPicker = !airway || changing;

  return (
    <div className={`p-3.5 rounded-2xl border space-y-2.5 ${card}`} data-testid="airway-panel">
      <div className="flex justify-between items-center border-b pb-1.5 border-inherit">
        <span className="text-[9px] uppercase tracking-wider font-bold text-red-600 flex items-center gap-1.5">
          <Wind className="w-3.5 h-3.5" /> Advanced airway & EtCO2
        </span>
        {airway && !changing && (
          <button type="button" onClick={() => setChanging(true)} className={`text-[8px] font-bold uppercase underline cursor-pointer bg-transparent border-none ${muted}`}>
            Change airway
          </button>
        )}
      </div>

      {/* Airway */}
      {showPicker ? (
        choosing ? (
          <div className="space-y-1.5">
            <span className={`text-[9px] font-bold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {DEVICE_LABEL[choosing]}: how was placement confirmed?
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => pick(choosing, true)} className="h-10 rounded-xl border-none bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wide cursor-pointer">
                Waveform capnography
              </button>
              <button type="button" onClick={() => pick(choosing, false)} className={`h-10 rounded-xl border text-[9px] font-bold uppercase tracking-wide cursor-pointer ${btn}`}>
                Clinical only
              </button>
            </div>
            <button type="button" onClick={() => { setChoosing(null); setChanging(false); }} className={`text-[8.5px] font-bold uppercase cursor-pointer bg-transparent border-none ${muted}`}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {(['ETT', 'SGA'] as AdvancedAirwayDevice[]).map(d => (
              <button key={d} type="button" onClick={() => setChoosing(d)} className={`h-10 rounded-xl border text-[9px] font-bold uppercase tracking-wide cursor-pointer ${btn}`}>
                {d === 'ETT' ? 'ETT placed' : 'SGA placed'}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className={`p-2 rounded-xl border space-y-1 ${row}`}>
          <div className={`text-[9.5px] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {DEVICE_LABEL[airway!.device]} • placed {hhmm(airway!.at)}
          </div>
          <div className={`text-[8.5px] ${muted}`}>
            {airway!.confirmedByCapnography ? 'Placement confirmed by waveform capnography.' : 'Placement confirmed clinically only.'}
          </div>
          {airway!.device === 'ETT' && !airway!.confirmedByCapnography && (
            <div className="space-y-1">
              <div className="text-[8.5px] font-bold text-red-600 flex gap-1 items-start">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
                AHA: confirm and monitor ETT placement with continuous waveform capnography.
              </div>
              <button type="button" onClick={() => onAirway('ETT', true)} className="w-full h-8 rounded-lg border-none bg-emerald-600 hover:bg-emerald-700 text-white text-[8.5px] font-bold uppercase tracking-wide cursor-pointer">
                Now confirmed with capnography
              </button>
            </div>
          )}
          <div className="text-[8.5px] font-bold text-blue-600">Ventilate 1 breath every 6 s (10/min) with continuous compressions.</div>
        </div>
      )}

      {/* EtCO2 during CPR */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5 items-end">
          <label className="flex-1">
            <span className={`text-[7.5px] uppercase font-bold tracking-wide ${muted}`}>EtCO2 during CPR (mm Hg)</span>
            <input
              type="number"
              inputMode="decimal"
              value={value}
              disabled={!active}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              aria-label="EtCO2 during CPR (mm Hg)"
              className={`w-full h-9 px-2 rounded-lg border text-[12px] font-mono disabled:opacity-50 ${isDark ? 'bg-slate-950 border-white/15 text-white' : 'bg-white border-gray-300 text-slate-900'}`}
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={!active}
            className="h-9 px-3 rounded-lg border-none bg-slate-800 hover:bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wide cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Record
          </button>
        </div>
        {readings.length > 0 && (
          <div className={`p-2 rounded-xl border space-y-1 ${row}`}>
            <div className={`text-[8.5px] font-mono ${muted}`}>
              {readings.slice(-6).map(r => `${hhmm(r.timestamp)} ${r.payload.valueMmHg}`).join('  •  ')}
            </div>
            {(latest?.payload.flags ?? []).map(flag => (
              <div key={flag} className={`text-[8.5px] font-bold ${/possible ROSC/.test(flag) ? 'text-emerald-600' : 'text-red-600'}`}>⚠ {flag}</div>
            ))}
          </div>
        )}
        {!active && (
          <p className={`text-[8px] ${muted}`}>{state.roscAt ? 'In ROSC: record EtCO2 with the post-ROSC vitals.' : 'Available during an active resuscitation.'}</p>
        )}
      </div>
    </div>
  );
}
