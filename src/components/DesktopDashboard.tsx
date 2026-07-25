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
  User,
  Vibrate,
  Smartphone,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AclsState,
  UserProfile,
  PatientRhythm
} from '../types';
import { CPR_CYCLE_DURATION, EPI_INTERVAL, HS_AND_TS } from '../constants';
import { auth } from '../lib/firebase';

interface DesktopDashboardProps {
  state: AclsState;
  setState?: React.Dispatch<React.SetStateAction<AclsState>>;
  setHasSessionStarted?: (started: boolean) => void;
  activeTab?: 'timer' | 'interventions' | 'algorithm' | 'logs' | 'settings';
  setActiveTab: (tab: any) => void;
  toggleTimer: () => void;
  resetCprTimer: () => void;
  handleShock: () => void;
  handleEpi: () => void;
  handleRosc: () => void;
  handleRhythmSelect: (rhythm: PatientRhythm) => void;
  effectiveProfile: UserProfile;
  formatTime: (seconds: number) => string;
  cprProgress: number;
  epiProgress: number;
  vibrateDevice?: (pattern: number | number[]) => void;
  triggerPwaInstall?: () => Promise<void>;
  hapticDuration?: number;
  setHapticDuration?: React.Dispatch<React.SetStateAction<number>>;
  hapticIntensity?: number;
  setHapticIntensity?: React.Dispatch<React.SetStateAction<number>>;
}

