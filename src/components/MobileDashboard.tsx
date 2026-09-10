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
  Heart,
  Smartphone,
  Volume2,
  VolumeX,
  Lock,
  Download,
  Vibrate,
  Sun,
  Moon,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Database,
  RefreshCw,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EventType, 
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
  syncStatus?: 'synced' | 'syncing' | 'offline';
  lastSyncedAt?: number | null;
  onForceSync?: () => Promise<void>;
  onOpenCopilot?: () => void;
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
  syncStatus = 'synced',
  lastSyncedAt,
  onForceSync,
  onOpenCopilot,
}: MobileDashboardProps) {
  const isDark = theme === 'clinical-dark';

  // Signature Pad canvas logic
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    if (activeTab === 'logs' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = isDark ? '#090d16' : '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [activeTab, isDark]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = isDark ? '#10B981' : '#059669';
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
    ctx.fillStyle = isDark ? '#090d16' : '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const isVerifiedDoctor = effectiveProfile?.kyc?.kycStatus === 'approved';
  const isPendingDoctor = effectiveProfile?.kyc?.kycStatus === 'pending';
  const hasFullAccess = !isGuestMode && (isVerifiedDoctor || isPendingDoctor);

  // Common Card Styles
  const cardClass = isDark
    ? 'bg-slate-900/70 border-white/10 text-white shadow-lg'
    : 'bg-white border-gray-200 text-slate-900 shadow-sm';
  const subCardClass = isDark
    ? 'bg-slate-950/60 border-white/5 text-slate-300'
    : 'bg-gray-50 border-gray-200 text-gray-700';
  const textMuted = isDark ? 'text-slate-400' : 'text-gray-500';

  // Sub-tab Render Routines
  const renderMobileTimerTab = () => {
    return (
      <div className="space-y-3.5 flex flex-col items-center">
        {/* Quick Practitioner Auth & KYC Bar */}
        <div className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-2xl border text-left ${cardClass}`}>
          <div className="space-y-0.5 truncate pr-1">
            <span className={`text-[11px] font-bold block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {effectiveProfile.fullName}
            </span>
            <span className={`text-[8.5px] uppercase font-mono block ${textMuted}`}>
              {effectiveProfile.profession.toUpperCase()} • NMC: {effectiveProfile.councilRegistration}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenCopilot}
              className={`px-2 py-1 rounded-xl text-[8.5px] font-bold uppercase tracking-wider cursor-pointer border flex items-center gap-1 ${
                isVerifiedDoctor && !isGuestMode
                  ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
              }`}
              title={
                isVerifiedDoctor && !isGuestMode
                  ? "Open Gemini ACLS AI Co-Pilot (Verified Doctor)"
                  : "ACLS AI Co-Pilot restricted to signed-in, KYC-verified doctors"
              }
            >
              {isVerifiedDoctor && !isGuestMode ? (
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>AI</span>
              {!(isVerifiedDoctor && !isGuestMode) && (
                <span className="text-[7px] font-mono px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-extrabold">KYC</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTheme && setTheme(isDark ? 'medical-white' : 'clinical-dark')}
              className={`p-1.5 rounded-xl border text-[8.5px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-colors ${
                isDark 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30' 
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
            </button>
            <button
              type="button"
              onClick={onOpenAuth}
              className={`px-2 py-1 rounded-xl text-[8.5px] font-bold uppercase tracking-wider cursor-pointer border ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-slate-800 border-gray-300'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onOpenKyc}
              className={`px-2 py-1 rounded-xl text-[8.5px] font-bold uppercase tracking-wider cursor-pointer border ${
                isVerifiedDoctor
                  ? isDark ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}
            >
              {isVerifiedDoctor ? 'Verified' : 'KYC'}
            </button>
          </div>
        </div>

        {/* State Badge and Session Time */}
        <div className={`w-full flex justify-between items-center p-3 rounded-2xl border ${cardClass}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${state.isTimerRunning ? 'bg-red-600 animate-pulse ring-4 ring-red-500/20' : 'bg-slate-400'}`} />
            <span className={`text-[9.5px] font-bold tracking-wider uppercase ${state.isTimerRunning ? 'text-red-600 font-black' : textMuted}`}>
              {state.isTimerRunning ? 'CPR CYCLE IN PROGRESS' : 'TIMERS STANDBY'}
            </span>
          </div>
          <div className="text-right">
            <span className={`text-[8px] uppercase font-black block ${textMuted}`}>Total Elapsed</span>
            <span className={`font-mono text-sm font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatTime(state.totalTime)}
            </span>
          </div>
        </div>

        {/* Metronome Visual LED Beads */}
        <div className={`w-full rounded-2xl p-3 border text-center space-y-2 ${cardClass}`}>
          <div className="flex items-center justify-between px-1">
            <span className={`text-[8.5px] uppercase tracking-wider font-bold ${textMuted}`}>
              Metronome Compressions (110 BPM)
            </span>
            <button 
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className={`text-[8.5px] font-bold uppercase tracking-wider flex items-center gap-1 px-2 py-0.5 rounded-lg border cursor-pointer ${
                isDark ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3 h-3 text-emerald-500" /> Audio On
                </>
              ) : (
                <>
                  <VolumeX className="w-3 h-3 text-gray-400" /> Muted
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 py-1">
            {[0, 1, 2, 3].map((dotIndex) => (
              <div 
                key={dotIndex}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  state.isTimerRunning && metronomeCount === dotIndex
                    ? 'bg-emerald-500 shadow-[0_0_12px_#10b981] scale-125'
                    : isDark ? 'bg-slate-800 scale-100' : 'bg-gray-200 scale-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Circular Resuscitation Stopwatch Ring */}
        <div className="relative w-48 h-48 flex items-center justify-center shrink-0 my-1">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle 
              cx="50" 
              cy="50" 
              r="44" 
              fill="none" 
              stroke={isDark ? '#1E293B' : '#E2E8F0'} 
              strokeWidth="6" 
            />
            <motion.circle 
              cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6" 
              className={state.cprTimeLeft < 30 ? 'text-red-600' : 'text-blue-600'}
              strokeDasharray="276.4"
              animate={{ strokeDashoffset: 276.4 - (276.4 * cprProgress) / 100 }}
              transition={{ ease: "linear" }}
            />
          </svg>
          <div className="text-center z-10 select-none">
            <div className={`text-4.5xl font-mono font-black tracking-tight tabular-nums ${
              state.activePrompt === 'RHYTHM_CHECK' 
                ? 'text-emerald-500 animate-pulse' 
                : state.cprTimeLeft < 30 
                  ? 'text-red-600' 
                  : isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {state.activePrompt === 'RHYTHM_CHECK' ? formatTime(state.rhythmCheckTimeLeft) : formatTime(state.cprTimeLeft)}
            </div>
            <p className={`text-[9px] uppercase font-bold tracking-wider mt-0.5 ${textMuted}`}>CPR Timeline</p>
            <p className="text-[8.5px] font-mono text-red-600 uppercase mt-0.5 font-extrabold">Cycle #{state.cprCycleCount + 1}</p>
          </div>
        </div>

        {/* CPR Action Controls */}
        <div className="w-full flex gap-2 shrink-0">
          <button 
            type="button"
            onClick={toggleTimer} 
            className={`flex-1 h-12 rounded-2xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 border-none shadow-md cursor-pointer ${
              state.isTimerRunning 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {state.isTimerRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current animate-pulse" /> Pause Code
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Resume Code
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={resetCprTimer} 
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer ${
              isDark ? 'bg-slate-800 border-white/10 text-slate-300 hover:text-white' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            }`}
            title="Next CPR Cycle"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Epinephrine Countdown Monitor */}
        <div className={`w-full p-3.5 rounded-2xl border space-y-2 text-left shrink-0 ${
          isDark ? 'bg-blue-950/30 border-blue-500/30' : 'bg-blue-50/80 border-blue-200'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Syringe className="w-3.5 h-3.5" /> Epinephrine Monitor
            </span>
            <span className={`text-[8.5px] font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              #{state.epiCount} Doses Given
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-gray-200'}`}>
              <motion.div className="h-full bg-blue-600" animate={{ width: `${epiProgress}%` }} />
            </div>
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatTime(state.epiTimeLeft)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileInterventionsTab = () => {
    return (
      <div className="space-y-3.5 text-left">
        <div>
          <h2 className={`text-base font-display font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ACLS Treatments & Meds
          </h2>
          <p className={`text-[8.5px] uppercase font-bold tracking-widest mt-0.5 ${textMuted}`}>
            Physical medications, Defibrillation & Causes
          </p>
        </div>

        {/* Shock and Epinephrine Action Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <button 
            type="button"
            onClick={handleShock}
            className="h-22 rounded-2xl border border-red-500/40 bg-red-600 text-white font-extrabold flex flex-col items-center justify-center gap-1.5 hover:bg-red-700 transition-all active:scale-95 shadow-md cursor-pointer"
          >
            <Zap className="w-5 h-5 fill-current animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider font-black">
              Shock ({state.shocksCount}) • {state.selectedEnergy}J
            </span>
          </button>
          
          <button 
            type="button"
            onClick={handleEpi}
            className={`h-22 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer ${
              state.epiTimeLeft === 0 
                ? 'bg-blue-600 text-white border-blue-400 animate-pulse' 
                : isDark 
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30' 
                  : 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200'
            }`}
          >
            <Syringe className="w-5 h-5" />
            <span className="text-[10px] uppercase tracking-wider font-black">
              Epi 1mg ({state.epiCount})
            </span>
          </button>
        </div>

        {/* ROSC Achievements */}
        <button 
          type="button"
          onClick={handleRosc}
          className={`w-full h-11 rounded-2xl border font-bold uppercase text-[9.5px] tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            isDark 
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30' 
              : 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200'
          }`}
        >
          <Heart className="w-4 h-4 fill-current text-emerald-600" /> Confirm ROSC Achievement
        </button>

        {/* Reversible Causes Checklist (H's and T's) */}
        <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardClass}`}>
          <div className="flex justify-between items-center border-b pb-1.5 border-inherit">
            <span className="text-[9px] uppercase tracking-wider font-bold text-red-600">
              Reversible Causes (H's and T's)
            </span>
            <span className={`text-[8px] font-mono ${textMuted}`}>10 Checkpoints</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HS_AND_TS.map((item, idx) => (
              <label 
                key={idx} 
                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${subCardClass}`}
                onClick={() => vibrateDevice(30)}
              >
                <input 
                  type="checkbox" 
                  className="w-3.5 h-3.5 rounded border-gray-400 text-red-600 focus:ring-red-500" 
                  onChange={(e) => {
                    const status = e.target.checked ? 'IDENTIFIED' : 'CLEARED';
                    addLog('INFO', `Diagnostic check: ${item.term} ${status}`);
                  }}
                />
                <span className={`text-[9px] font-bold uppercase tracking-tight leading-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {item.term}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            type="button"
            onClick={() => addLog('ADVANCED_AIRWAY', 'Advanced Airway Intubated established')}
            className={`h-10 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              isDark ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Log Intubation
          </button>
          <button 
            type="button"
            onClick={() => addLog('INFO', 'Intravenous and Intraosseous Access confirmed')}
            className={`h-10 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              isDark ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Log IV/IO Acc
          </button>
        </div>
      </div>
    );
  };

  const renderMobileAlgorithmTab = () => {
    return (
      <div className="space-y-3 text-left">
        <div>
          <h2 className={`text-base font-display font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Interactive ACLS Flowchart
          </h2>
          <p className={`text-[8.5px] uppercase font-bold tracking-widest mt-0.5 ${textMuted}`}>
            2025 Nepal Registry & AHA Standard Pathway
          </p>
        </div>

        <div className={`p-4 rounded-2xl border flex flex-col items-center ${cardClass}`}>
          {/* Top block */}
          <div className="w-full text-center space-y-1.5">
            <div className={`p-3 rounded-xl border text-center transition-all ${
              state.currentRhythm === 'UNKNOWN' 
                ? 'bg-red-50 border-red-500 text-red-950 font-bold' 
                : subCardClass
            }`}>
              <span className="text-[8.5px] font-bold block opacity-80 uppercase mb-0.5">CPR Entry Step</span>
              <p className="text-[10px] font-extrabold uppercase">Provide Oxygen • Attach Defibrillator Monitor</p>
            </div>
            <div className="h-3 w-0.5 bg-gray-400 mx-auto" />
            <div className={`px-3 py-1 rounded-full border text-[8.5px] font-bold uppercase tracking-wider w-fit mx-auto ${
              isDark ? 'bg-slate-950 border-indigo-500/30 text-indigo-300' : 'bg-white border-indigo-300 text-indigo-700 shadow-sm'
            }`}>
              Check Cardiac Rhythm
            </div>
            <div className="h-3 w-0.5 bg-gray-400 mx-auto" />
          </div>

          <div className="flex w-full gap-3 text-left pt-1">
            {/* Left: Shockable */}
            <div className="w-1/2 flex flex-col">
              <div className="text-center font-bold text-[8px] text-red-600 border border-red-300 px-2 py-0.5 bg-red-50 rounded-lg uppercase w-fit mx-auto mb-1.5">
                SHOCKABLE
              </div>
              
              <div className="space-y-2">
                <div className={`p-2.5 rounded-xl border text-center transition-all ${
                  state.currentRhythm === 'SHOCKABLE' 
                    ? 'bg-red-600 text-white font-extrabold shadow-md' 
                    : subCardClass
                }`}>
                  <h6 className="text-[9px] uppercase font-black tracking-tight">VF / pVT</h6>
                  <p className="text-[8px] uppercase mt-0.5 opacity-90">Defibrillate ({state.selectedEnergy}J)</p>
                </div>

                <div className={`p-2 rounded-xl border text-center ${subCardClass}`}>
                  <h6 className="text-[8.5px] uppercase font-bold">CPR 2m + IV/IO</h6>
                </div>
                
                <div className={`p-2 rounded-xl border text-center ${subCardClass}`}>
                  <h6 className="text-[8.5px] uppercase font-bold">Epinephrine Q3-5M</h6>
                </div>

                <div className={`p-2 rounded-xl border text-center ${subCardClass}`}>
                  <h6 className="text-[8.5px] uppercase font-bold">Amiodarone 300mg</h6>
                </div>
              </div>
            </div>

            {/* Right: Non-Shockable */}
            <div className="w-1/2 flex flex-col">
              <div className="text-center font-bold text-[8px] text-blue-600 border border-blue-300 px-2 py-0.5 bg-blue-50 rounded-lg uppercase w-fit mx-auto mb-1.5">
                NON-SHOCKABLE
              </div>
              
              <div className="space-y-2">
                <div className={`p-2.5 rounded-xl border text-center transition-all ${
                  state.currentRhythm === 'NON_SHOCKABLE' 
                    ? 'bg-blue-600 text-white font-extrabold shadow-md' 
                    : subCardClass
                }`}>
                  <h6 className="text-[9px] uppercase font-black tracking-tight">Asystole / PEA</h6>
                  <p className="text-[8px] uppercase mt-0.5 opacity-90">Epi ASAP (1mg)</p>
                </div>

                <div className={`p-2 rounded-xl border text-center ${subCardClass}`}>
                  <h6 className="text-[8.5px] uppercase font-bold">CPR 2m + Intubate</h6>
                </div>

                <div className={`p-2 rounded-xl border text-center ${subCardClass}`}>
                  <h6 className="text-[8.5px] uppercase font-bold">Review H's and T's</h6>
                </div>

                <div className={`p-2 rounded-xl border text-center ${subCardClass}`}>
                  <h6 className="text-[8.5px] uppercase font-bold">Epi Q3-5 Min</h6>
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
      <div className="space-y-3.5 text-left">
        <div>
          <h2 className={`text-base font-display font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Resuscitation Journal Logs
          </h2>
          <p className={`text-[8.5px] uppercase font-bold tracking-widest mt-0.5 ${textMuted}`}>
            Nepal Registry Log, Export & Digital Signatures
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 shrink-0 select-none text-center">
          <div className={`p-2.5 rounded-2xl border ${cardClass}`}>
            <span className={`text-[8px] uppercase font-bold block ${textMuted}`}>CPR Cycles</span>
            <span className={`text-sm font-mono font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>{state.cprCycleCount}</span>
          </div>
          <div className={`p-2.5 rounded-2xl border ${cardClass}`}>
            <span className={`text-[8px] uppercase font-bold block ${textMuted}`}>Shocks</span>
            <span className="text-sm font-mono font-bold text-red-600 block">{state.shocksCount}</span>
          </div>
          <div className={`p-2.5 rounded-2xl border ${cardClass}`}>
            <span className={`text-[8px] uppercase font-bold block ${textMuted}`}>Epi Doses</span>
            <span className="text-sm font-mono font-bold text-blue-600 block">{state.epiCount}</span>
          </div>
        </div>

        {/* Active Session Timeline */}
        <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardClass}`}>
          <div className="flex justify-between items-center border-b pb-1.5 border-inherit">
            <span className={`text-[9px] uppercase tracking-wider font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
              Active Session Events
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[8.5px] font-mono ${textMuted}`}>{state.logs.length} Events</span>
              {state.logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const origTitle = document.title;
                    document.title = `ACLS_Active_Session_Report_${new Date().toISOString().slice(0, 10)}`;
                    window.print();
                    setTimeout(() => { document.title = origTitle; }, 1000);
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[8.5px] font-bold uppercase tracking-wider flex items-center gap-1 border-none cursor-pointer shadow-sm"
                >
                  <Download className="w-3 h-3" /> Export PDF
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 select-text custom-scrollbar">
            {state.logs.length === 0 ? (
              <div className={`text-center py-6 text-[9px] uppercase tracking-wider ${textMuted}`}>
                No active events recorded. Start timers or log interventions to generate entries.
              </div>
            ) : (
              state.logs.map((log) => (
                <div key={log.id} className="flex gap-2.5 items-start pl-2 border-l-2 border-red-500">
                  <span className="text-[8.5px] font-mono text-red-600 font-bold shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </span>
                  <div>
                    <span className={`text-[9.5px] uppercase font-bold leading-tight block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {log.description}
                    </span>
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

        {/* Canvas Signature Pad */}
        <div className={`p-3.5 rounded-2xl border space-y-2 ${cardClass}`}>
          <div className="flex justify-between items-center">
            <span className={`text-[8.5px] font-bold uppercase tracking-wider ${textMuted}`}>
              Digital Doctor Signature
            </span>
            <button 
              type="button"
              onClick={clearSignature} 
              className={`text-[8px] px-2 py-0.5 rounded-lg font-bold uppercase cursor-pointer border ${
                isDark ? 'bg-slate-800 border-white/10 text-slate-300' : 'bg-gray-100 border-gray-300 text-gray-700'
              }`}
            >
              Reset Pad
            </button>
          </div>
          <div className={`relative border rounded-xl overflow-hidden h-20 touch-none ${
            isDark ? 'bg-[#090d16] border-slate-800' : 'bg-gray-50 border-gray-300'
          }`}>
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
                <span className={`text-[8.5px] uppercase font-mono tracking-widest ${textMuted}`}>
                  SIGN HERE TO CERTIFY THIS CODE PROTOCOL LOG
                </span>
              </div>
            )}
          </div>
          {hasSigned && (
            <span className="text-[8.5px] text-emerald-600 font-bold uppercase tracking-wider block animate-pulse">
              ✓ Log certified by practitioner: {effectiveProfile.fullName} (NMC: {effectiveProfile.councilRegistration})
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderMobileSettingsTab = () => {
    return (
      <div className="space-y-3.5 text-left">
        <div>
          <h2 className={`text-base font-display font-bold uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Configuration & Tools
          </h2>
          <p className={`text-[8.5px] uppercase font-bold tracking-widest mt-0.5 ${textMuted}`}>
            Hardware haptics, theme and Android PWA installer
          </p>
        </div>

        {/* Display Theme Switcher Card */}
        <div className={`p-3.5 rounded-2xl border space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between border-b pb-1.5 border-inherit">
            <div className="flex items-center gap-1.5 text-indigo-600">
              <Sun className="w-4 h-4 text-amber-500" />
              <Moon className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Display Theme</h4>
            </div>
            <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded border ${
              isDark ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {isDark ? 'CLINICAL DARK' : 'MEDICAL WHITE'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setTheme && setTheme('medical-white')}
              className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                !isDark
                  ? 'bg-white text-black border-red-600 shadow ring-2 ring-red-600'
                  : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Medical White</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme && setTheme('clinical-dark')}
              className={`py-2 rounded-xl border flex items-center justify-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-950 text-white border-blue-500 shadow ring-2 ring-blue-500'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Clinical Dark</span>
            </button>
          </div>
        </div>

        {/* Haptic Vibration Feedback Settings Panel */}
        <div className={`p-3.5 rounded-2xl border space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between border-b pb-1.5 border-inherit">
            <div className="flex items-center gap-1.5 text-blue-600">
              <Vibrate className="w-4 h-4" />
              <span className="text-[9.5px] uppercase tracking-wider font-bold">Haptic Vibration Settings</span>
            </div>
            <span className="text-[8px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ACTIVE
            </span>
          </div>

          {/* Slider 1: Vibration Duration */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8.5px] uppercase font-bold">
              <label htmlFor="mobile-haptic-duration-slider" className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                Vibration Burst Duration
              </label>
              <span className="text-blue-600 font-mono font-bold text-[9.5px]">{hapticDuration} ms</span>
            </div>
            <input 
              id="mobile-haptic-duration-slider"
              type="range"
              min="50"
              max="500"
              step="10"
              value={hapticDuration}
              onChange={(e) => setHapticDuration(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Slider 2: Vibration Intensity */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[8.5px] uppercase font-bold">
              <label htmlFor="mobile-haptic-intensity-slider" className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                Pulse Intensity
              </label>
              <span className="text-emerald-600 font-mono font-bold text-[9.5px]">
                Level {hapticIntensity} ({hapticIntensity === 1 ? 'Soft' : hapticIntensity === 2 ? 'Light' : hapticIntensity === 3 ? 'Medium' : hapticIntensity === 4 ? 'Strong' : 'Max'})
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
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
          </div>

          {/* Test Vibration Pattern Button */}
          <button 
            id="mobile-test-haptic-btn"
            type="button"
            onClick={() => vibrateDevice([150, 80, 200])}
            className={`w-full h-9 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
              isDark ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Test Haptic Vibration Pattern
          </button>
        </div>

        {/* Defibrillator Config */}
        <div className={`p-3.5 rounded-2xl border space-y-3 ${cardClass}`}>
          <div className="space-y-1.5">
            <span className={`text-[8.5px] uppercase tracking-wider font-bold block border-b pb-1 border-inherit ${textMuted}`}>
              Defibrillator Energy Calibration
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button 
                type="button"
                onClick={() => setState(prev => ({ ...prev, defibType: 'BIPHASIC', selectedEnergy: Math.min(200, prev.selectedEnergy) }))}
                className={`py-2 rounded-xl border text-center transition-colors uppercase text-[9.5px] font-bold cursor-pointer ${
                  state.defibType === 'BIPHASIC' 
                    ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                    : subCardClass
                }`}
              >
                Biphasic (120-200J)
              </button>
              <button 
                type="button"
                onClick={() => setState(prev => ({ ...prev, defibType: 'MONOPHASIC', selectedEnergy: 360 }))}
                className={`py-2 rounded-xl border text-center transition-colors uppercase text-[9.5px] font-bold cursor-pointer ${
                  state.defibType === 'MONOPHASIC' 
                    ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                    : subCardClass
                }`}
              >
                Monophasic (360J)
              </button>
            </div>
          </div>

          {state.defibType === 'BIPHASIC' && (
            <div className="space-y-1.5">
              <span className={`text-[8.5px] uppercase tracking-wider font-bold block ${textMuted}`}>
                Biphasic Joules Tier
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[120, 150, 200].map((joules) => (
                  <button 
                    key={joules}
                    type="button"
                    onClick={() => setState(prev => ({ ...prev, selectedEnergy: joules }))}
                    className={`py-1.5 rounded-xl border text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                      state.selectedEnergy === joules 
                        ? 'bg-red-600 border-red-600 text-white shadow-sm' 
                        : subCardClass
                    }`}
                  >
                    {joules}J
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cloud Database Synchronization Panel */}
        <div className={`p-3.5 rounded-2xl border space-y-3 ${cardClass}`}>
          <div className="flex items-center justify-between border-b pb-2 border-inherit">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
              <h5 className="text-[10.5px] font-bold uppercase tracking-wider">Cloud Database Sync</h5>
            </div>
            <span className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              syncStatus === 'synced'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : syncStatus === 'syncing'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              {syncStatus === 'synced' ? 'SYNCED ✓' : syncStatus === 'syncing' ? 'SYNCING...' : 'OFFLINE'}
            </span>
          </div>
          <p className={`text-[9px] leading-relaxed font-sans ${textMuted}`}>
            Live synchronization with Google Cloud Firestore database. Cases and doctor KYC credentials persist seamlessly.
          </p>
          <div className={`p-2.5 rounded-xl border text-[9.5px] font-mono space-y-1 ${subCardClass}`}>
            <div className="flex justify-between">
              <span className="opacity-70">Engine:</span>
              <span className="font-bold">Firestore Real-time</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Last Sync:</span>
              <span>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Live'}</span>
            </div>
          </div>
          {onForceSync && (
            <button 
              type="button"
              onClick={onForceSync}
              disabled={syncStatus === 'syncing'}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{syncStatus === 'syncing' ? 'Syncing Cloud Database...' : 'Force Cloud Database Sync'}</span>
            </button>
          )}
        </div>

        {/* Android PWA direct installer */}
        <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardClass}`}>
          <div className="flex items-center gap-2 text-emerald-600">
            <Smartphone className="w-5 h-5" />
            <h5 className="text-[10px] font-bold uppercase tracking-wider">Android PWA Direct Installation</h5>
          </div>
          <p className={`text-[9px] leading-relaxed font-sans ${textMuted}`}>
            Run offline, sandboxed, and fast inside emergency rooms. Click below to install or pin to home screen.
          </p>
          <button 
            type="button"
            onClick={triggerPwaInstall}
            className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[9.5px] tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md"
          >
            <Download className="w-4 h-4" /> Install Android App
          </button>
        </div>

        {/* Clear session */}
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
          className="w-full h-10 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 border border-red-500/30 rounded-xl text-[9.5px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          Wipe Patient Session
        </button>
      </div>
    );
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden relative w-full ${isDark ? 'bg-[#0b0f19]' : 'bg-[#f8fafc]'}`} id="mobile-viewport">
      {/* Centralized Phone Viewport Container */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col overflow-hidden relative shadow-2xl">
        {/* Main Viewport Content (scrollable + bottom offset for centered bottom nav) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-20 custom-scrollbar scroll-smooth">
          
          {/* Guest Mode Limited Access Banner */}
          {isGuestMode && (
            <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col gap-2 text-amber-800 dark:text-amber-200 text-xs shadow-md text-left select-none">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-[10.5px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Guest Mode Active (CPR Timers & Drug Tracker)
                  </p>
                  <p className="text-[9px] leading-relaxed font-sans opacity-90">
                    You are in restricted Guest Mode. Access is limited to Timers and Drugs. Please <strong className="underline cursor-pointer font-bold" onClick={onOpenAuth}>Sign In & Verify</strong> for full Flowcharts, Journal Logs & Settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9.5px] font-bold uppercase tracking-wider shrink-0 cursor-pointer border-none shadow-md text-center"
              >
                Sign In For Full Access
              </button>
            </div>
          )}
          
          {/* Urgent Epinephrine Reminder Banner */}
          {state.activePrompt === 'EPI_DUE' && (
            <motion.div 
              key={`epi-notification-interval-${Math.floor((state.epiDueElapsed || 0) / 7)}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3.5 rounded-2xl bg-blue-600 text-white flex items-center justify-between gap-2 shadow-lg animate-pulse select-none text-left"
            >
              <div className="space-y-0.5">
                <span className="text-[8.5px] font-black uppercase tracking-widest block opacity-90">Epinephrine Due</span>
                <p className="text-[10px] font-black uppercase">ADMINISTER 1MG EPINEPHRINE NOW</p>
              </div>
              <button 
                type="button"
                onClick={handleEpi}
                className="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-blue-700 text-[9px] font-black uppercase tracking-wider rounded-xl border-none active:scale-95 transition-transform cursor-pointer shadow"
              >
                Push 1mg
              </button>
            </motion.div>
          )}

          {/* Active Tabs Layout Render */}
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
          <div className={`mt-6 mb-2 p-3.5 rounded-2xl border text-center space-y-1.5 ${
            isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-[9.5px] font-medium leading-relaxed ${
              isDark ? 'text-amber-300' : 'text-amber-900'
            }`}>
              This app has not been validated clinically as a tool. It is intended for academic and training purposes. Please use cautiously.
            </p>
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <p className={`text-[9.5px] font-bold uppercase tracking-wider ${textMuted}`}>
                Copyright © Dr. Sunil Timilsina, MBBS
              </p>
              <button
                type="button"
                onClick={onOpenAdminPasswordModal || onOpenAdmin}
                className="text-gray-400 hover:text-gray-600 text-[10px] p-0.5 bg-transparent border-none cursor-pointer"
                title="Admin Portal"
              >
                🛡️
              </button>
            </div>
          </div>
        </div>

        {/* Centralized Persistent Bottom Navigation Bar */}
        <nav className={`absolute bottom-0 left-0 right-0 h-16 backdrop-blur-md border-t flex items-center justify-around z-40 px-2 shadow-2xl ${
          isDark ? 'bg-[#0c111d]/95 border-white/10' : 'bg-white/95 border-gray-200'
        }`}>
          <NavButton active={activeTab === 'timer'} onClick={() => setActiveTab('timer')} icon={Activity} label="TIMERS" isDark={isDark} />
          <NavButton active={activeTab === 'interventions'} onClick={() => setActiveTab('interventions')} icon={Syringe} label="DRUGS" isDark={isDark} />
          <NavButton active={activeTab === 'algorithm'} onClick={() => setActiveTab('algorithm')} icon={ClipboardList} label="FLOWCHART" isLocked={!hasFullAccess} isDark={isDark} />
          <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={History} label="JOURNAL" isLocked={!hasFullAccess} isDark={isDark} />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="CONFIG" isLocked={!hasFullAccess} isDark={isDark} />
        </nav>
      </div>
    </div>
  );
}

// Low level local utility navigation component
function NavButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  isLocked,
  isDark
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: any; 
  label: string; 
  isLocked?: boolean;
  isDark: boolean;
}) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl border-none transition-all cursor-pointer relative ${
        active 
          ? isDark 
            ? 'text-red-400 bg-red-500/10 shadow-inner' 
            : 'text-red-600 bg-red-50 shadow-inner font-extrabold'
          : isDark 
            ? 'text-slate-400 hover:text-slate-200 bg-transparent' 
            : 'text-gray-500 hover:text-gray-900 bg-transparent'
      }`}
    >
      <div className="relative">
        <Icon className={`w-4 h-4 ${active ? (isDark ? 'text-red-400' : 'text-red-600') : ''}`} />
        {isLocked && (
          <span className="absolute -top-1 -right-1.5 bg-red-600 text-white rounded-full p-0.5 text-[6px]">
            <Lock className="w-2.5 h-2.5 stroke-[3]" />
          </span>
        )}
      </div>
      <span className="text-[8px] font-black mt-1 uppercase tracking-tight leading-none">{label}</span>
    </button>
  );
}
