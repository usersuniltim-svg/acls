import React, { useState, useRef, useEffect } from 'react';
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
  PlusSquare,
  Heart,
  Smartphone,
  Volume2,
  VolumeX,
  Lock,
  Download,
  Vibrate,
  Sliders,
  Printer,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EventType, 
  LogEvent, 
  PatientRhythm, 
  AclsState,
  UserProfile,
  SavedCase
} from '../types';
import { CPR_CYCLE_DURATION, EPI_INTERVAL, HS_AND_TS } from '../constants';
import SavedCasesList from './SavedCasesList';
import LockedGuestOverlay from './LockedGuestOverlay';
import PrintableReport from './PrintableReport';

interface MobileDashboardProps {
  state: AclsState;
  setState: React.Dispatch<React.SetStateAction<AclsState>>;
  hasSessionStarted: boolean;
  setHasSessionStarted: (started: boolean) => void;
  activeTab: 'timer' | 'interventions' | 'algorithm' | 'logs' | 'settings';
  setActiveTab: (tab: any) => void;
  phoneTime: string;
  batteryLevel: number;
  isVibrating: boolean;
  soundEnabled: boolean;
  setSoundEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  metronomeCount: number;
  triggerPwaInstall: () => Promise<void>;
  vibrateDevice: (pattern: number | number[]) => void;
  formatTime: (seconds: number) => string;
  cprProgress: number;
  epiProgress: number;
  toggleTimer: () => void;
  resetCprTimer: () => void;
  handleShock: () => void;
  handleEpi: () => void;
  handleRosc: () => void;
  handleRhythmSelect: (rhythm: PatientRhythm) => void;
  addLog: (type: EventType, description: string) => void;
  effectiveProfile: UserProfile;
  handleStartCPR: () => void;
  hapticDuration: number;
  setHapticDuration: React.Dispatch<React.SetStateAction<number>>;
  hapticIntensity: number;
  setHapticIntensity: React.Dispatch<React.SetStateAction<number>>;
  onOpenAuth?: () => void;
  onOpenKyc?: () => void;
  onOpenAdmin?: () => void;
  onOpenAdminPasswordModal?: () => void;
  onSignOut?: () => void;
  savedCases?: SavedCase[];
  onSaveCurrentCase?: (patientCode: string, signatureDataUrl?: string) => boolean;
  onDeleteCase?: (caseId: string) => void;
  isGuestMode?: boolean;
  theme?: 'medical-white' | 'clinical-dark';
  setTheme?: (theme: 'medical-white' | 'clinical-dark') => void;
}