export default function DesktopDashboard({
  state,
  setState,
  setHasSessionStarted,
  activeTab = 'timer',
  setActiveTab,
  toggleTimer,
  resetCprTimer,
  handleShock,
  handleEpi,
  handleRosc,
  handleRhythmSelect,
  effectiveProfile,
  formatTime,
  cprProgress,
  epiProgress,
  vibrateDevice,
  triggerPwaInstall,
  hapticDuration,
  setHapticDuration,
  hapticIntensity,
  setHapticIntensity
}: DesktopDashboardProps) {

  const renderDesktopSettings = () => {
    return (
      <div className="space-y-6 text-left max-w-2xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-xl font-display font-bold text-white uppercase tracking-tight">System & Hardware Configuration</h3>
            <p className="text-[10px] text-slate-500 uppercase font-mono font-bold mt-1">Calibrate haptics, defib energy, and device offline sync</p>
          </div>
          <button 
            type="button"
            onClick={() => setActiveTab('timer')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer border-none"
          >
            ← Back to Workstation
          </button>
        </div>

        {/* Haptic Vibration Feedback Panel */}
        <div className="glass-panel p-5 bg-slate-900/50 border-white/5 rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2 text-blue-400">
              <Vibrate className="w-5 h-5" />
              <h4 className="text-sm font-bold uppercase tracking-wider">Haptic Vibration Feedback</h4>
            </div>
            <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              TACTILE MONITOR ACTIVE
            </span>
          </div>

          {/* Duration Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold uppercase">
              <label htmlFor="desktop-haptic-duration-slider" className="text-slate-300">Timer Event Vibration Duration</label>
              <span className="text-blue-400 font-mono font-bold text-xs bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {hapticDuration || 150} ms
              </span>
            </div>
            <input 
              id="desktop-haptic-duration-slider"
              type="range"
              min="50"
              max="500"
              step="10"
              value={hapticDuration || 150}
              onChange={(e) => setHapticDuration && setHapticDuration(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[8.5px] text-slate-500 font-mono uppercase font-bold">
              <span>50ms (Short Burst)</span>
              <span>250ms (Standard Resus)</span>
              <span>500ms (Long Alert Pulse)</span>
            </div>
          </div>

          {/* Intensity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold uppercase">
              <label htmlFor="desktop-haptic-intensity-slider" className="text-slate-300">Vibration Pulse Intensity</label>
              <span className="text-emerald-400 font-mono font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Level {hapticIntensity || 3} ({ (hapticIntensity || 3) === 1 ? 'Soft' : (hapticIntensity || 3) === 2 ? 'Light' : (hapticIntensity || 3) === 3 ? 'Medium' : (hapticIntensity || 3) === 4 ? 'Strong' : 'Maximum' })
              </span>
            </div>
            <input 
              id="desktop-haptic-intensity-slider"
              type="range"
              min="1"
              max="5"
              step="1"
              value={hapticIntensity || 3}
              onChange={(e) => setHapticIntensity && setHapticIntensity(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[8.5px] text-slate-500 font-mono uppercase font-bold">
              <span>L1 (Subtle Pulse)</span>
              <span>L3 (Standard Feedback)</span>
              <span>L5 (Maximum Tactile Pulse)</span>
            </div>
          </div>

          {/* Test Vibration Pattern Button */}
          <button 
            id="desktop-test-haptic-btn"
            type="button"
            onClick={() => vibrateDevice && vibrateDevice([150, 80, 200])}
            className="w-full h-10 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow"
          >
            <Activity className="w-4 h-4" /> Test Haptic Vibration Pattern
          </button>
        </div>

        {/* Defibrillator Config */}
        {setState && (
          <div className="glass-panel p-5 bg-slate-900/40 border-white/5 rounded-2xl space-y-4">
            <h4 className="text-xs uppercase font-bold text-slate-400 border-b border-white/5 pb-2">Defibrillator Energy Parameters</h4>
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setState(prev => ({ ...prev, defibType: 'BIPHASIC', selectedEnergy: Math.min(200, prev.selectedEnergy) }))}
                className={`py-2 rounded-xl border text-center transition-colors uppercase text-xs font-black cursor-pointer ${state.defibType === 'BIPHASIC' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#0b0f19] border-slate-800 text-slate-500'}`}
              >
                Biphasic
              </button>
              <button 
                type="button"
                onClick={() => setState(prev => ({ ...prev, defibType: 'MONOPHASIC', selectedEnergy: 360 }))}
                className={`py-2 rounded-xl border text-center transition-colors uppercase text-xs font-black cursor-pointer ${state.defibType === 'MONOPHASIC' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#0b0f19] border-slate-800 text-slate-500'}`}
              >
                Monophasic
              </button>
            </div>

            {state.defibType === 'BIPHASIC' && (
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Shock Energy Level Selection</span>
                <div className="grid grid-cols-3 gap-2">
                  {[120, 150, 200].map((joules) => (
                    <button 
                      key={joules}
                      type="button"
                      onClick={() => setState(prev => ({ ...prev, selectedEnergy: joules }))}
                      className={`py-2 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer ${state.selectedEnergy === joules ? 'bg-red-500 border-red-500 text-white' : 'bg-[#0b0f19] border-slate-800 text-slate-500'}`}
                    >
                      {joules} Joules
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PWA offline */}
        {triggerPwaInstall && (
          <div className="glass-panel p-5 bg-emerald-950/10 border-emerald-500/20 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Smartphone className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Android PWA Direct Installer</h4>
            </div>
            <p className="text-xs text-slate-400 leading-normal uppercase font-bold">
              Enable offline, sandboxed, fast operations inside emergency departments by pinning to tablet homescreen.
            </p>
            <button 
              type="button"
              onClick={triggerPwaInstall}
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md shadow-emerald-600/15"
            >
              <Download className="w-4 h-4" /> Add App to Tablet
            </button>
          </div>
        )}

        {/* Clear session */}
        {setState && setHasSessionStarted && (
          <button 
            type="button"
            onClick={() => {
              if (confirm("Reset current resuscitation timers and delete recent code logs?")) {
                setState(prev => ({
                  ...prev,
                  isTimerRunning: false,
                  cprTimeLeft: CPR_CYCLE_DURATION,
                  epiTimeLeft: EPI_INTERVAL,
                  totalTime: 0,
                  shocksCount: 0,
                  epiCount: 0,
                  currentRhythm: 'UNKNOWN',
                  cprCycleCount: 0,
                  logs: [],
                  activePrompt: null,
                  rhythmCheckTimeLeft: 0,
                }));
                setHasSessionStarted(false);
              }
            }}
            className="w-full h-10 bg-red-650/15 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400/90 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Wipe Patient Session
          </button>
        )}
      </div>
    );
  };
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
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setActiveTab('timer')}
              className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'timer' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-white/10 text-slate-400'}`}
            >
              <Activity className="w-3.5 h-3.5" /> Workstation
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('algorithm')}
              className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'algorithm' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-white/10 text-slate-400'}`}
            >
              <ClipboardList className="w-3.5 h-3.5" /> Flowchart
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-900 border-white/10 text-slate-400'}`}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {activeTab === 'settings' ? (
            renderDesktopSettings()
          ) : (
            <>
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
          </>
          )}
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
