import React, { useState, useEffect, useRef } from 'react';
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
  ChevronRight,
  PlusSquare,
  Heart,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EventType, 
  LogEvent, 
  PatientRhythm, 
  AclsState,
  UserProfile 
} from './types';
import { 
  CPR_CYCLE_DURATION, 
  EPI_INTERVAL, 
  HS_AND_TS 
} from './constants';
import { MedicalAudio } from './lib/audio';
import { auth, signInWithGoogle, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import OnboardingForm from './components/OnboardingForm';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState<AclsState>(() => {
    const savedDefibType = localStorage.getItem('acls_defib_type');
    const savedEnergy = localStorage.getItem('acls_selected_energy');
    
    return {
      isTimerRunning: false,
      cprTimeLeft: CPR_CYCLE_DURATION,
      epiTimeLeft: EPI_INTERVAL,
      totalTime: 0,
      shocksCount: 0,
      epiCount: 0,
      currentRhythm: 'UNKNOWN',
      cprCycleCount: 0,
      logs: [],
      showHsAndTs: false,
      activePrompt: 'RHYTHM_CHECK',
      rhythmCheckTimeLeft: 0,
      defibType: (savedDefibType as 'BIPHASIC' | 'MONOPHASIC') || 'BIPHASIC',
      selectedEnergy: savedEnergy ? parseInt(savedEnergy, 10) : 200,
    };
  });

  // Auth & Profile Logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [activeTab, setActiveTab] = useState<'timer' | 'algorithm' | 'logs' | 'settings'>('timer');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('acls_defib_type', state.defibType);
    localStorage.setItem('acls_selected_energy', state.selectedEnergy.toString());
  }, [state.defibType, state.selectedEnergy]);


  // Metronome Effect (110 BPM)
  useEffect(() => {
    let metronomeInterval: NodeJS.Timeout | null = null;
    
    // Only play metronome during active CPR (timer running, no active pause/prompt)
    if (state.isTimerRunning && state.rhythmCheckTimeLeft === 0 && !state.activePrompt) {
      metronomeInterval = setInterval(() => {
        MedicalAudio.playMetronomeBeat();
      }, 545); // 60000 / 110 = 545.45ms
    }

    return () => {
      if (metronomeInterval) clearInterval(metronomeInterval);
    };
  }, [state.isTimerRunning, state.rhythmCheckTimeLeft, state.activePrompt]);

  useEffect(() => {
    if (state.isTimerRunning) {
      timerRef.current = setInterval(() => {
        setState(prev => {
          let nextCpr = prev.cprTimeLeft;
          let nextEpi = prev.epiTimeLeft > 0 ? prev.epiTimeLeft - 1 : 0;
          let nextRhythmCheck = prev.rhythmCheckTimeLeft;
          let nextActivePrompt = prev.activePrompt;
          let nextIsRunning = true;

          // 1. Handle Rhythm Check Countdown
          if (nextRhythmCheck > 0) {
            nextRhythmCheck -= 1;
            if (nextRhythmCheck === 0) {
              nextActivePrompt = 'RHYTHM_CHECK';
              nextIsRunning = false;
              MedicalAudio.playUrgent();
            }
          } else if (nextCpr > 0) {
            // 2. Handle Normal CPR Cycle
            nextCpr -= 1;
            if (nextCpr === 0) {
              nextRhythmCheck = 5;
              addLog('RHYTHM_CHECK', '2-minute cycle complete. 5s Rhythm Check evaluation started.');
              MedicalAudio.playCycleEnd();
            }
          }

          // 3. Handle Epinephrine Due
          if (prev.epiTimeLeft > 0 && nextEpi === 0) {
            nextActivePrompt = 'EPI_DUE';
            // We don't necessarily stop CPR, but we show the overlay
            MedicalAudio.playAlert();
          }
          
          return {
            ...prev,
            cprTimeLeft: nextCpr,
            epiTimeLeft: nextEpi,
            rhythmCheckTimeLeft: nextRhythmCheck,
            totalTime: prev.totalTime + 1,
            activePrompt: nextActivePrompt,
            isTimerRunning: nextIsRunning
          };
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isTimerRunning]);

  const addLog = (type: EventType, description: string) => {
    const newLog: LogEvent = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type,
      description,
    };
    setState(prev => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 50),
    }));
  };

  const toggleTimer = () => {
    if (!state.isTimerRunning && state.totalTime === 0) {
      addLog('CPR_START', 'Resuscitation started - CPR Cycle #1');
      MedicalAudio.playAlert();
    }
    setState(prev => ({ 
      ...prev, 
      isTimerRunning: !prev.isTimerRunning,
      cprCycleCount: (!prev.isTimerRunning && prev.totalTime === 0) ? 1 : prev.cprCycleCount,
      activePrompt: prev.activePrompt === 'RHYTHM_CHECK' ? null : prev.activePrompt
    }));
  };

  const resetCprTimer = () => {
    setState(prev => ({ 
      ...prev, 
      cprTimeLeft: CPR_CYCLE_DURATION,
      cprCycleCount: prev.cprCycleCount + 1,
      activePrompt: null,
      isTimerRunning: true
    }));
    addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} started`);
  };

  const handleShock = () => {
    MedicalAudio.playUrgent();
    setState(prev => ({ 
      ...prev, 
      shocksCount: prev.shocksCount + 1,
      cprTimeLeft: CPR_CYCLE_DURATION,
      cprCycleCount: prev.cprCycleCount + 1,
      currentRhythm: 'SHOCKABLE',
      activePrompt: null,
      isTimerRunning: true
    }));
    addLog('SHOCK', `Shock #${state.shocksCount + 1} delivered - CPR Cycle #${state.cprCycleCount + 1} started`);
  };

  const handleEpi = () => {
    MedicalAudio.playMetronomeTick();
    setState(prev => ({ 
      ...prev, 
      epiCount: prev.epiCount + 1,
      epiTimeLeft: EPI_INTERVAL,
      activePrompt: prev.activePrompt === 'EPI_DUE' ? null : prev.activePrompt
    }));
    addLog('DRUG_EPI', `Epinephrine 1mg administered (#${state.epiCount + 1})`);
  };

  const handleRhythmSelect = (rhythm: PatientRhythm) => {
    setState(prev => {
      let nextPrompt: 'SHOCK_ADVISED' | 'RHYTHM_CHECK' | 'EPI_ADVISED' | 'EPI_DUE' | null = null;
      if (rhythm === 'SHOCKABLE') {
        nextPrompt = 'SHOCK_ADVISED';
        MedicalAudio.playUrgent();
      } else if (rhythm === 'NON_SHOCKABLE') {
        nextPrompt = 'EPI_ADVISED';
        MedicalAudio.playAlert();
      }
      
      return { 
        ...prev, 
        currentRhythm: rhythm,
        activePrompt: nextPrompt,
        // Keep paused for instructions if prompt is active
        isTimerRunning: nextPrompt ? false : true,
        cprTimeLeft: rhythm === 'NON_SHOCKABLE' ? CPR_CYCLE_DURATION : prev.cprTimeLeft
      };
    });
    addLog('RHYTHM_CHECK', `Rhythm identified: ${rhythm}`);
  };

  const handleRosc = () => {
    setState(prev => ({ 
      ...prev, 
      isTimerRunning: false,
      activePrompt: null
    }));
    addLog('ROSC', 'ROSC ACHIEVED - Initiating Post-Cardiac Arrest Care');
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const cprProgress = (state.cprTimeLeft / CPR_CYCLE_DURATION) * 100;
  const epiProgress = (state.epiTimeLeft / EPI_INTERVAL) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-medical-dark flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-medical-blue/30 border-t-medical-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-medical-dark flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel p-10 space-y-8"
        >
          <div className="w-20 h-20 bg-medical-blue/20 rounded-3xl flex items-center justify-center text-medical-blue mx-auto shadow-2xl shadow-medical-blue/20">
            <Heart className="w-10 h-10 fill-current" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tighter">ACLS 2025</h1>
            <p className="text-slate-500 uppercase tracking-widest text-[10px] font-bold">Clinical Companion • Kathmandu</p>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Professional protocol enforcement and lifecycle monitoring system. Authenticate to access clinical algorithms.
          </p>
          <button 
            onClick={signInWithGoogle}
            className="w-full h-14 bg-white text-medical-dark hover:bg-slate-100 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl uppercase tracking-widest text-xs"
          >
            <LogIn className="w-5 h-5" />
            Continue with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return <OnboardingForm onComplete={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-medical-dark text-slate-100 font-sans flex overflow-hidden" id="acls-root">
      
      {/* Sidebar Monitor (Persistent) */}
      <aside className="w-80 glass-panel m-4 mr-0 rounded-3xl flex flex-col overflow-hidden border-r-0 shrink-0 select-none">
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-medical-red px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase shadow-lg shadow-medical-red/20">LIVE CODE</div>
            <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
              <span className={`w-2 h-2 rounded-full ${state.isTimerRunning ? 'bg-medical-red animate-pulse' : 'bg-slate-700'}`} />
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
          <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-800" />
              <motion.circle 
                cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" 
                className={state.cprTimeLeft < 30 ? 'text-medical-red' : 'text-medical-blue'}
                strokeDasharray="283"
                animate={{ strokeDashoffset: 283 - (283 * cprProgress) / 100 }}
                transition={{ ease: "linear" }}
              />
            </svg>
            <div className="text-center z-10">
              <div className={`text-4xl font-mono font-bold tabular-nums tracking-tighter ${state.rhythmCheckTimeLeft > 0 ? 'text-emerald-400' : state.cprTimeLeft < 30 ? 'text-medical-red' : 'text-slate-100'}`}>
                {state.rhythmCheckTimeLeft > 0 ? formatTime(state.rhythmCheckTimeLeft) : formatTime(state.cprTimeLeft)}
              </div>
              <p className={`text-[9px] uppercase tracking-widest mt-1 font-bold ${state.rhythmCheckTimeLeft > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                {state.rhythmCheckTimeLeft > 0 ? 'Check Rhythm' : 'Next Check'}
              </p>
            </div>
          </div>

          {/* Med Waitlist */}
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase text-slate-500 font-bold tracking-widest border-b border-white/5 pb-2">Drug Monitoring</h3>
            <div className="glass-panel bg-slate-900/50 p-4 border-medical-blue/20">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-medical-blue uppercase">Epinephrine</span>
                <span className="text-[10px] font-mono text-slate-400">#{state.epiCount} Given</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-medical-blue" animate={{ width: `${epiProgress}%` }} />
                </div>
                <span className="font-mono text-sm text-medical-blue">{formatTime(state.epiTimeLeft)}</span>
              </div>
            </div>
          </div>

          {/* Event Log (Condensed) */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] uppercase text-slate-500 font-bold tracking-widest leading-none">Journal</h3>
              <History className="w-3 h-3 text-slate-600" />
            </div>
            <div className="space-y-2 h-40 overflow-y-auto pr-2 custom-scrollbar">
              {state.logs.map((log) => (
                <div key={log.id} className="flex gap-3 items-start border-l border-slate-800 pl-3">
                  <span className="text-[9px] font-mono text-slate-600 shrink-0">
                    {formatTime(Math.floor((log.timestamp - (state.logs[state.logs.length-1]?.timestamp || Date.now())) / 1000))}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight leading-tight">{log.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-6 py-4 grid grid-cols-2 gap-4 border-t border-white/5 bg-slate-900/30">
            <div className="text-center">
              <div className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">CPR Cycles</div>
              <div className="text-xl font-mono font-bold text-white leading-none">{state.cprCycleCount}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] text-slate-500 uppercase font-bold tracking-widest mb-1">Epi Doses</div>
              <div className="text-xl font-mono font-bold text-medical-blue leading-none">{state.epiCount}</div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 border-t border-white/5 flex gap-2">
          <button onClick={toggleTimer} className="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-all active:scale-95">
            {state.isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>
          <button onClick={resetCprTimer} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-white flex items-center justify-center transition-all active:scale-95">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => setActiveTab('settings')} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-white flex items-center justify-center transition-all active:scale-95">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => auth.signOut()} className="w-10 h-10 rounded-xl bg-slate-800/50 hover:bg-red-500/10 text-slate-600 hover:text-red-500 flex items-center justify-center transition-all active:scale-95 shadow-inner">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Algorithm Stage */}
      <main className="flex-1 flex flex-col p-6 overflow-hidden relative">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-medical-blue/10 rounded-2xl flex items-center justify-center text-medical-blue border border-medical-blue/20">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold tracking-tighter text-white">{profile.fullName}</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">
                {profile.profession} • {profile.highestDegree} • REG: {profile.councilRegistration}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('algorithm')}
            className="px-4 py-2 glass-panel border-emerald-500/30 text-emerald-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 hover:text-white transition-all"
          >
            <ClipboardList className="w-4 h-4" /> Full Flowchart
          </button>
        </header>

        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {/* Phase: Current Step */}
          <section className="glass-panel p-8 bg-slate-800/20 border-medical-blue/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4">
              <Activity className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-medical-blue shadow-[0_0_8px_#3b82f6]" />
                <span className="text-[10px] font-bold text-medical-blue uppercase tracking-widest">Active Phase: Intervention</span>
              </div>
              
              <h3 className="text-4xl font-display font-bold tracking-tighter text-slate-100 mb-2">
                {state.currentRhythm === 'UNKNOWN' ? 'Confirm Patient Status' : 
                 state.currentRhythm === 'SHOCKABLE' ? 'VF / PULSELESS VT' : 'ASYSTOLE / PEA'}
              </h3>
              
              <p className="text-slate-400 font-medium leading-relaxed max-w-xl">
                {state.currentRhythm === 'SHOCKABLE' 
                  ? "Shockable rhythm identified. Immediate high-energy shock required followed by resume CPR. Prepare first dose Epinephrine if 2nd shock failure." 
                  : state.currentRhythm === 'NON_SHOCKABLE'
                  ? "Non-shockable rhythm. Focus on high-quality compressions and immediate Epinephrine. Search for H's and T's aggressively."
                  : "Clinical assessment required. Check pulse and rhythm simultaneously. If pulseless, start CPR immediately."}
              </p>

              {/* Reversible Causes Prompt */}
              {((state.currentRhythm === 'NON_SHOCKABLE' && state.cprCycleCount >= 2) || 
                (state.currentRhythm === 'SHOCKABLE' && state.cprCycleCount >= 3)) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 rounded-2xl bg-medical-red/10 border border-medical-red/20 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-medical-red/20 flex items-center justify-center text-medical-red shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-medical-red uppercase tracking-widest">Identify Reversible Causes</h4>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">Cycle #{state.cprCycleCount} - H's and T's prioritization required</p>
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* Action Grid (The Core Buttons) */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={handleShock}
              className="h-28 glass-panel border-medical-red/40 bg-medical-red/10 text-medical-red font-bold flex flex-col items-center justify-center gap-2 hover:bg-medical-red hover:text-white transition-all active:scale-95 shadow-xl shadow-medical-red/10"
            >
              <Zap className="w-6 h-6 fill-current" />
              <span className="text-xs uppercase tracking-widest">Shock ({state.shocksCount})</span>
            </button>
            <button 
              onClick={handleEpi}
              className={`h-28 glass-panel border-medical-blue/40 bg-medical-blue/10 text-medical-blue font-bold flex flex-col items-center justify-center gap-2 hover:bg-medical-blue hover:text-white transition-all active:scale-95 shadow-xl shadow-medical-blue/10 ${state.epiTimeLeft === 0 ? 'animate-med-pulse' : ''}`}
            >
              <Syringe className="w-6 h-6 shrink-0" />
              <span className="text-xs uppercase tracking-widest">Epi ({state.epiCount})</span>
            </button>
            <button 
              onClick={() => handleRhythmSelect('SHOCKABLE')}
              className="h-28 glass-panel border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center gap-2 hover:border-medical-red/50 hover:text-white transition-all text-slate-400"
            >
              <Activity className="w-6 h-6" />
              <span className="text-xs uppercase tracking-widest font-bold">VF/pVT</span>
            </button>
            <button 
              onClick={() => handleRhythmSelect('NON_SHOCKABLE')}
              className="h-28 glass-panel border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center gap-2 hover:border-medical-blue/50 hover:text-white transition-all text-slate-400"
            >
              <Activity className="w-6 h-6" />
              <span className="text-xs uppercase tracking-widest font-bold">PEA/Asystole</span>
            </button>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reversible Causes Checklist */}
            <section className="glass-panel p-6">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">H's & T's Quick Scan</h4>
              <div className="grid grid-cols-2 gap-2">
                {HS_AND_TS.map((item, idx) => (
                  <label key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/30 border border-white/5 cursor-pointer hover:border-white/10 transition-colors group">
                    <input type="checkbox" className="w-3 h-3 rounded border-slate-700 bg-slate-900 checked:bg-emerald-500 transition-all pointer-events-none" />
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 uppercase tracking-tight">{item.term}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Interventions Section */}
            <section className="glass-panel p-6 flex flex-col gap-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Interventions</h4>
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={handleRosc}
                  className="w-full h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-500 font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                >
                  Confirm ROSC
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button className="h-10 rounded-xl bg-slate-800 text-[9px] font-bold uppercase tracking-widest text-slate-400 border border-white/5 hover:text-white">Adv. Airway</button>
                  <button className="h-10 rounded-xl bg-slate-800 text-[9px] font-bold uppercase tracking-widest text-slate-400 border border-white/5 hover:text-white">IV/IO Acc.</button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer info */}
        <footer className="mt-6 flex justify-between text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold select-none shrink-0">
          <div>System: Clinical Intern Monitoring System</div>
          <div>Location: Critical Care Unit - Kathmandu</div>
          <div>Sync Status: Operational</div>
        </footer>
      </main>

      {/* Prompt Overlay */}
      <AnimatePresence>
        {state.activePrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-medical-dark/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel w-full max-w-sm p-8 text-center border-medical-blue/30 shadow-[0_0_50px_rgba(59,130,246,0.2)]"
            >
              {state.activePrompt === 'RHYTHM_CHECK' && (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-medical-blue/10 rounded-full flex items-center justify-center mx-auto text-medical-blue animate-pulse">
                    <Activity className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold tracking-tight mb-2 uppercase">Rhythm Check</h2>
                    <p className="text-slate-400 text-sm uppercase tracking-widest font-bold">Is the rhythm shockable?</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => handleRhythmSelect('SHOCKABLE')}
                      className="h-16 rounded-2xl bg-medical-red text-white btn-action flex items-center justify-center gap-2 group shadow-lg shadow-medical-red/20"
                    >
                      <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      YES (VF / pVT)
                    </button>
                    <button 
                      onClick={() => handleRhythmSelect('NON_SHOCKABLE')}
                      className="h-16 rounded-2xl bg-slate-800 text-slate-100 btn-action border border-white/5"
                    >
                      NO (ASYSTOLE / PEA)
                    </button>
                  </div>
                </div>
              )}

              {state.activePrompt === 'SHOCK_ADVISED' && (
                <div className="space-y-6">
                  <div className="w-24 h-24 bg-medical-red/10 rounded-full flex items-center justify-center mx-auto text-medical-red animate-med-pulse status-glow border border-medical-red/30">
                    <Zap className="w-12 h-12 fill-current" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-display font-bold tracking-tight text-medical-red mb-2 uppercase">Shock Advised</h2>
                    <p className="text-slate-100 text-sm font-bold uppercase tracking-[0.2em]">Clear the patient!</p>
                  </div>
                  <button 
                    onClick={handleShock}
                    className="w-full h-20 rounded-2xl bg-medical-red text-white btn-action text-xl shadow-2xl shadow-medical-red/40 animate-med-pulse border-none"
                  >
                    DELIVER SHOCK ({state.selectedEnergy}J)
                  </button>
                  
                  {state.cprCycleCount >= 2 && (
                    <div className="p-4 rounded-xl bg-medical-red/10 border border-medical-red/30 animate-pulse">
                      <div className="flex items-center gap-2 text-medical-red mb-1">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Reversible Causes</span>
                      </div>
                      <p className="text-[9px] text-slate-300 uppercase font-bold text-left leading-tight">
                        Consider H's and T's aggressively. This patient remains in a shockable rhythm.
                      </p>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed font-bold">
                    Immediately resume CPR after shock delivery
                  </p>
                </div>
              )}

              {state.activePrompt === 'EPI_ADVISED' && (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-medical-blue/10 rounded-full flex items-center justify-center mx-auto text-medical-blue animate-pulse status-glow border border-medical-blue/30">
                    <Syringe className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold tracking-tight text-medical-blue mb-1 uppercase">Non-Shockable Action</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Asystole / PEA Protocol</p>
                  </div>

                  {/* Reminders Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
                        <PlusSquare className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-left leading-tight">IV/IO Access</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20 shrink-0">
                        <Activity className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-left leading-tight">Adv. Airway</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        handleEpi();
                      }}
                      className={`w-full h-16 rounded-2xl flex items-center justify-center gap-3 transition-all font-bold uppercase tracking-widest text-sm ${
                        state.epiCount > 0 
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
                          : 'bg-medical-blue text-white shadow-lg shadow-medical-blue/20 animate-med-pulse'
                      }`}
                    >
                      <Syringe className="w-5 h-5" />
                      {state.epiCount > 0 ? `Epinephrine Given (${formatTime(state.epiTimeLeft)})` : 'Administer Epinephrine NOW'}
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (state.epiCount === 0) {
                          addLog('INFO', 'CPR started before 1st Epi dose (Non-shockable rhythm)');
                        }
                        addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} Initialized`);
                        setState(prev => ({ 
                          ...prev, 
                          activePrompt: null, 
                          isTimerRunning: true,
                          cprCycleCount: prev.cprCycleCount + 1
                        }));
                      }}
                      className="w-full h-16 rounded-2xl bg-white text-medical-dark hover:bg-slate-100 flex items-center justify-center gap-3 transition-all font-bold uppercase tracking-widest text-sm shadow-xl"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Start CPR Cycle #{state.cprCycleCount + 1}
                    </button>
                    
                    {state.currentRhythm === 'NON_SHOCKABLE' && state.cprCycleCount >= 1 && (
                      <div className="p-4 rounded-xl bg-medical-red/10 border border-medical-red/30 animate-pulse">
                        <div className="flex items-center gap-2 text-medical-red mb-1">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Reversible Causes</span>
                        </div>
                        <p className="text-[9px] text-slate-300 uppercase font-bold text-left leading-tight">
                          Consider H's and T's aggressively during this cycle.
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed font-bold">
                    Epinephrine should be given ASAP. Do not delay CPR if drug is not ready.
                  </p>
                </div>
              )}
              {state.activePrompt === 'EPI_DUE' && (
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-medical-blue/10 rounded-full flex items-center justify-center mx-auto text-medical-blue animate-pulse status-glow border border-medical-blue/30">
                    <Syringe className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold tracking-tight text-medical-blue mb-1 uppercase">Epinephrine Due</h2>
                    <p className="text-slate-100 text-sm font-bold uppercase tracking-[0.2em]">Push 1mg ASAP!</p>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleEpi}
                      className="w-full h-16 rounded-2xl bg-medical-blue text-white btn-action text-lg shadow-xl shadow-medical-blue/30 border-none uppercase font-bold flex items-center justify-center gap-3"
                    >
                      <Syringe className="w-6 h-6" />
                      Administer 1mg
                    </button>
                    
                    <button 
                      onClick={() => {
                        setState(prev => ({ ...prev, activePrompt: null }));
                      }}
                      className="w-full h-16 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-3 transition-all font-bold uppercase tracking-widest text-sm"
                    >
                      Continue CPR
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed font-bold">
                    Do not interrupt CPR for drug administration
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Overlay (Minimized) */}
      <nav className="fixed right-6 bottom-20 flex flex-col gap-4 z-40">
        <button 
          onClick={() => setActiveTab(activeTab === 'algorithm' ? 'timer' : 'algorithm')}
          className={`w-12 h-12 rounded-full flex items-center justify-center glass-panel shadow-2xl transition-all ${activeTab === 'algorithm' ? 'bg-medical-blue text-white' : 'text-slate-400'}`}
        >
          <ClipboardList className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setActiveTab(activeTab === 'settings' ? 'timer' : 'settings')}
          className={`w-12 h-12 rounded-full flex items-center justify-center glass-panel shadow-2xl transition-all ${activeTab === 'settings' ? 'bg-medical-blue text-white' : 'text-slate-400'}`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </nav>

      <AnimatePresence>
        {activeTab === 'algorithm' && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[100] bg-medical-dark flex flex-col p-4 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h2 className="font-display font-bold text-xl tracking-tighter">Decision Algorithm</h2>
              </div>
              <button 
                onClick={() => setActiveTab('timer')}
                className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white transition-colors uppercase text-[10px] font-bold tracking-widest"
              >
                Exit Portal
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar pb-20">
              {/* Node 1: Entry */}
              <div className="flex flex-col items-center">
                <div className="glass-panel p-4 w-full border-medical-blue/30 bg-medical-blue/5 text-center">
                  <span className="text-[10px] font-bold text-medical-blue uppercase tracking-widest block mb-1">Step 1</span>
                  <h4 className="font-bold text-sm uppercase">Start CPR</h4>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase">Give Oxygen • Attach Monitor/Defib</p>
                </div>
                <div className="h-6 w-0.5 bg-slate-700"></div>
                <div className="glass-panel px-6 py-3 border-indigo-500/30 text-center">
                  <h4 className="font-bold text-xs uppercase text-indigo-400">Rhythm Shockable?</h4>
                </div>
                <div className="flex w-full justify-center">
                  <div className="w-1/2 flex flex-col items-center">
                    <div className="h-6 w-0.5 bg-slate-700"></div>
                    <div className="w-full h-px bg-slate-700 mr-[-50%]"></div>
                    <div className="h-6 w-0.5 bg-slate-700"></div>
                    <span className="text-[9px] font-bold text-medical-red absolute mt-[-20px] ml-[-40px]">YES</span>
                    
                    {/* Shockable Path */}
                    <div className="space-y-4 w-full px-2">
                      <div className="glass-panel p-3 border-medical-red/40 bg-medical-red/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] font-bold text-medical-red uppercase tracking-widest">VF/pVT</span>
                          <Zap className="w-3 h-3 text-medical-red" />
                        </div>
                        <h5 className="font-bold text-[10px] uppercase">Shock (120-200J)</h5>
                      </div>
                      <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-800"></div></div>
                      <div className="glass-panel p-3 bg-slate-900/50">
                        <h5 className="font-bold text-[10px] uppercase">CPR 2 Min</h5>
                        <p className="text-[9px] text-slate-500 mt-1 uppercase">Obtain IV/IO Access</p>
                      </div>
                      <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-800"></div></div>
                      <div className="glass-panel p-3 border-indigo-500/30 bg-indigo-500/5">
                        <h5 className="font-bold text-[10px] uppercase">Rhythm Shockable?</h5>
                      </div>
                      <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-800"></div></div>
                      <div className="glass-panel p-3 border-medical-red/40 bg-medical-red/5">
                        <h5 className="font-bold text-[10px] uppercase text-medical-red">Shock + CPR 2m</h5>
                        <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold text-medical-blue">Epinephrine Q3-5M</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-1/2 flex flex-col items-center">
                    <div className="h-6 w-0.5 bg-slate-700"></div>
                    <div className="w-full h-px bg-slate-700 ml-[-50%]"></div>
                    <div className="h-6 w-0.5 bg-slate-700"></div>
                    <span className="text-[9px] font-bold text-medical-blue absolute mt-[-20px] mr-[-40px]">NO</span>

                    {/* Non-Shockable Path */}
                    <div className="space-y-4 w-full px-2">
                      <div className="glass-panel p-3 border-medical-blue/40 bg-medical-blue/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] font-bold text-medical-blue uppercase tracking-widest">Asystole/PEA</span>
                          <Syringe className="w-3 h-3 text-medical-blue" />
                        </div>
                        <h5 className="font-bold text-[10px] uppercase text-medical-blue">Epinephrine ASAP</h5>
                      </div>
                      <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-800"></div></div>
                      <div className="glass-panel p-3 bg-slate-900/50">
                        <h5 className="font-bold text-[10px] uppercase">CPR 2 Min</h5>
                        <ul className="text-[8px] text-slate-500 mt-1 uppercase space-y-1 list-disc list-inside">
                          <li>IV/IO Access</li>
                          <li>Advanced Airway?</li>
                          <li>Capnography</li>
                        </ul>
                      </div>
                      <div className="flex justify-center"><div className="h-4 w-0.5 bg-slate-800"></div></div>
                      <div className="glass-panel p-3 border-emerald-500/30 bg-emerald-500/5">
                        <h4 className="font-bold text-[10px] uppercase text-emerald-400">Treat Reversible Causes</h4>
                        <p className="text-[8px] text-slate-500 mt-1 italic">Scan H's & T's</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference Sections */}
              <div className="space-y-4 pt-8 border-t border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Quick Reference Guides</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="medical-card p-4 border-l-4 border-l-medical-red bg-slate-900/40 rounded-xl">
                    <h4 className="font-bold text-xs text-medical-red mb-2 uppercase italic tracking-tighter">Shock Energy (Active: {state.defibType === 'BIPHASIC' ? 'Biphasic' : 'Monophasic'} {state.selectedEnergy}J)</h4>
                    <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-bold text-slate-400">
                      <div className={state.defibType === 'BIPHASIC' ? 'text-white' : ''}>
                        <div className="text-slate-500 mb-1">Biphasic</div>
                        <p className="text-slate-200">120 - 200 J</p>
                      </div>
                      <div className={state.defibType === 'MONOPHASIC' ? 'text-white' : ''}>
                        <div className="text-slate-500 mb-1">Monophasic</div>
                        <p className="text-slate-200">360 J</p>
                      </div>
                    </div>
                  </div>

                  <div className="medical-card p-4 border-l-4 border-l-medical-blue bg-slate-900/40 rounded-xl">
                    <h4 className="font-bold text-xs text-medical-blue mb-2 uppercase italic tracking-tighter">Drug Dosages</h4>
                    <div className="space-y-3 text-[10px]">
                      <div className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-500 font-bold uppercase">Epinephrine</span>
                        <span className="text-slate-200 font-mono">1mg Q3-5M</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-500 font-bold uppercase">Amiodarone</span>
                        <span className="text-slate-200 font-mono">300mg / 150mg</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-500 font-bold uppercase">Lidocaine</span>
                        <span className="text-slate-200 font-mono">1.5mg/kg / 0.75mg/kg</span>
                      </div>
                    </div>
                  </div>

                  <div className="medical-card p-4 border-l-4 border-l-emerald-500 bg-slate-900/40 rounded-xl">
                    <h4 className="font-bold text-xs text-emerald-500 mb-2 uppercase italic tracking-tighter">Advanced Airway</h4>
                    <ul className="text-[10px] text-slate-400 uppercase font-bold space-y-1">
                      <li>• ET Intubation or Supraglottic</li>
                      <li>• Waveform Capnography</li>
                      <li>• 1 Breath Every 6 Sec (10/Min)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === 'settings' && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 z-[100] bg-medical-dark flex flex-col p-8 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-8 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-medical-blue/10 rounded-lg text-medical-blue border border-medical-blue/20">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="font-display font-bold text-xl tracking-tighter uppercase">Device Config</h2>
              </div>
              <button 
                onClick={() => setActiveTab('timer')} 
                className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white transition-colors uppercase text-[10px] font-bold tracking-widest border border-white/5"
              >
                Close Settings
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar pb-20">
              <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Defibrillator Type</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, defibType: 'BIPHASIC', selectedEnergy: 200 }))}
                    className={`p-6 rounded-2xl border transition-all text-left ${state.defibType === 'BIPHASIC' ? 'bg-medical-blue/10 border-medical-blue text-medical-blue shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
                  >
                    <div className="text-sm font-bold uppercase mb-1">Biphasic</div>
                    <div className="text-[10px] uppercase font-bold tracking-tight opacity-70">AHA Standard</div>
                  </button>
                  <button 
                    onClick={() => setState(prev => ({ ...prev, defibType: 'MONOPHASIC', selectedEnergy: 360 }))}
                    className={`p-6 rounded-2xl border transition-all text-left ${state.defibType === 'MONOPHASIC' ? 'bg-medical-blue/10 border-medical-blue text-medical-blue shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
                  >
                    <div className="text-sm font-bold uppercase mb-1">Monophasic</div>
                    <div className="text-[10px] uppercase font-bold tracking-tight opacity-70">Legacy</div>
                  </button>
                </div>
              </section>

              {state.defibType === 'BIPHASIC' && (
                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Shock Energy (Initial & Subsequent)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[120, 150, 200].map((joules) => (
                      <button 
                        key={joules}
                        onClick={() => setState(prev => ({ ...prev, selectedEnergy: joules }))}
                        className={`py-6 rounded-xl border transition-all font-mono text-sm font-bold ${state.selectedEnergy === joules ? 'bg-medical-red border-medical-red text-white shadow-lg shadow-medical-red/20' : 'bg-slate-900/50 border-slate-800 text-slate-500'}`}
                      >
                        {joules}J
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {state.defibType === 'MONOPHASIC' && (
                <section className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Fixed Energy</h3>
                  <div className="glass-panel p-8 border-medical-red/20 bg-medical-red/5 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-2xl text-medical-red font-mono">360 JOULES</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Default for monophasic devices</p>
                    </div>
                    <Zap className="text-medical-red w-10 h-10 opacity-20" />
                  </div>
                </section>
              )}

              <section className="pt-8 border-t border-slate-800">
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-medical-blue" /> AHA Guidelines Note
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed uppercase font-bold">
                    Use manufacturer recommended energy dose. If unknown, use the maximal dose. Biphasic waveforms are preferred for greater efficacy and lower risk of myocardial injury.
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center p-2 rounded-xl transition-all ${active ? 'text-medical-blue bg-medical-blue/10' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <Icon className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
      <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{label}</span>
    </button>
  );
}