export default function MobileDashboard({
  state,
  setState,
  hasSessionStarted,
  setHasSessionStarted,
  activeTab,
  setActiveTab,
  phoneTime,
  batteryLevel,
  isVibrating,
  soundEnabled,
  setSoundEnabled,
  metronomeCount,
  triggerPwaInstall,
  vibrateDevice,
  formatTime,
  cprProgress,
  epiProgress,
  toggleTimer,
  resetCprTimer,
  handleShock,
  handleEpi,
  handleRosc,
  handleRhythmSelect,
  addLog,
  effectiveProfile,
  handleStartCPR,
  hapticDuration,
  setHapticDuration,
  hapticIntensity,
  setHapticIntensity,
  onOpenAuth,
  onOpenKyc,
  onOpenAdmin,
  onOpenAdminPasswordModal,
  onSignOut,
  savedCases = [],
  onSaveCurrentCase,
  onDeleteCase,
  isGuestMode = false,
  theme = 'medical-white',
  setTheme,
}: MobileDashboardProps) {

  // Signature Pad canvas logic
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Initialize or handle resize for canvas size
  useEffect(() => {
    if (activeTab === 'logs' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#10B981'; // Warm emerald
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // Sub-tab Render Routines
  const renderMobileTimerTab = () => {
    return (
      <div className="space-y-4 flex flex-col items-center">
        {/* Quick Practitioner Auth & KYC Bar */}
        <div className="w-full flex items-center justify-between gap-1.5 bg-slate-900/80 p-2.5 rounded-xl border border-white/10 shrink-0 text-left">
          <div className="space-y-0.5 truncate pr-1">
            <span className="text-[10px] font-bold text-white block truncate">{effectiveProfile.fullName}</span>
            <span className="text-[8px] text-slate-400 uppercase font-mono block">
              {effectiveProfile.profession.toUpperCase()} • NMC: {effectiveProfile.councilRegistration}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setTheme && setTheme(theme === 'clinical-dark' ? 'medical-white' : 'clinical-dark')}
              className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-[8px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
              title="Toggle Theme"
            >
              {theme === 'clinical-dark' ? (
                <Sun className="w-3 h-3 text-amber-400" />
              ) : (
                <Moon className="w-3 h-3 text-indigo-400" />
              )}
              <span>{theme === 'clinical-dark' ? 'White' : 'Dark'}</span>
            </button>
            <button
              onClick={onOpenAuth}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[8px] font-bold uppercase tracking-wider cursor-pointer border-none"
            >
              Sign In
            </button>
            <button
              onClick={onOpenKyc}
              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[8px] font-bold uppercase tracking-wider cursor-pointer"
            >
              KYC
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-[8px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* State Badge and Session Time */}
        <div className="w-full flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${state.isTimerRunning ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-bold text-slate-350 tracking-wider">
              {state.isTimerRunning ? 'CPR CYCLE RUNNING' : 'TIMERS STANDBY'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[8px] text-slate-500 uppercase font-black block">Total Elapsed</span>
            <span className="font-mono text-xs font-bold text-slate-200 tabular-nums">{formatTime(state.totalTime)}</span>
          </div>
        </div>

        {/* Metronome Visual LED Beads */}
        <div className="w-full bg-slate-900/60 rounded-xl p-3 border border-white/5 space-y-2 text-center shrink-0">
          <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-bold block">ACLS Metronome Compressions Guide (110 BPM)</span>
          <div className="flex items-center justify-center gap-3.5 py-1">
            {[0, 1, 2, 3].map((dotIndex) => (
              <div 
                key={dotIndex}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  state.isTimerRunning && metronomeCount === dotIndex
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] scale-115'
                    : 'bg-slate-800 scale-100'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={() => setSoundEnabled(prev => !prev)}
              className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800/40 px-2.5 py-1 rounded border border-white/5"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3 h-3 text-emerald-400" /> Sound Active
                </>
              ) : (
                <>
                  <VolumeX className="w-3 h-3 text-slate-500" /> Audios Muted
                </>
              )}
            </button>
          </div>
        </div>

        {/* Circular Resuscitation Stopwatch Ring */}
        <div className="relative w-48 h-48 flex items-center justify-center shrink-0 my-1">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#1E293B" strokeWidth="6" />
            <motion.circle 
              cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" 
              className={state.cprTimeLeft < 30 ? 'text-red-500' : 'text-blue-500'}
              strokeDasharray="276.4"
              animate={{ strokeDashoffset: 276.4 - (276.4 * cprProgress) / 100 }}
              transition={{ ease: "linear" }}
            />
          </svg>
          <div className="text-center z-10 select-none">
            <div className={`text-4.5xl font-mono font-bold tracking-tighter tabular-nums ${state.activePrompt === 'RHYTHM_CHECK' ? 'text-emerald-400 animate-pulse' : state.cprTimeLeft < 30 ? 'text-red-400' : 'text-slate-100'}`}>
              {state.activePrompt === 'RHYTHM_CHECK' ? formatTime(state.rhythmCheckTimeLeft) : formatTime(state.cprTimeLeft)}
            </div>
            <p className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mt-0.5">CPR Timeline</p>
            <p className="text-[8px] font-mono text-slate-450 uppercase mt-0.5 font-bold">Cycle #{state.cprCycleCount + 1}</p>
          </div>
        </div>

        {/* CPR Action Controls */}
        <div className="w-full flex gap-2 shrink-0">
          <button 
            onClick={toggleTimer} 
            className={`flex-1 h-12 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all active:scale-95 border-none ${
              state.isTimerRunning 
                ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' 
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {state.isTimerRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current animate-pulse" /> Pause Code
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Resume Code
              </>
            )}
          </button>
          <button 
            onClick={resetCprTimer} 
            className="w-12 h-12 rounded-xl bg-slate-800 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
            title="Next CPR Cycle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Epinephrine Countdown Monitor */}
        <div className="w-full bg-[#1A253F]/20 border border-blue-500/20 p-3 rounded-xl space-y-1.5 text-left shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Syringe className="w-3 h-3" /> Epinephrine Monitor
            </span>
            <span className="text-[8.5px] font-mono text-slate-400 font-bold">#{state.epiCount} Doses Given</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <motion.div className="h-full bg-blue-500" animate={{ width: `${epiProgress}%` }} />
            </div>
            <span className="font-mono text-[11px] font-semibold text-blue-400 tabular-nums">{formatTime(state.epiTimeLeft)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileInterventionsTab = () => {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-md font-display font-bold text-white uppercase tracking-tight">ACLS Treatments</h2>
          <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Physical medications & defibrillation</p>
        </div>

        {/* High tactile drug & shock triggers */}
        <div className="grid grid-cols-2 gap-2.5">
          <button 
            onClick={handleShock}
            className="h-20 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-heavy flex flex-col items-center justify-center gap-1 hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current animate-pulse" />
            <span className="text-[9px] uppercase tracking-widest font-black">Shock ({state.shocksCount})</span>
          </button>
          
          <button 
            onClick={handleEpi}
            className={`h-20 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 font-heavy flex flex-col items-center justify-center gap-1 hover:bg-blue-500 hover:text-white transition-all active:scale-95 ${state.epiTimeLeft === 0 ? 'bg-blue-500/25 border-blue-400 animate-pulse' : ''}`}
          >
            <Syringe className="w-4 h-4 shrink-0" />
            <span className="text-[9px] uppercase tracking-widest font-black">Epinephrine ({state.epiCount})</span>
          </button>
        </div>

        {/* ROSC Achievements */}
        <button 
          onClick={handleRosc}
          className="w-full h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-heavy uppercase text-[9px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-1"
        >
          <Heart className="w-3.5 h-3.5 fill-current" /> Confirm ROSC Achieve
        </button>

        {/* Diagnoses Diagnostic checklist */}
        <div className="glass-panel p-3 bg-slate-900/30 border-white/5 rounded-xl space-y-2">
          <span className="text-[8.5px] uppercase tracking-widest text-[#94A3B8] font-bold block border-b border-white/5 pb-1 text-left">Reversible Causes H's and T's</span>
          <div className="grid grid-cols-2 gap-1.5">
            {HS_AND_TS.map((item, idx) => (
              <label 
                key={idx} 
                className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/45 border border-white/5 cursor-pointer hover:border-white/10 active:scale-98 transition-all"
                onClick={() => vibrateDevice(30)}
              >
                <input 
                  type="checkbox" 
                  className="w-3 h-3 rounded border-slate-700 bg-slate-900 checked:bg-emerald-500 text-emerald-500 filter" 
                  onChange={(e) => {
                    const status = e.target.checked ? 'IDENTIFIED' : 'CLEARED';
                    addLog('INFO', `Diagnostic check: ${item.term} ${status}`);
                  }}
                />
                <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-tighter leading-none leading-tight">{item.term}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => addLog('ADVANCED_AIRWAY', 'Advanced Airway Intubated established')}
            className="h-9 rounded-lg bg-slate-800 text-[8.5px] font-bold uppercase tracking-wider text-slate-400 border border-white/5 active:bg-slate-750 transition-colors"
          >
            Log Intubation
          </button>
          <button 
            type="button"
            onClick={() => addLog('INFO', 'Intravenous and Intraosseous Access confirmed')}
            className="h-9 rounded-lg bg-slate-800 text-[8.5px] font-bold uppercase tracking-wider text-slate-400 border border-white/5 active:bg-slate-755 transition-colors"
          >
            Log IV/IO Acc
          </button>
        </div>
      </div>
    );
  };

  const renderMobileAlgorithmTab = () => {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-md font-display font-bold text-white uppercase tracking-tight">Interactive Pathway</h2>
          <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Cardiology Code highlighted pathways</p>
        </div>

        <div className="p-3 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col items-center overflow-x-hidden">
          {/* Top block */}
          <div className="w-full text-center space-y-1">
            <div className={`p-2.5 rounded-lg border text-center transition-all ${state.currentRhythm === 'UNKNOWN' ? 'bg-blue-500/10 border-blue-500 text-slate-100' : 'bg-slate-850/40 border-slate-800 text-slate-500'}`}>
              <span className="text-[8px] font-bold block opacity-70 uppercase mb-0.5">CPR Entry</span>
              <p className="text-[9.5px] font-bold uppercase">Provide Oxygen • Attach Defibrillator Monitor</p>
            </div>
            <div className="h-3 w-0.5 bg-slate-700 mx-auto" />
            <div className="px-3 py-1 rounded-full border border-indigo-500/20 text-indigo-400 text-[8px] font-bold uppercase tracking-wider w-fit mx-auto bg-slate-950">
              Check Rhythm Check
            </div>
            <div className="h-3 w-0.5 bg-slate-700 mx-auto" />
          </div>

          <div className="flex w-full gap-3 text-left">
            {/* Left: Shockable */}
            <div className="w-1/2 flex flex-col">
              <div className="text-center font-bold text-[7.5px] text-red-400 border border-red-500/20 px-1.5 py-0.5 bg-red-500/5 rounded uppercase w-fit mx-auto mb-1">SHOCKABLE</div>
              
              <div className="space-y-2">
                <div className={`p-2 rounded-lg border text-center transition-all ${state.currentRhythm === 'SHOCKABLE' ? 'bg-red-500/10 border-red-500 text-white font-heavy' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                  <h6 className="text-[8.5px] uppercase font-black tracking-tight">VF / pVT</h6>
                  <p className="text-[7.5px] uppercase mt-0.5">Shock escalations ({state.selectedEnergy}J)</p>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850 text-center text-slate-500">
                  <h6 className="text-[8px] uppercase">CPR 2m + IVIO</h6>
                </div>
                
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850 text-center text-slate-500">
                  <h6 className="text-[8px] uppercase">Epinephrine Q3-5M</h6>
                </div>
              </div>
            </div>

            {/* Right: Non-Shockable */}
            <div className="w-1/2 flex flex-col">
              <div className="text-center font-bold text-[7.5px] text-blue-400 border border-blue-500/20 px-1.5 py-0.5 bg-blue-500/5 rounded uppercase w-fit mx-auto mb-1">NON-SHOCKABLE</div>
              
              <div className="space-y-2">
                <div className={`p-2 rounded-lg border text-center transition-all ${state.currentRhythm === 'NON_SHOCKABLE' ? 'bg-blue-500/10 border-blue-500 text-white font-heavy' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                  <h6 className="text-[8.5px] uppercase font-black tracking-tight">Asystole / PEA</h6>
                  <p className="text-[7.5px] uppercase mt-0.5">Epinephrine ASAP (1mg)</p>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850 text-center text-slate-500">
                  <h6 className="text-[8px] uppercase">CPR 2m Intubate?</h6>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850 text-center text-slate-500">
                  <h6 className="text-[8px] uppercase">Review H's and T's</h6>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileLogsTab = () => {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-md font-display font-bold text-white uppercase tracking-tight">CPR Journal Timeline</h2>
          <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Nepal Registry Compliant logs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 py-0.5 shrink-0 select-none text-center">
          <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5">
            <span className="text-[7.5px] text-slate-500 uppercase font-bold block">CPR Cycles</span>
            <span className="text-xs font-mono font-bold text-white block">{state.cprCycleCount}</span>
          </div>
          <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5">
            <span className="text-[7.5px] text-slate-500 uppercase font-bold block">Shocks</span>
            <span className="text-xs font-mono font-bold text-red-400 block">{state.shocksCount}</span>
          </div>
          <div className="bg-slate-900/40 p-2.5 rounded-xl border border-white/5">
            <span className="text-[7.5px] text-slate-500 uppercase font-bold block">Epi Doses</span>
            <span className="text-xs font-mono font-bold text-blue-400 block">{state.epiCount}</span>
          </div>
        </div>

        {/* Core Timeline list */}
        <div className="glass-panel p-3 bg-slate-900/40 border-white/5 text-left rounded-xl space-y-2">
          <div className="flex justify-between items-center border-b border-white/5 pb-1">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Active Session Timeline</span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-slate-500">{state.logs.length} Events</span>
              {state.logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const origTitle = document.title;
                    document.title = `ACLS_Active_Session_Report_${new Date().toISOString().slice(0, 10)}`;
                    window.print();
                    setTimeout(() => { document.title = origTitle; }, 1000);
                  }}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 border-none cursor-pointer"
                >
                  <Download className="w-2.5 h-2.5" /> Export PDF
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 select-text custom-scrollbar">
            {state.logs.length === 0 ? (
              <div className="text-center py-6 text-[8px] uppercase text-slate-650 tracking-wider">No active events recorded. Start timers to generate logs.</div>
            ) : (
              state.logs.map((log) => (
                <div key={log.id} className="flex gap-2 items-start pl-2 border-l border-slate-800">
                  <span className="text-[8px] font-mono text-blue-400 shrink-0 font-bold">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </span>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-300 leading-tight block">{log.description}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ACTIVE SESSION PRINT REPORT FOR MOBILE */}
        {state.logs.length > 0 && (
          <PrintableReport
            patientCode="ACTIVE-SESSION"
            savedAt={new Date().getTime()}
            totalDuration={state.totalTime}
            cprCycleCount={state.cprCycleCount}
            shocksCount={state.shocksCount}
            epiCount={state.epiCount}
            logs={state.logs}
            certifiedBy={effectiveProfile.fullName}
            councilRegistration={effectiveProfile.councilRegistration}
            currentRhythm={state.currentRhythm}
          />
        )}

        {/* Saved Cases Manager (Max 3 Cases) */}
        <SavedCasesList
          savedCases={savedCases}
          onSaveCurrentCase={onSaveCurrentCase || (() => false)}
          onDeleteCase={onDeleteCase || (() => {})}
          hasCurrentLogs={state.logs.length > 0}
          practitionerName={effectiveProfile.fullName}
          councilRegistration={effectiveProfile.councilRegistration}
        />

        {/* Canvas Signature pad */}
        <div className="glass-panel p-3 bg-slate-900/40 border-white/5 rounded-xl space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-black text-slate-450 uppercase tracking-wider">Authentication Signature Draw</span>
            <button 
              onClick={clearSignature} 
              className="text-[7.5px] bg-slate-800 text-slate-500 hover:text-white px-2 py-0.5 rounded font-black uppercase tracking-tighter"
            >
              Reset Pad
            </button>
          </div>
          <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-[#090d16] h-20 touch-none">
            <canvas 
              ref={canvasRef}
              width={340}
              height={80}
              className="w-full h-full cursor-crosshair pb-1"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            {!hasSigned && (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center pointer-events-none select-none">
                <span className="text-[8px] text-slate-600 uppercase font-mono tracking-widest leading-none">SIGN HERE TO LOCK AND SIGN CODE PROTOCOL LOGS</span>
              </div>
            )}
          </div>
          {hasSigned && (
            <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider block animate-pulse">
              ✓ Log certified by local practitioner: {effectiveProfile.fullName}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderMobileSettingsTab = () => {
    return (
      <div className="space-y-4 text-left">
        <div>
          <h2 className="text-md font-display font-bold text-white uppercase tracking-tight">Configuration</h2>
          <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Parameters & mobile device offline installations</p>
        </div>

        {/* Display Theme Switcher Card */}
        <div className="glass-panel p-3.5 bg-slate-900/50 border-white/5 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <Sun className="w-4 h-4 text-amber-400" />
              <Moon className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Display Theme</h4>
            </div>
            <span className="text-[8px] font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
              {theme === 'clinical-dark' ? 'CLINICAL DARK' : 'MEDICAL WHITE'}
            </span>
          </div>

          <p className="text-[9.5px] text-slate-300 leading-normal font-sans">
            Toggle between <strong>Medical White</strong> for bright spaces and <strong>Clinical Dark</strong> for low-light clinical environments. Persisted in local storage.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setTheme && setTheme('medical-white')}
              className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                theme === 'medical-white'
                  ? 'bg-white text-black border-red-600 shadow ring-1 ring-red-600'
                  : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Medical White</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme && setTheme('clinical-dark')}
              className={`py-2 rounded-lg border flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                theme === 'clinical-dark'
                  ? 'bg-slate-950 text-white border-blue-500 shadow ring-1 ring-blue-500'
                  : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Clinical Dark</span>
            </button>
          </div>
        </div>

        {/* Haptic Vibration Feedback Settings Panel */}
        <div className="glass-panel p-3.5 bg-slate-900/50 border-white/5 rounded-xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <div className="flex items-center gap-1.5 text-blue-400">
              <Vibrate className="w-4 h-4" />
              <span className="text-[9px] uppercase tracking-wider font-bold">Haptic Vibration Feedback</span>
            </div>
            <span className="text-[8px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              TACTILE ACTIVE
            </span>
          </div>

          {/* Slider 1: Vibration Duration */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[8.5px] uppercase font-bold">
              <label htmlFor="mobile-haptic-duration-slider" className="text-slate-300">Vibration Burst Duration</label>
              <span className="text-blue-400 font-mono font-bold text-[9.5px]">{hapticDuration} ms</span>
            </div>
            <input 
              id="mobile-haptic-duration-slider"
              type="range"
              min="50"
              max="500"
              step="10"
              value={hapticDuration}
              onChange={(e) => setHapticDuration(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[7.5px] text-slate-500 font-mono uppercase font-bold">
              <span>50ms (Short)</span>
              <span>250ms (Standard)</span>
              <span>500ms (Long)</span>
            </div>
          </div>

          {/* Slider 2: Vibration Intensity */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[8.5px] uppercase font-bold">
              <label htmlFor="mobile-haptic-intensity-slider" className="text-slate-300">Vibration Pulse Intensity</label>
              <span className="text-emerald-400 font-mono font-bold text-[9.5px]">
                Level {hapticIntensity} ({hapticIntensity === 1 ? 'Soft' : hapticIntensity === 2 ? 'Light' : hapticIntensity === 3 ? 'Medium' : hapticIntensity === 4 ? 'Strong' : 'Maximum'})
              </span>
            </div>
            <input 
              id="mobile-haptic-intensity-slider"
              type="range"
              min="1"
              max="5"
              step="1"
              value={hapticIntensity}
              onChange={(e) => setHapticIntensity(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[7.5px] text-slate-500 font-mono uppercase font-bold">
              <span>L1 (Subtle)</span>
              <span>L3 (Standard)</span>
              <span>L5 (Max Pulse)</span>
            </div>
          </div>

          {/* Test Vibration Pattern Button */}
          <button 
            id="mobile-test-haptic-btn"
            type="button"
            onClick={() => vibrateDevice([150, 80, 200])}
            className="w-full h-8.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:text-white rounded-lg text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow"
          >
            <Activity className="w-3.5 h-3.5" /> Test Haptic Vibration Pattern
          </button>
        </div>

        {/* defib config */}
        <div className="glass-panel p-3 bg-slate-900/40 border-white/5 rounded-xl space-y-3">
          <div className="space-y-1">
            <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block border-b border-white/5 pb-0.5">Defibrillator Type</span>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setState(prev => ({ ...prev, defibType: 'BIPHASIC', selectedEnergy: Math.min(200, prev.selectedEnergy) }))}
                className={`py-1.5 rounded-lg border text-center transition-colors uppercase text-[9px] font-black ${state.defibType === 'BIPHASIC' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#0b0f19] border-slate-800 text-slate-500'}`}
              >
                Biphasic
              </button>
              <button 
                onClick={() => setState(prev => ({ ...prev, defibType: 'MONOPHASIC', selectedEnergy: 360 }))}
                className={`py-1.5 rounded-lg border text-center transition-colors uppercase text-[9px] font-black ${state.defibType === 'MONOPHASIC' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#0b0f19] border-slate-800 text-slate-500'}`}
              >
                Monophasic
              </button>
            </div>
          </div>

          {state.defibType === 'BIPHASIC' && (
            <div className="space-y-1">
              <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block border-b border-white/5 pb-0.5">Shock energy levels</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[120, 150, 200].map((joules) => (
                  <button 
                    key={joules}
                    onClick={() => setState(prev => ({ ...prev, selectedEnergy: joules }))}
                    className={`py-1 rounded border text-[9px] font-mono font-bold transition-colors ${state.selectedEnergy === joules ? 'bg-red-500 border-red-500 text-white' : 'bg-[#0b0f19] border-slate-800 text-slate-500'}`}
                  >
                    {joules}J
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PWA offline */}
        <div className="glass-panel p-3 bg-emerald-950/10 border-emerald-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Smartphone className="w-4.5 h-4.5" />
            <h5 className="text-[9px] font-bold uppercase tracking-wider">Android PWA Direct Installer</h5>
          </div>
          <p className="text-[8.5px] text-slate-400 leading-normal uppercase font-bold">
            Enable offline, sandboxed, fast operations inside hospitals by clicking below to download and pin on home screens.
          </p>
          <button 
            onClick={triggerPwaInstall}
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heavy uppercase text-[8.5px] tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer border-none shadow-md shadow-emerald-600/15"
          >
            <Download className="w-3.5 h-3.5" /> Add to Android Desktop
          </button>
          
          <div className="text-[8px] text-slate-500 leading-normal bg-slate-950 p-2 rounded border border-white/5 font-mono uppercase space-y-0.5 font-bold">
            <span className="text-slate-400 block font-heavy">Manual installation guide:</span>
            <span>1. Open in Google Chrome on your Samsung or Pixel.</span>
            <br />
            <span>2. Click browser menu button (3 vertical dots ⋮).</span>
            <br />
            <span>3. Click "Install app" or "Add to Home screen" option.</span>
          </div>
        </div>

        {/* Clear everything */}
        <button 
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
          className="w-full h-9 bg-red-650/15 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400/90 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
        >
          Wipe Patient session
        </button>
      </div>
    );
  };

  const isVerifiedDoctor = Boolean(
    effectiveProfile?.kyc?.kycStatus === 'approved' ||
    effectiveProfile?.kyc?.kycStatus === 'pending' ||
    (effectiveProfile?.councilRegistration && effectiveProfile?.councilRegistration !== 'GUEST-KMC-003') ||
    effectiveProfile?.email
  );
  const hasFullAccess = !isGuestMode && isVerifiedDoctor;

  return (
    <div className="flex-1 flex flex-col bg-medical-dark overflow-hidden relative" id="mobile-viewport">
      {/* Main viewport Container (scrollable + bottom offset) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 custom-scrollbar scroll-smooth">
        
        {/* Guest Mode Limited Access Banner */}
        {isGuestMode && (
          <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 flex flex-col gap-2 text-amber-200 text-xs shadow-lg text-left select-none">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-extrabold text-[10px] uppercase tracking-wider text-amber-300">
                  Guest Mode Active (CPR Timer & Drug Trackers)
                </p>
                <p className="text-[9px] text-amber-100/90 leading-relaxed font-sans">
                  You are using restricted Guest Mode. Access is given ONLY to Timers and Drugs. Please <strong className="text-white underline cursor-pointer" onClick={onOpenAuth}>Sign In & Get Verified</strong> for full access to Flowcharts, Logs & Settings.
                </p>
              </div>
            </div>
            <button
              onClick={onOpenAuth}
              className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider shrink-0 cursor-pointer border-none shadow-md text-center"
            >
              Sign In For Full Access
            </button>
          </div>
        )}
        
        {/* Urgent Alerts bar */}
        {state.activePrompt === 'EPI_DUE' && (
          <motion.div 
            key={`epi-notification-interval-${Math.floor((state.epiDueElapsed || 0) / 7)}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/35 flex items-center justify-between gap-1 animate-pulse select-none text-left"
          >
            <div className="space-y-0.5">
              <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block font-bold">Epinephrine notification</span>
              <p className="text-[9px] text-[#A5F3FC] font-bold uppercase font-sans">ADMINISTER 1MG EPINEPHRINE NOW</p>
            </div>
            <button 
              onClick={handleEpi}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white text-[8px] font-black uppercase tracking-wider rounded border-none active:scale-95 transition-transform"
            >
              Push drug
            </button>
          </motion.div>
        )}

        {/* Dynamic active tabs layout render */}
        {activeTab === 'timer' && renderMobileTimerTab()}
        {activeTab === 'interventions' && renderMobileInterventionsTab()}
        {activeTab === 'algorithm' && (
          hasFullAccess ? renderMobileAlgorithmTab() : <LockedGuestOverlay title="Flowchart Restricted" onOpenAuth={onOpenAuth} onOpenKyc={onOpenKyc} />
        )}
        {activeTab === 'logs' && (
          hasFullAccess ? renderMobileLogsTab() : <LockedGuestOverlay title="Journal Logs Restricted" onOpenAuth={onOpenAuth} onOpenKyc={onOpenKyc} />
        )}
        {activeTab === 'settings' && (
          hasFullAccess ? renderMobileSettingsTab() : <LockedGuestOverlay title="Configuration Restricted" onOpenAuth={onOpenAuth} onOpenKyc={onOpenKyc} />
        )}

        {/* Mandatory Disclaimer & Copyright Notice Footer */}
        <div className="mt-6 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center space-y-1">
          <p className="text-[9.5px] text-amber-300 font-medium leading-tight">
            This app has not been validated clinically as a tool. It is intended to use for academic purpose. Please use cautiously.
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <p className="text-[9.5px] text-slate-400 font-semibold uppercase tracking-wider">
              Copyright © Dr. Sunil Timilsina, MBBS
            </p>
            <button
              type="button"
              onClick={onOpenAdminPasswordModal || onOpenAdmin}
              className="text-slate-600 hover:text-slate-400 text-[9px] p-0.5 bg-transparent border-none cursor-pointer"
              title="Admin Portal"
            >
              🛡️
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Bottom Nav Tab bar */}
      <nav className="absolute bottom-0 left-0 right-0 h-16 bg-[#0c111d]/95 backdrop-blur-md border-t border-white/5 flex items-center justify-around z-40 px-2 shadow-2xl">
        <NavButton active={activeTab === 'timer'} onClick={() => setActiveTab('timer')} icon={Activity} label="TIMERS" />
        <NavButton active={activeTab === 'interventions'} onClick={() => setActiveTab('interventions')} icon={Syringe} label="DRUGS" />
        <NavButton active={activeTab === 'algorithm'} onClick={() => setActiveTab('algorithm')} icon={ClipboardList} label="FLOWCHART" isLocked={!hasFullAccess} />
        <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={History} label="JOURNAL" isLocked={!hasFullAccess} />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="CONFIG" isLocked={!hasFullAccess} />
      </nav>
    </div>
  );
}

// Low level local utility component
function NavButton({ active, onClick, icon: Icon, label, isLocked }: { active: boolean; onClick: () => void; icon: any; label: string; isLocked?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg border-none bg-transparent transition-all cursor-pointer relative ${active ? 'text-blue-400 bg-blue-500/5 shadow-inner' : 'text-slate-500 hover:text-slate-350'}`}
    >
      <div className="relative">
        <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : ''}`} />
        {isLocked && (
          <span className="absolute -top-1 -right-1.5 bg-red-600 text-white rounded-full p-0.5 text-[6px]">
            <Lock className="w-2.5 h-2.5 stroke-[3]" />
          </span>
        )}
      </div>
      <span className="text-[7.5px] font-black mt-1 uppercase tracking-tight leading-none">{label}</span>
    </button>
  );
}
