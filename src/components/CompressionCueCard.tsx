import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Activity, Heart, Repeat, Syringe, Wind, Zap, Search, Gauge } from 'lucide-react';
import type { AclsState } from '../types';
import { CPR_CYCLE_DURATION } from '../constants';
import { CUE_SECONDS, SWITCH_WARNING_SECONDS, currentCompressionCue, type CueGroup } from '../lib/compressionCues';

interface CompressionCueCardProps {
  state: AclsState;
  isDark: boolean;
}

const GROUP_ICON: Record<CueGroup, React.ComponentType<{ className?: string }>> = {
  'CPR quality': Heart,
  Ventilation: Wind,
  Capnography: Gauge,
  'Shock energy': Zap,
  'Drug therapy': Syringe,
  'Advanced airway': Activity,
  'Reversible causes': Search,
  'Rhythm check': Repeat,
};

/**
 * The AHA side boxes as a rotating cue, shown on the Timers screen only while
 * compressions are running. Nothing is rendered at any other time.
 */
export default function CompressionCueCard({ state, isDark }: CompressionCueCardProps) {
  const reduceMotion = useReducedMotion();
  const current = currentCompressionCue(state);
  if (!current) return null;

  const { cue, index, count } = current;
  const Icon = GROUP_ICON[cue.group];
  const switching = cue.id === 'switch';

  // Progress through this cue's 5 seconds (or through the last 15 s of the cycle).
  const elapsed = Math.max(0, CPR_CYCLE_DURATION - state.cprTimeLeft);
  const startPct = switching
    ? ((SWITCH_WARNING_SECONDS - state.cprTimeLeft) / SWITCH_WARNING_SECONDS) * 100
    : ((elapsed % CUE_SECONDS) / CUE_SECONDS) * 100;
  const remaining = switching ? state.cprTimeLeft : CUE_SECONDS - (elapsed % CUE_SECONDS);

  const shell = switching
    ? 'bg-amber-400 border-amber-500 text-amber-950'
    : isDark
      ? 'bg-slate-900/80 border-emerald-500/30 text-white'
      : 'bg-emerald-50 border-emerald-200 text-slate-900';

  return (
    <div
      className={`w-full rounded-2xl border p-3 text-left shadow-sm overflow-hidden ${shell}`}
      role="status"
      aria-live="polite"
      data-testid="compression-cue"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cue.id}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex items-start gap-2.5"
        >
          <motion.span
            className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
              switching ? 'bg-amber-950/10' : isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white text-emerald-700 border border-emerald-200'
            }`}
            animate={reduceMotion ? undefined : { scale: [1, 1.12, 1] }}
            transition={{ duration: 60 / 110, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon className="w-4 h-4" />
          </motion.span>
          <div className="min-w-0">
            <span className={`block text-[8px] font-black uppercase tracking-widest ${switching ? '' : isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              {cue.group}
            </span>
            <p className="text-[11px] font-bold leading-snug">{cue.text}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className={`mt-2 h-1 rounded-full overflow-hidden ${switching ? 'bg-amber-950/15' : isDark ? 'bg-slate-800' : 'bg-emerald-100'}`}>
        <motion.div
          key={`${cue.id}-${state.cprCycleCount}-${index}`}
          className={`h-full ${switching ? 'bg-amber-950/60' : 'bg-emerald-500'}`}
          initial={{ width: `${Math.min(100, Math.max(0, startPct))}%` }}
          animate={{ width: '100%' }}
          transition={{ duration: Math.max(0.1, remaining), ease: 'linear' }}
        />
      </div>
      {!switching && count > 1 && (
        <div className="mt-1.5 flex justify-center gap-1" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${i === index ? 'w-3 bg-emerald-500' : `w-1 ${isDark ? 'bg-slate-700' : 'bg-emerald-200'}`}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
