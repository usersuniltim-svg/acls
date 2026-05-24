import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Syringe, 
  Activity, 
  History, 
  Settings, 
  AlertCircle,
  ClipboardList,
  LogOut,
  User
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AclsState,
  UserProfile,
  PatientRhythm
} from '../types';
import { CPR_CYCLE_DURATION, HS_AND_TS } from '../constants';
import { auth } from '../lib/firebase';

interface DesktopDashboardProps {
  state: AclsState;
  toggleTimer: () => void;
  resetCprTimer: () => void;
  setActiveTab: (tab: any) => void;
  handleShock: () => void;
  handleEpi: () => void;
  handleRosc: () => void;
  handleRhythmSelect: (rhythm: PatientRhythm) => void;
  effectiveProfile: UserProfile;
  formatTime: (seconds: number) => string;
  cprProgress: number;
  epiProgress: number;
}

export default function DesktopDashboard({
  state,
  toggleTimer,
  resetCprTimer,
  setActiveTab,
  handleShock,
  handleEpi,
  handleRosc,
  handleRhythmSelect,
  effectiveProfile,
  formatTime,
  cprProgress,
  epiProgress
}: DesktopDashboardProps) {
  return (
    <div className="flex-1 flex overflow-hidden w-full h-full" id="desktop-viewport">
      {/* Sidebar Monitor (Persistent) */}
      <aside className="w-80 glass-panel m-4 mr-0 rounded-3xl flex flex-col overflow-hidden border-r-0 shrink-0 select-none bg-slate-900/50">
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-red-500 px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase shadow-lg shadow-red-500/20">LIVE CODE</div>
            <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
              <span className={`w-2 h-2 rounded-full ${state.isTimerRunning ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
              {state.isTimerRunning ? 'ACTIVE' : 'STANDBY'}
            </div>
          </div>
          
          <div className="text-center py-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Total Time</div>
            <div className="font-mono text-4xl tabular-nums tracking-tighter text-white">{formatTime(state.totalTime)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {/* Main CPR Monitoring */}
          <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-800" />
              <motion.circle 
                cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" 
                className={state.cprTimeLeft < 30 ? 'text-red-500' : 'text-blue-500'}
                strokeDasharray="283"
                animate={{ strokeDashoffset: 283 - (283 * cprProgress) / 100 }}
                transition={{ ease: "linear" }}
              />
            </svg>
            <div className="text-center z-10">
              <div className={`text-3.5xl font-mono font-bold tabular-nums tracking-tighter ${state.activePrompt === 'RHYTHM_CHECK' ? 'text-emerald-400' : state.cprTimeLeft < 30 ? 'text-red-400' : 'text-slate-100'}`}>
                {state.activePrompt === 'RHYTHM_CHECK' ? formatTime(state.rhythmCheckTimeLeft) : formatTime(state.cprTimeLeft)}
              </div>
              <p className={`text-[9px] uppercase tracking-widest mt-1 font-bold ${state.activePrompt === 'RHYTHM_CHECK' ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                {state.activePrompt === 'RHYTHM_CHECK' ? 'Check Rhythm' : 'Next Check'}
              </p>
            </div>
          </div>

          {/* Med Monitor */}
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase text-slate-500 font-bold tracking-widest border-b border-white/5 pb-2">Drug Monitoring</h3>
            <div className="glass-panel bg-slate-950/30 p-4 border-blue-550/20 rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-blue-400 uppercase">Epinephrine</span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">#{state.epiCount} Given</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-850 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-blue-500" animate={{ width: `${epiProgress}%` }} />
                </div>
                <span className="font-mono text-xs font-bold text-blue-400">{formatTime(state.epiTimeLeft)}</span>
              </div>
            </div>
          </div>

          {/* Event Log (Condensed) */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center text-left">
              <h3 className="text-[10px] uppercase text-slate-500 font-bold tracking-widest leading-none">Journal logs</h3>
              <History className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="space-y-2 h-32 overflow-y-auto pr-2 custom-scrollbar text-left font-mono">
              {state.logs.map((log) => (
                <div key={log.id} className="flex gap-2.5 items-start pl-2">
                  <span className="text-[8px] text-slate-500 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase leading-snug">{log.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-3 py-4 grid grid-cols-2 gap-2 border-t border-white/5 bg-slate-950/20 rounded-b-xl">
            <div className="text-center">
              <div className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">CPR Cycles</div>
              <div className="text-base font-mono font-bold text-white leading-none">{state.cprCycleCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">Epi Doses</div>
              <div className="text-base font-mono font-bold text-blue-400 leading-none">{state.epiCount}</div>
            </div>
          </div>
        </div>

        {/* Console Footers */}
        <div className="p-4 bg-slate-950/80 border-t border-white/5 flex gap-2 shrink-0">
          <button onClick={toggleTimer} className="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-750 text-white flex items-center justify-center transition-all cursor-pointer border-none">
            {state.isTimerRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>
          <button onClick={resetCprTimer} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-500 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => setActiveTab('settings')} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-755 text-slate-500 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => auth.signOut()} className="w-10 h-10 rounded-xl bg-slate-850/50 hover:bg-red-500/10 text-slate-650 hover:text-red-500 flex items-center justify-center transition-all cursor-pointer border-none shadow-inner">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Algorithm Workstation Stage */}
      <main className="flex-1 flex flex-col p-6 overflow-hidden relative">
        <header className="flex justify-between items-center mb-6 shrink-0 selection:bg-transparent">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/25">
              <User className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-display font-bold tracking-tight text-white">{effectiveProfile.fullName}</h2>
              <span className="text-[8.5px] text-slate-500 uppercase tracking-widest font-black mt-1 block">
                {effectiveProfile.profession.toUpperCase()} • License {effectiveProfile.councilRegistration}
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setActiveTab('algorithm')}
            className="px-3.5 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" /> Expand Flowchart
          </button>
        </header>

        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {/* Phase: Current Step */}
          <section className="glass-panel p-6 bg-slate-900/30 border-blue-500/10 relative overflow-hidden text-left rounded-2xl border border-white/5">
            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Active CPR Stage Monitor</span>
              </div>
              
              <h3 className="text-3xl font-display font-bold tracking-tight text-slate-100 mb-1.5">
                {state.currentRhythm === 'UNKNOWN' ? 'Awaiting Initial Rhythm Check' : 
                 state.currentRhythm === 'SHOCKABLE' ? 'VF / PULSELESS VT PATHWAY' : 'ASYSTOLE / PEA PATHWAY'}
              </h3>
              
              <p className="text-slate-450 font-normal leading-relaxed text-xs">
                {state.currentRhythm === 'SHOCKABLE' 
                  ? "Shockable rhythm identified. Administer high energy shock immediately and resume compressions. Prepare first dose of Epinephrine 1mg." 
                  : state.currentRhythm === 'NON_SHOCKABLE'
                  ? "Non-shockable path. Focus heavily on high-quality compressions and Epinephrine administration ASAP. Investigate H's & T's causes."
                  : "Continuous diagnostic assessment is active. Review pulse, evaluate cardiac monitor waveform, draft reversible notes."}
              </p>

              {/* H's & T's warning prompt */}
              {state.cprCycleCount >= 2 && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-none">Diagnostic Prioritization</h4>
                    <p className="text-[9px] text-slate-450 font-mono uppercase mt-1">CPR has exceeded cycle #2. Rapid scan of reversible complications required.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Action Grid (The Core Buttons) */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 select-none">
            <button 
              onClick={handleShock}
              className="h-24 rounded-2xl bg-red-650/10 border border-red-500/20 text-red-450 font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow cursor-pointer"
            >
              <Zap className="w-5 h-5 fill-current" />
              <span className="text-[10px] uppercase tracking-widest font-black">Shock ({state.shocksCount})</span>
            </button>
            <button 
              onClick={handleEpi}
              className={`h-24 rounded-2xl bg-blue-650/10 border border-blue-500/20 text-blue-450 font-bold flex flex-col items-center justify-center gap-1.5 hover:bg-blue-500 hover:text-white transition-all active:scale-95 shadow cursor-pointer ${state.epiTimeLeft === 0 ? 'animate-pulse' : ''}`}
            >
              <Syringe className="w-5 h-5 shrink-0" />
              <span className="text-[10px] uppercase tracking-widest font-black">Epinephrine ({state.epiCount})</span>
            </button>
            <button 
              onClick={() => handleRhythmSelect('SHOCKABLE')}
              className="h-24 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-1.5 hover:border-red-500/40 hover:text-white transition-colors text-slate-500 cursor-pointer text-[10px] font-bold uppercase tracking-widest"
            >
              <Activity className="w-5 h-5 text-red-500/40" />
              VF/pVT
            </button>
            <button 
              onClick={() => handleRhythmSelect('NON_SHOCKABLE')}
              className="h-24 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-1.5 hover:border-blue-500/40 hover:text-white transition-colors text-slate-500 cursor-pointer text-[10px] font-bold uppercase tracking-widest"
            >
              <Activity className="w-5 h-5 text-blue-500/40" />
              PEA/Asystole
            </button>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Checklist */}
            <section className="glass-panel p-5 bg-slate-950/20 rounded-2xl border border-white/5 text-left">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-1 p-0.5">Diagnostic cause checklists</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {HS_AND_TS.map((item, idx) => (
                  <label key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/35 border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                    <input type="checkbox" className="w-3 h-3 rounded bg-slate-950 checked:bg-emerald-500 cursor-pointer" />
                    <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-tight leading-none leading-tight">{item.term}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Emergency Operations Actions */}
            <section className="glass-panel p-5 bg-slate-950/20 rounded-2xl border border-white/5 text-left flex flex-col justify-between space-y-4">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1 p-0.5">Establish medical access</h4>
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={handleRosc}
                  className="w-full h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase text-[9px] tracking-widest hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                >
                  Confirm ROSC achieve
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="h-9 rounded-lg bg-slate-800 text-[8.5px] font-bold uppercase tracking-widest text-slate-400 border border-white/5 hover:text-white transition-colors cursor-pointer">Advanced Airway</button>
                  <button className="h-9 rounded-lg bg-slate-800 text-[8.5px] font-bold uppercase tracking-widest text-slate-400 border border-white/5 hover:text-white transition-colors cursor-pointer">IV / IO Access</button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer info logs */}
        <footer className="mt-4 flex justify-between text-[9px] text-slate-600 uppercase tracking-[0.2em] font-bold select-none shrink-0 border-t border-white/5 pt-3">
          <div>Nepal Resuscitation Registry • CCU Command</div>
          <div>Location: KATHMANDU CENTRAL HOSPITAL</div>
          <div>Database Sync: SECURE ENDPOINT</div>
        </footer>
      </main>
    </div>
  );
}
