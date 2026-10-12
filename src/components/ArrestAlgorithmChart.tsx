import React from 'react';
import { ArrowDown, Zap } from 'lucide-react';
import type { AclsState } from '../types';
import {
  ARREST_BOXES,
  type ArrestBox,
  type ArrestBoxSpec,
  algorithmPosition,
  rhythmCheckExits,
} from '../lib/arrestAlgorithm';

interface ArrestAlgorithmChartProps {
  state: AclsState;
  isDark: boolean;
}

/** CPR boxes that end with a rhythm check, and so print where each answer leads. */
const CHECK_BOXES: ReadonlySet<ArrestBox> = new Set([4, 6, 8, 10, 11]);

/**
 * The 2025 AHA Adult Cardiac Arrest Algorithm, box by box, with the step the
 * team is on highlighted during a code. Branches are printed under each CPR
 * box in the AHA wording ("shockable: go to 5").
 */
export default function ArrestAlgorithmChart({ state, isDark }: ArrestAlgorithmChartProps) {
  const pos = algorithmPosition(state);
  const visited = new Set(pos.path);
  const live = pos.box != null && !pos.stopped;

  const muted = isDark ? 'text-slate-400' : 'text-gray-500';
  const card = isDark ? 'bg-slate-900/70 border-white/10 text-white shadow-lg' : 'bg-white border-gray-200 text-slate-900 shadow-sm';

  const energyLabel = state.defibType === 'MONOPHASIC' ? '360 J monophasic' : `${state.selectedEnergy} J biphasic`;

  const statusText = !pos.box
    ? 'Your step is highlighted once a code starts.'
    : pos.stopped
      ? 'Resuscitation stopped.'
      : pos.rosc
        ? 'ROSC: post-cardiac arrest care.'
        : pos.atRhythmCheck
          ? `Rhythm check after Box ${pos.box}.`
          : `Now: Box ${pos.box}.`;

  const boxClass = (spec: ArrestBoxSpec) => {
    const isNow = live && pos.box === spec.box && !pos.atRhythmCheck;
    const tone =
      spec.column === 'shockable' ? 'red' : spec.column === 'nonshockable' ? 'blue' : 'slate';
    if (isNow) {
      return tone === 'red'
        ? 'bg-red-600 border-red-600 text-white shadow-md ring-2 ring-red-400/60'
        : tone === 'blue'
          ? 'bg-blue-600 border-blue-600 text-white shadow-md ring-2 ring-blue-400/60'
          : 'bg-emerald-600 border-emerald-600 text-white shadow-md ring-2 ring-emerald-400/60';
    }
    if (live && visited.has(spec.box)) {
      return isDark ? 'bg-slate-800 border-slate-500 text-slate-100' : 'bg-white border-slate-400 text-slate-900';
    }
    return isDark ? 'bg-slate-950/60 border-white/10 text-slate-300' : 'bg-gray-50 border-gray-200 text-gray-700';
  };

  // Plain render helpers, not components: the chart re-renders every second
  // during a code, and new component types would remount (and restart the
  // pulse animations) on every tick.
  const renderArrow = () => (
    <div className="flex justify-center py-0.5" aria-hidden="true">
      <ArrowDown className={`w-3 h-3 ${muted}`} />
    </div>
  );

  const renderExits = (box: ArrestBox) => {
    const exits = rhythmCheckExits(box);
    const active = live && pos.atRhythmCheck && pos.box === box;
    // Inside the highlighted box: light text on the box colour, so it stays readable.
    const inCurrentBox = live && !pos.atRhythmCheck && pos.box === box;
    return (
      <div
        className={`mt-1 px-1.5 py-1 rounded-lg border text-[7.5px] font-bold leading-snug text-center ${
          active
            ? 'bg-amber-400 border-amber-500 text-amber-950 animate-pulse'
            : inCurrentBox
              ? 'border-dashed border-white/50 text-white'
              : isDark ? 'border-white/10 text-slate-400' : 'border-dashed border-gray-300 text-gray-500'
        }`}
        data-testid={`exits-${box}`}
      >
        Rhythm shockable?
        <span className="block font-semibold">Yes: go to {exits.shockable} • No: go to {exits.nonShockable}</span>
      </div>
    );
  };

  const renderBox = (spec: ArrestBoxSpec) => {
    const isNow = live && pos.box === spec.box && !pos.atRhythmCheck;
    return (
      <div
        className={`relative p-2 rounded-xl border text-left transition-all ${boxClass(spec)}`}
        data-testid={`box-${spec.box}`}
        aria-current={isNow ? 'step' : undefined}
      >
        <div className="flex items-start gap-1.5">
          <span
            className={`shrink-0 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${
              isNow ? 'bg-white/25 text-white' : isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {spec.box}
          </span>
          <div className="min-w-0">
            <div className={`text-[9px] font-black tracking-tight flex items-center gap-1 ${spec.kind === 'rhythm' ? '' : 'uppercase'}`}>
              {spec.kind === 'shock' && <Zap className="w-3 h-3 fill-current" />}
              {spec.title}
            </div>
            {spec.kind === 'shock' && <div className="text-[8px] font-semibold opacity-80">{energyLabel}</div>}
            {spec.lines.map(line => (
              <div key={line} className="text-[8px] font-semibold leading-snug opacity-90">{line}</div>
            ))}
          </div>
        </div>
        {isNow && (
          <span className="absolute -top-1.5 right-1.5 px-1.5 rounded-full bg-white text-[7px] font-black uppercase tracking-wider text-slate-900 shadow animate-pulse">
            Now
          </span>
        )}
        {CHECK_BOXES.has(spec.box) && renderExits(spec.box)}
      </div>
    );
  };

  const column = (c: ArrestBoxSpec['column']) => ARREST_BOXES.filter(b => b.column === c);
  const top = column('top')[0];
  const bottom = column('bottom')[0];
  const startExits = rhythmCheckExits(1);
  const firstCheckActive = live && pos.atRhythmCheck && pos.box === 1;

  return (
    <div className="space-y-3 text-left" data-testid="arrest-algorithm">
      <div>
        <h2 className={`text-base font-display font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Adult Cardiac Arrest Algorithm
        </h2>
        <p className={`text-[8.5px] font-bold tracking-wider mt-0.5 ${muted}`}>
          2025 AHA • VF/pVT • Asystole/PEA
        </p>
        <p className={`text-[9px] font-bold mt-1 ${live ? 'text-red-600' : muted}`} data-testid="algorithm-status">{statusText}</p>
      </div>

      <div className={`p-3 rounded-2xl border ${card}`}>
        {renderBox(top)}
        {renderArrow()}
        <div
          className={`mx-auto w-fit px-3 py-1 rounded-full border text-[8.5px] font-black uppercase tracking-wider text-center ${
            firstCheckActive
              ? 'bg-amber-400 border-amber-500 text-amber-950 animate-pulse'
              : isDark ? 'bg-slate-950 border-indigo-500/30 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-700 shadow-sm'
          }`}
          data-testid="exits-1"
        >
          Rhythm shockable?
          <span className="block text-[7.5px] font-bold normal-case tracking-normal">Yes: go to {startExits.shockable} • No: go to {startExits.nonShockable}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <div className="w-1/2 flex flex-col">
            <div className="text-center font-black text-[8px] text-red-600 border border-red-300 px-2 py-0.5 bg-red-50 rounded-lg uppercase w-fit mx-auto mb-1.5">
              Shockable
            </div>
            {column('shockable').map((spec, i) => (
              <React.Fragment key={spec.box}>
                {i > 0 && renderArrow()}
                {renderBox(spec)}
              </React.Fragment>
            ))}
          </div>
          <div className="w-1/2 flex flex-col">
            <div className="text-center font-black text-[8px] text-blue-600 border border-blue-300 px-2 py-0.5 bg-blue-50 rounded-lg uppercase w-fit mx-auto mb-1.5">
              Nonshockable
            </div>
            {column('nonshockable').map((spec, i) => (
              <React.Fragment key={spec.box}>
                {i > 0 && renderArrow()}
                {renderBox(spec)}
              </React.Fragment>
            ))}
          </div>
        </div>

        {renderArrow()}
        <div
          className={`p-2 rounded-xl border ${
            live && pos.rosc
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
              : live && visited.has(12)
                ? isDark ? 'bg-slate-800 border-slate-500 text-slate-100' : 'bg-white border-slate-400 text-slate-900'
                : isDark ? 'bg-slate-950/60 border-white/10 text-slate-300' : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
          data-testid="box-12"
          aria-current={live && pos.rosc ? 'step' : undefined}
        >
          <div className="flex items-start gap-1.5">
            <span className={`shrink-0 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-700'}`}>
              12
            </span>
            <div className="space-y-0.5">
              {bottom.lines.map((line, i) => (
                <div
                  key={line}
                  className={`text-[8.5px] leading-snug ${i === 1 && live && pos.rosc ? 'font-black' : 'font-semibold'}`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className={`text-[8px] leading-snug ${muted}`}>
        CPR quality, shock energy, drug doses, advanced airway and the H's and T's appear as cues on the Timers screen while compressions run.
        Source: 2025 AHA Adult Cardiac Arrest Algorithm (cpr.heart.org).
      </p>
    </div>
  );
}
