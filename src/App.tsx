import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  RotateCcw, 
  Zap, 
  Syringe, 
  Activity, 
  Settings, 
  AlertCircle,
  Heart,
  Smartphone,
  Laptop
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
} from './constants';
import { MedicalAudio } from './lib/audio';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import OnboardingForm from './components/OnboardingForm';
import MobileDashboard from './components/MobileDashboard';
import DesktopDashboard from './components/DesktopDashboard';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const [hasSessionStarted, setHasSessionStarted] = useState(false);

  // Android & PWA App Variables
  const [deviceMode, setDeviceMode] = useState<'standalone' | 'phone_demo'>('phone_demo');
  const [phoneTime, setPhoneTime] = useState('08:00');
  const [batteryLevel, setBatteryLevel] = useState(87);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);
  
  // Haptic Vibration Settings
  const [hapticDuration, setHapticDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('acls_haptic_duration');
      return saved ? parseInt(saved, 10) : 150;
    } catch (e) {
      return 150;
    }
  });

  const [hapticIntensity, setHapticIntensity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('acls_haptic_intensity');
      return saved ? parseInt(saved, 10) : 3;
    } catch (e) {
      return 3;
    }
  });

  // Mobile Responsive detection
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'timer' | 'interventions' | 'algorithm' | 'logs' | 'settings'>('timer');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [metronomeCount, setMetronomeCount] = useState(0);

  const [state, setState] = useState<AclsState>(() => {
    let savedDefibType: string | null = null;
    let savedEnergy: string | null = null;
    try {
      savedDefibType = localStorage.getItem('acls_defib_type');
      savedEnergy = localStorage.getItem('acls_selected_energy');
    } catch (e) {
      // Safe fallback if iframe blocks localStorage
    }
    
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
      activePrompt: null,
      rhythmCheckTimeLeft: 0,
      defibType: (savedDefibType as 'BIPHASIC' | 'MONOPHASIC') || 'BIPHASIC',
      selectedEnergy: savedEnergy ? parseInt(savedEnergy, 10) : 200,
      epiDueElapsed: 0,
    };
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Screen size listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clock updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setPhoneTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Battery status API
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.floor(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.floor(battery.level * 100));
        });
      });
    }
  }, []);

  // PWA listener hook
  useEffect(() => {
    const handleBeforePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
  }, []);

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) {
      alert("Nepal ACLS app PWA is already cached or manual installation via Chrome menu is required on this device browser.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const getScaledVibrationPattern = (basePattern: number | number[]): number | number[] => {
    const durationFactor = hapticDuration / 150;
    const intensityFactor = 0.25 + hapticIntensity * 0.25;
    const totalFactor = durationFactor * intensityFactor;

    if (typeof basePattern === 'number') {
      return Math.max(10, Math.round(basePattern * totalFactor));
    } else {
      return basePattern.map((val, idx) => {
        if (idx % 2 === 0) {
          return Math.max(10, Math.round(val * totalFactor));
        } else {
          return Math.max(10, Math.round(val / Math.sqrt(intensityFactor)));
        }
      });
    }
  };

  const vibrateDevice = (pattern: number | number[]) => {
    const scaledPattern = getScaledVibrationPattern(pattern);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(scaledPattern);
      } catch (e) {
        // Safe fail in sandbox iframe
      }
    }
    let totalDur = 400;
    if (typeof scaledPattern === 'number') {
      totalDur = scaledPattern;
    } else if (Array.isArray(scaledPattern)) {
      totalDur = scaledPattern.reduce((acc, curr) => acc + curr, 0);
    }
    setIsVibrating(true);
    setTimeout(() => setIsVibrating(false), Math.min(Math.max(totalDur, 300), 1200));
  };

  // Auth monitoring SNAP
  useEffect(() => {
    // Fallback timer to ensure app loads even if Firebase Auth response is delayed in iframe sandbox
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(fallbackTimer);
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
        profileUnsubscribeRef.current = null;
      }
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        profileUnsubscribeRef.current = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile error:", err);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    }, (error) => {
      clearTimeout(fallbackTimer);
      console.error("Auth fatal state error:", error);
      setLoading(false);
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
      if (profileUnsubscribeRef.current) {
        profileUnsubscribeRef.current();
      }
    };
  }, []);

  // Sync Defibrillator and Haptic configuration to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('acls_defib_type', state.defibType);
      localStorage.setItem('acls_selected_energy', state.selectedEnergy.toString());
      localStorage.setItem('acls_haptic_duration', hapticDuration.toString());
      localStorage.setItem('acls_haptic_intensity', hapticIntensity.toString());
    } catch (e) {
      // Ignore if iframe sandbox blocks local storage
    }
  }, [state.defibType, state.selectedEnergy, hapticDuration, hapticIntensity]);

  // Metronome Sound and Click Sync
  useEffect(() => {
    let metronomeInterval: NodeJS.Timeout | null = null;
    
    if (state.isTimerRunning && state.rhythmCheckTimeLeft === 0 && (!state.activePrompt || state.activePrompt === 'EPI_DUE')) {
      metronomeInterval = setInterval(() => {
        if (soundEnabled) {
          MedicalAudio.playMetronomeBeat();
        }
        setMetronomeCount(prev => (prev + 1) % 4);
      }, 545); // ~110 BPM
    }

    return () => {
      if (metronomeInterval) clearInterval(metronomeInterval);
    };
  }, [state.isTimerRunning, state.rhythmCheckTimeLeft, state.activePrompt, soundEnabled]);

  // Active Resuscitation Timer Core Loop tick
  useEffect(() => {
    if (hasSessionStarted && (state.isTimerRunning || state.activePrompt === 'RHYTHM_CHECK')) {
      timerRef.current = setInterval(() => {
        setState(prev => {
          let nextTotal = prev.totalTime;
          let nextCpr = prev.cprTimeLeft;
          let nextEpi = prev.epiTimeLeft > 0 ? prev.epiTimeLeft - 1 : 0;
          let nextRhythmCheckLeft = prev.rhythmCheckTimeLeft;
          let nextActivePrompt = prev.activePrompt;
          let nextIsRunning = prev.isTimerRunning;

          // Increment Total
          if (nextIsRunning || nextActivePrompt === 'RHYTHM_CHECK') {
            nextTotal += 1;
          }

          // CPR cycle ticker - should NOT stop when nextActivePrompt is 'EPI_DUE'
          if (nextIsRunning && nextCpr > 0 && (nextActivePrompt === null || nextActivePrompt === 'EPI_DUE')) {
            nextCpr -= 1;
            if (nextCpr === 0) {
              // Time's up: prompt rhythm check evaluation
              nextActivePrompt = 'RHYTHM_CHECK';
              nextRhythmCheckLeft = 10;
              nextIsRunning = false;
              MedicalAudio.playCycleEnd();
            }
          }

          // Rhythm Evaluation evaluation ticking
          if (nextActivePrompt === 'RHYTHM_CHECK' && nextRhythmCheckLeft > 0) {
            nextRhythmCheckLeft -= 1;
            if (nextRhythmCheckLeft === 0) {
              // Sound alert on 10s interruption breach
              MedicalAudio.playUrgent();
            }
          }

          // Epinephrine Drug reminder ticker
          let nextEpiDueElapsed = prev.epiDueElapsed !== undefined ? prev.epiDueElapsed : 0;
          if (nextIsRunning && prev.epiTimeLeft > 0 && nextEpi === 0) {
            nextActivePrompt = 'EPI_DUE';
            nextEpiDueElapsed = 0;
            MedicalAudio.playAlert();
          }

          if (nextActivePrompt === 'EPI_DUE') {
            nextEpiDueElapsed += 1;
            if (nextEpiDueElapsed > 0 && nextEpiDueElapsed % 7 === 0) {
              MedicalAudio.playAlert();
            }
          } else {
            nextEpiDueElapsed = 0;
          }

          return {
            ...prev,
            totalTime: nextTotal,
            cprTimeLeft: nextCpr,
            epiTimeLeft: nextEpi,
            rhythmCheckTimeLeft: nextRhythmCheckLeft,
            activePrompt: nextActivePrompt,
            isTimerRunning: nextIsRunning,
            epiDueElapsed: nextEpiDueElapsed,
          };
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasSessionStarted, state.isTimerRunning, state.activePrompt]);

  const addLog = (type: EventType, description: string) => {
    const newLog: LogEvent = {
      id: Math.random().toString(36).substring(2, 11),
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
    vibrateDevice(40);
    if (!state.isTimerRunning && state.totalTime === 0) {
      addLog('CPR_START', 'Resuscitation started - Initial 10s Rhythm Assessment evaluation started.');
      MedicalAudio.playAlert();
    }
    setState(prev => ({ 
      ...prev, 
      isTimerRunning: !prev.isTimerRunning,
      cprCycleCount: (!prev.isTimerRunning && prev.totalTime === 0) ? 1 : prev.cprCycleCount,
      activePrompt: prev.activePrompt === 'RHYTHM_CHECK' ? null : prev.activePrompt,
      rhythmCheckTimeLeft: prev.activePrompt === 'RHYTHM_CHECK' ? 0 : prev.rhythmCheckTimeLeft
    }));
  };

  const resetCprTimer = () => {
    vibrateDevice(75);
    setState(prev => ({ 
      ...prev, 
      cprTimeLeft: CPR_CYCLE_DURATION,
      cprCycleCount: prev.cprCycleCount + 1,
      activePrompt: null,
      rhythmCheckTimeLeft: 0,
      isTimerRunning: true
    }));
    addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} finalized & restarted`);
  };

  const handleShock = () => {
    vibrateDevice([300, 100, 300, 100, 450]);
    MedicalAudio.playUrgent();
    setState(prev => ({ 
      ...prev, 
      shocksCount: prev.shocksCount + 1,
      cprTimeLeft: CPR_CYCLE_DURATION,
      cprCycleCount: prev.cprCycleCount + 1,
      currentRhythm: 'SHOCKABLE',
      activePrompt: null,
      rhythmCheckTimeLeft: 0,
      isTimerRunning: true
    }));
    addLog('SHOCK', `Defibrillation administered: ${state.selectedEnergy}J (Shock #${state.shocksCount + 1}) - Resuming CPR Cycle immediately`);
  };

  const handleEpi = () => {
    vibrateDevice([150, 80, 150]);
    MedicalAudio.playAlert();
    setState(prev => ({ 
      ...prev, 
      epiCount: prev.epiCount + 1,
      epiTimeLeft: EPI_INTERVAL,
      activePrompt: prev.activePrompt === 'EPI_DUE' ? null : prev.activePrompt,
      epiDueElapsed: 0
    }));
    addLog('DRUG_EPI', `Administered 1mg Epinephrine IV/IO (Total Dose Count: #${state.epiCount + 1}) - 3m countdown running`);
  };

  const handleRhythmSelect = (rhythm: PatientRhythm) => {
    vibrateDevice(50);
    setState(prev => {
      let nextPrompt: 'SHOCK_ADVISED' | 'EPI_ADVISED' | null = null;
      if (rhythm === 'SHOCKABLE') {
        nextPrompt = 'SHOCK_ADVISED';
      } else if (rhythm === 'NON_SHOCKABLE') {
        nextPrompt = 'EPI_ADVISED';
        MedicalAudio.playAlert();
      }
      
      return { 
        ...prev, 
        currentRhythm: rhythm,
        activePrompt: nextPrompt,
        isTimerRunning: nextPrompt ? false : true,
        rhythmCheckTimeLeft: 0, 
        cprTimeLeft: rhythm === 'NON_SHOCKABLE' ? CPR_CYCLE_DURATION : prev.cprTimeLeft
      };
    });
    addLog('RHYTHM_CHECK', `Rhythm Evaluation: Selected ${rhythm}`);
  };

  const handleRosc = () => {
    vibrateDevice([60, 60, 60, 60, 400]);
    setState(prev => ({ 
      ...prev, 
      isTimerRunning: false,
      activePrompt: null
    }));
    addLog('ROSC', 'ROSC ACHIEVED - Initiating Post-Cardiac Arrest Care Protocol');
  };

  const handleStartCPR = () => {
    vibrateDevice(100);
    setState(prev => ({
      ...prev,
      isTimerRunning: false,
      cprCycleCount: 0,
      activePrompt: 'RHYTHM_CHECK',
      rhythmCheckTimeLeft: 10,
      totalTime: 0,
      cprTimeLeft: CPR_CYCLE_DURATION,
      epiTimeLeft: EPI_INTERVAL,
    }));
    addLog('CPR_START', 'Resuscitation started - Initial 10s Rhythm Assessment evaluation started.');
    setHasSessionStarted(true);
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

  // Fallback Practitioner profile info
  const effectiveProfile: UserProfile = profile || {
    fullName: "Guest Practitioner",
    profession: "doctor",
    highestDegree: "MD / Specialist",
    dob: "1990-01-01",
    sex: "other",
    councilRegistration: "GUEST-KMC-003",
    email: user?.email || "guest@resuscitation.org",
    phone: "9800000000",
    onboardedAt: Date.now()
  };

  // Onboarding check if they logged in but never entered credentials
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-medical-dark flex items-center justify-center p-6">
        <OnboardingForm onComplete={() => {}} />
      </div>
    );
  }

  const renderInMobileLayout = isMobileScreen || deviceMode === 'phone_demo';

  const renderAppContent = () => {
    if (!hasSessionStarted) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-medical-dark overflow-y-auto" id="landing-screen">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full glass-panel p-6 space-y-6 border-medical-blue/20 shadow-2xl"
          >
            {/* Pulse cardiology heart */}
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <motion.div 
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="absolute inset-0 bg-red-500/10 rounded-full blur-xl"
              />
              <div className="w-14 h-14 bg-red-500/15 border border-red-500/25 rounded-2xl flex items-center justify-center text-red-500 shadow-md">
                <Heart className="w-7 h-7 fill-current animate-pulse animate-med-pulse" />
              </div>
            </div>

            <div>
              <span className="text-[8px] text-slate-550 uppercase tracking-[0.25em] font-black block mb-1">Nepal Resuscitation Registry • Kathmandu</span>
              <h1 className="text-2xl font-display font-bold text-white tracking-tight">ACLS Companion</h1>
              <p className="text-[#3B82F6] text-[8.5px] uppercase tracking-widest font-mono font-bold mt-1">Practice & Live Monitor System • v3.0</p>
            </div>

            <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-1 text-center font-sans">
              <span className="text-[7.5px] uppercase tracking-widest text-[#64748B] font-heavy block">Identified Resuscicater</span>
              <span className="text-xs font-black text-slate-200 block">{effectiveProfile.fullName}</span>
              <p className="text-[8px] text-slate-450 font-mono">
                {effectiveProfile.profession.toUpperCase()} • REG: {effectiveProfile.councilRegistration}
              </p>
            </div>

            <p className="text-slate-400 text-[10px] leading-relaxed max-w-sm mx-auto">
              Please calibrate defibrillation joules. In case of active arrest code, click below immediately to activate resuscitation logs.
            </p>

            <button 
              id="start-cpr-btn"
              onClick={() => {
                vibrateDevice(80);
                setActiveTab('timer');
                handleStartCPR();
              }}
              className="w-full h-12 bg-red-650 hover:bg-red-500 text-white rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-red-500/10 uppercase tracking-widest text-[10px] border-none cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Initialize Code Timer
            </button>
          </motion.div>
        </div>
      );
    }

    if (renderInMobileLayout) {
      return (
        <MobileDashboard 
          state={state}
          setState={setState}
          hasSessionStarted={hasSessionStarted}
          setHasSessionStarted={setHasSessionStarted}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          phoneTime={phoneTime}
          batteryLevel={batteryLevel}
          isVibrating={isVibrating}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          metronomeCount={metronomeCount}
          triggerPwaInstall={triggerPwaInstall}
          vibrateDevice={vibrateDevice}
          formatTime={formatTime}
          cprProgress={cprProgress}
          epiProgress={epiProgress}
          toggleTimer={toggleTimer}
          resetCprTimer={resetCprTimer}
          handleShock={handleShock}
          handleEpi={handleEpi}
          handleRosc={handleRosc}
          handleRhythmSelect={handleRhythmSelect}
          addLog={addLog}
          effectiveProfile={effectiveProfile}
          handleStartCPR={handleStartCPR}
          hapticDuration={hapticDuration}
          setHapticDuration={setHapticDuration}
          hapticIntensity={hapticIntensity}
          setHapticIntensity={setHapticIntensity}
        />
      );
    } else {
      return (
        <DesktopDashboard 
          state={state}
          setState={setState}
          setHasSessionStarted={setHasSessionStarted}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          toggleTimer={toggleTimer}
          resetCprTimer={resetCprTimer}
          handleShock={handleShock}
          handleEpi={handleEpi}
          handleRosc={handleRosc}
          handleRhythmSelect={handleRhythmSelect}
          effectiveProfile={effectiveProfile}
          formatTime={formatTime}
          cprProgress={cprProgress}
          epiProgress={epiProgress}
          vibrateDevice={vibrateDevice}
          triggerPwaInstall={triggerPwaInstall}
          hapticDuration={hapticDuration}
          setHapticDuration={setHapticDuration}
          hapticIntensity={hapticIntensity}
          setHapticIntensity={setHapticIntensity}
        />
      );
    }
  };

  // Global Dialog Overlay modals
  const renderGlobalPromptModals = () => {
    return (
      <AnimatePresence>
        {state.activePrompt && state.activePrompt !== 'EPI_DUE' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 select-none"
          >
            <motion.div 
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel w-full max-w-sm p-6 text-center border-blue-500/25 bg-[#090e18] shadow-2xl rounded-2xl border"
            >
              {state.activePrompt === 'RHYTHM_CHECK' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-400 animate-pulse border border-blue-500/30">
                    <Activity className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Rhythm Evaluation Pause</h3>
                    <p className="text-[#94A3B8] text-[9px] uppercase tracking-widest font-bold mt-1">Interrupted Chest Compressions (Max 10s)</p>
                  </div>

                  {/* Progress evaluation timer bar */}
                  <div className="space-y-1 pb-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold text-slate-550">
                      <span>EVALUATION INTERRUPTED</span>
                      <span className={state.rhythmCheckTimeLeft <= 3 ? 'text-red-400 font-bold animate-ping' : 'text-blue-400'}>{state.rhythmCheckTimeLeft}s</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-blue-500" animate={{ width: `${(state.rhythmCheckTimeLeft / 10) * 100}%` }} />
                    </div>
                    {state.rhythmCheckTimeLeft === 0 && (
                      <p className="text-[8px] text-red-500 uppercase font-black tracking-wider animate-pulse pt-0.5">⚠️ BREACH ALERT: RESUME CPR IMMEDIATELY</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => handleRhythmSelect('SHOCKABLE')}
                      className="h-11 rounded-xl bg-red-650 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest transition-transform cursor-pointer border-none shadow-lg shadow-red-600/15"
                    >
                      VF / pulseless VT (YES SHOCK)
                    </button>
                    <button 
                      onClick={() => handleRhythmSelect('NON_SHOCKABLE')}
                      className="h-11 rounded-xl bg-slate-800 text-slate-350 hover:text-white hover:bg-slate-700 text-[10px] font-bold uppercase tracking-widest transition-transform cursor-pointer border-none"
                    >
                      Asystole / PEA (NO SHOCK)
                    </button>
                  </div>
                </div>
              )}

              {state.activePrompt === 'SHOCK_ADVISED' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-400 border border-red-500/20 shadow shadow-red-500/10">
                    <Zap className="w-7 h-7 fill-current animate-bounce animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-red-500 uppercase tracking-tight">Shock Advised!</h3>
                    <p className="text-[#E2E8F0] text-xs font-black uppercase tracking-wider">CLEAR ALL STANDERS</p>
                  </div>
                  
                  <button 
                    onClick={handleShock}
                    className="w-full h-12 rounded-xl bg-red-650 text-white font-bold uppercase text-[10px] tracking-widest border-none shadow-lg shadow-red-650/20"
                  >
                    DELIVER RESCUE SHOCK ({state.selectedEnergy}J)
                  </button>
                </div>
              )}

              {state.activePrompt === 'EPI_ADVISED' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-400 border border-blue-500/20">
                    <Syringe className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-blue-400 uppercase tracking-tight">Non-Shockable protocol</h3>
                    <p className="text-[#94A3B8] text-[9.5px] uppercase font-bold tracking-widest mt-1">Dispense drug & continue chest loops</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-2">
                    <button 
                      onClick={handleEpi}
                      className="w-full h-11 rounded-xl bg-blue-500 text-white font-bold uppercase text-[9.5px] tracking-widest border-none flex items-center justify-center gap-1 shadow-md"
                    >
                      <Syringe className="w-3.5 h-3.5" /> Administer 1mg Epi
                    </button>
                    
                    <button 
                      onClick={() => {
                        addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} finalized & started`);
                        setState(prev => ({ 
                          ...prev, 
                          activePrompt: null, 
                          isTimerRunning: true,
                          cprCycleCount: prev.cprCycleCount + 1
                        }));
                      }}
                      className="w-full h-11 rounded-xl bg-white text-medical-dark font-bold uppercase text-[9.5px] tracking-widest"
                    >
                      Bypass to CPR Cycle #{state.cprCycleCount + 1}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen bg-[#050B16] text-[#E2E8F0] font-sans antialiased flex flex-col" id="acls-app-root">
      
      {/* If phone_demo or simulated on desktop, render simulated pixel container */}
      {deviceMode === 'phone_demo' && !isMobileScreen ? (
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 lg:p-8 gap-8 overflow-hidden relative" id="emulator-workspace">
          
          {/* Workstation layout info panel */}
          <div className="max-w-md w-full flex flex-col justify-between py-6 space-y-5 text-left shrink-0 select-none z-10" id="emulator-panel">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Smartphone className="w-4.5 h-4.5 fill-current" />
                </div>
                <div>
                  <h1 className="text-xl font-display font-black tracking-tight text-white uppercase leading-none">Nepal ACLS Companion</h1>
                  <span className="text-[7.5px] text-[#22C55E] font-black tracking-widest uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-1 block w-fit">ANDROID PROTOCOL OK</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal uppercase font-bold">
                Interact with on-screen tablets. In active codes, use haptic feedback vibration monitors to track metrics accurately.
              </p>
            </div>

            {/* Config Selectors */}
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Viewport mode selector</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => {
                    vibrateDevice(50);
                    setDeviceMode('phone_demo');
                  }}
                  className={`py-2 px-3 rounded-lg font-bold uppercase text-[8.5px] tracking-wider flex items-center justify-center gap-1.5 transition-colors border-none cursor-pointer ${deviceMode === 'phone_demo' ? 'bg-emerald-600 text-white shadow shadow-emerald-500/10' : 'bg-slate-850 text-slate-400'}`}
                >
                  <Smartphone className="w-3.5 h-3.5 fill-current" /> Phone Demo
                </button>
                <button 
                  onClick={() => {
                    vibrateDevice(50);
                    setDeviceMode('standalone');
                  }}
                  className={`py-2 px-3 rounded-lg font-bold uppercase text-[8.5px] tracking-wider flex items-center justify-center gap-1.5 transition-colors border-none cursor-pointer ${deviceMode === 'standalone' ? 'bg-[#3B82F6] text-white shadow shadow-blue-500/10' : 'bg-slate-850 text-slate-400'}`}
                >
                  <Laptop className="w-3.5 h-3.5" /> Fullscreen View
                </button>
              </div>
            </div>

            {/* Specs */}
            <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2 font-mono text-[9px]">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span className="text-slate-500 font-bold">ANDROID RUNTIME</span>
                <span className="text-emerald-400 font-bold">ACTIVE REGISTRY SENDER (LTE)</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Android OS API:</span>
                  <span className="text-slate-200">API 34 (Android 14)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Battery Status:</span>
                  <span className="text-slate-200">{batteryLevel}% (Optimized)</span>
                </div>
                <div className="flex justify-between items-center text-[8.5px]">
                  <span className="text-slate-500">Haptics Core vibrator:</span>
                  <div className="flex items-center gap-1 font-bold">
                    <span className={`w-1.5 h-1.5 rounded-full ${isVibrating ? 'bg-red-500 animate-ping' : 'bg-slate-700'}`} />
                    <span className={isVibrating ? 'text-red-400 animate-pulse' : 'text-slate-550'}>
                      {isVibrating ? 'TACTILE SHOCK PULSING' : 'VIBRATOR READY'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostics logger */}
            <div className="p-3.5 bg-slate-900/50 border border-slate-800 rounded-xl space-y-1.5">
              <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold block">Developer notifications Feed</span>
              <div className="bg-slate-950 p-2 rounded-lg border border-white/5 h-16 overflow-y-auto font-mono text-[8.5px] text-[#A7F3D0] space-y-0.5 scroll-smooth">
                {state.logs.length === 0 ? (
                  <span className="text-slate-700 block">NO DIAGNOSTIC LOGS TRANSMITTED IN ACTIVE SESSION.</span>
                ) : (
                  [...state.logs].reverse().map((lg, i) => (
                    <div key={i} className="flex gap-1">
                      <span className="text-slate-600 shrink-0">[{new Date(lg.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                      <span className="text-emerald-400 uppercase leading-snug">{lg.description}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* PHYSICAL ANDROID PHONE MOCKUP */}
          <div className="relative flex items-center justify-center select-none" id="android-device-shell">
            <div className={`absolute -inset-3.5 rounded-[55px] blur-xl transition-all duration-300 pointer-events-none -z-10 ${
              isVibrating ? 'bg-[#EF4444]/15 scale-102 border-2 border-red-500/10' : 'bg-transparent'
            }`} />

            <div className="absolute right-[-14px] top-[140px] w-1 h-14 bg-slate-800 rounded-l border border-slate-700 border-r-0" />
            <div className="absolute right-[-14px] top-[220px] w-1 h-10 bg-slate-800 rounded-l border border-slate-700 border-r-0" />

            <div className="relative bg-[#020617] border-[10px] border-[#334155]/90 rounded-[48px] shadow-[0_25px_65px_-12px_rgba(0,0,0,0.92)] flex flex-col w-[360px] h-[720px] shrink-0 overflow-hidden">
              {/* hole-punch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center z-[150] shadow-inner">
                <div className="w-1 h-1 rounded-full bg-[#1e293b]/45" />
              </div>

              {/* Status Header Bar */}
              <div className="h-6.5 w-full bg-slate-950 px-4 flex items-center justify-between z-[140] select-none text-[8.5px] font-bold text-slate-350 font-mono shrink-0 border-b border-white/5">
                <div className="flex items-center gap-1">
                  <span className="font-display font-black text-emerald-400">NT-RESUSCITATE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>🔋 {batteryLevel}%</span>
                  <span className="font-sans text-[9px] text-white font-extrabold">{phoneTime}</span>
                </div>
              </div>

              <div className="flex-1 w-full flex flex-col overflow-hidden relative">
                {renderAppContent()}
              </div>

              {/* Pill android home */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-0.5 bg-[#475569] rounded-full z-[140] opacity-80" />
            </div>
          </div>

        </div>
      ) : (
        /* Standalone view */
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="h-5.5 w-full bg-slate-950 px-4 flex items-center justify-between z-50 select-none text-[8px] font-bold text-slate-350 font-mono shrink-0 border-b border-light/5">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold block">Nepal Resuscitation Command PWA</span>
            </div>
            {!isMobileScreen && (
              <div className="flex gap-3 font-sans text-[8.5px] text-slate-500">
                <button onClick={() => setDeviceMode('phone_demo')} className="hover:text-emerald-400">📱 Mobile Emulator Mode</button>
                <div className="text-white">💻 Standard Desktop Workspace</div>
              </div>
            )}
            <div>
              <span>🔋 {batteryLevel}%</span>
              <span className="text-white font-sans ml-1">{phoneTime}</span>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col overflow-hidden relative">
            {renderAppContent()}
          </div>
        </div>
      )}

      {/* Global Modals for alarms, shocks and rhythms check evaluations */}
      {renderGlobalPromptModals()}
    </div>
  );
}
