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
  ShieldCheck,
  FileText,
  X,
  CheckCircle2,
  Printer,
  Sparkles,
  Sun,
  Moon,
  Database,
  RefreshCw,
  Bot,
  Clock,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  EventType, 
  LogEvent, 
  PatientRhythm, 
  AclsState,
  UserProfile,
  SavedCase
} from './types';
import { 
  CPR_CYCLE_DURATION, 
  EPI_INTERVAL, 
} from './constants';
import { MedicalAudio } from './lib/audio';
import {
  advanceClock,
  arrestSeconds,
  clearedClockFields,
  confirmRosc,
  deliverShock,
  giveAmiodarone,
  giveEpinephrine,
  giveLidocaine,
  isCodeActive,
  pauseCpr,
  resumeCpr,
  selectRhythm,
  startCode,
  startCprCycle,
  stopClock,
  amiodaroneDoseLabel,
  lidocaineDoseLabel,
  AMIODARONE_MAX_DOSES,
  LIDOCAINE_MAX_DOSES,
} from './lib/codeClock';
import { 
  auth, 
  db, 
  testFirestoreConnection, 
  syncUserProfileToFirestore, 
  syncSavedCasesToFirestore 
} from './lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import MobileDashboard from './components/MobileDashboard';
import GeminiResusCopilot from './components/GeminiResusCopilot';

const AuthModal = React.lazy(() => import('./components/AuthModal'));
const DoctorKycModal = React.lazy(() => import('./components/DoctorKycModal'));
const AdminKycPanel = React.lazy(() => import('./components/AdminKycPanel'));
const VerificationGatekeeperModal = React.lazy(() => import('./components/VerificationGatekeeperModal'));
const SavedCasesList = React.lazy(() => import('./components/SavedCasesList'));

function CprLogo({ className = "w-28 h-auto", isDark = false }: { className?: string; isDark?: boolean }) {
  const primaryColor = isDark ? "#FFFFFF" : "#000000";
  const cutColor = isDark ? "#000000" : "#FFFFFF";

  return (
    <svg viewBox="0 0 500 400" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Red Heart Outline */}
      <path
        d="M 250, 365 C 130, 270 45, 185 45, 115 C 45, 60 88, 20 145, 20 C 185, 20 225, 45 250, 75 C 275, 45 315, 20 355, 20 C 412, 20 455, 60 455, 115 C 455, 185 370, 270 250, 365 Z"
        stroke="#E60000"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* ECG Line */}
      <path
        d="M 5, 210 H 75 L 95, 140 L 115, 265 L 135, 75 L 160, 250 L 180, 185 L 195, 210 H 215"
        stroke={primaryColor}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors duration-200"
      />
      {/* Rescuer Head */}
      <circle cx="300" cy="52" r="32" fill={primaryColor} className="transition-colors duration-200" />
      {/* Rescuer Torso & Arms */}
      <path
        d="M 252, 110 H 348 C 352, 110 355, 115 352, 125 L 320, 240 H 280 L 248, 125 C 245, 115 248, 110 252, 110 Z"
        fill={primaryColor}
        className="transition-colors duration-200"
      />
      {/* V-Cut inside Rescuer Torso */}
      <path
        d="M 276, 110 L 300, 195 L 324, 110 Z"
        fill={cutColor}
        className="transition-colors duration-200"
      />
      {/* Patient Head */}
      <circle cx="180" cy="270" r="32" fill={primaryColor} className="transition-colors duration-200" />
      {/* Patient Torso & Body Lying Down */}
      <rect
        x="210"
        y="238"
        width="240"
        height="64"
        rx="32"
        fill={primaryColor}
        className="transition-colors duration-200"
      />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem('acls_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const [hasSessionStarted, setHasSessionStarted] = useState(false);

  // Modal Dialog States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isVerificationGatekeeperOpen, setIsVerificationGatekeeperOpen] = useState(false);
  const [isLandingSavedCasesOpen, setIsLandingSavedCasesOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const hasAutoPromptedKycRef = useRef<boolean>(false);

  // Saved Cases State (Max 3 Cases)
  const [savedCases, setSavedCases] = useState<SavedCase[]>(() => {
    try {
      const raw = localStorage.getItem('acls_saved_cases');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [isGuestMode, setIsGuestMode] = useState(false);

  // Cloud Database Sync Status ('synced' | 'syncing' | 'offline')
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(Date.now());

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

  // Display Theme State ('medical-white' | 'clinical-dark')
  const [theme, setTheme] = useState<'medical-white' | 'clinical-dark'>(() => {
    try {
      const saved = localStorage.getItem('acls_theme');
      if (saved === 'clinical-dark' || saved === 'medical-white') {
        return saved;
      }
    } catch (e) {
      // Safe fallback
    }
    return 'medical-white';
  });

  useEffect(() => {
    try {
      localStorage.setItem('acls_theme', theme);
    } catch (e) {
      // Safe fallback
    }
    if (theme === 'clinical-dark') {
      document.documentElement.classList.add('clinical-dark');
      document.documentElement.classList.remove('medical-white');
    } else {
      document.documentElement.classList.add('medical-white');
      document.documentElement.classList.remove('clinical-dark');
    }
  }, [theme]);

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
      ...clearedClockFields(),
      amioCount: 0,
      lidoCount: 0,
      alert: null,
    };
  });

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

  // Audio and timer cleanup on page unload, app hide or close
  useEffect(() => {
    const handleStopAudio = () => {
      MedicalAudio.stopAll();
    };

    window.addEventListener('beforeunload', handleStopAudio);
    window.addEventListener('pagehide', handleStopAudio);

    return () => {
      window.removeEventListener('beforeunload', handleStopAudio);
      window.removeEventListener('pagehide', handleStopAudio);
      MedicalAudio.stopAll();
    };
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
      if (!currentUser) {
        hasAutoPromptedKycRef.current = false;
      }
      if (currentUser) {
        const cleanEmail = (currentUser.email || '').toLowerCase().trim();
        const isAdminUser = cleanEmail === 'user.suniltim@gmail.com';

        const profileDocRef = doc(db, 'profiles', currentUser.uid);
        profileUnsubscribeRef.current = onSnapshot(profileDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const pData = docSnap.data() as any;
            if (isAdminUser) {
              pData.isAdmin = true;
              if (!pData.kyc) pData.kyc = {};
              pData.kyc.kycStatus = 'approved';
              pData.kyc.councilRegistration = pData.kyc.councilRegistration || 'NMC-COUNCIL-ADMIN';
            }
            setProfile(pData as UserProfile);

            // First-time user auto-prompt for Doctor KYC (only for non-admins)
            const kycStatus = pData?.kyc?.kycStatus;
            if (!isAdminUser && !hasAutoPromptedKycRef.current && (!kycStatus || kycStatus === 'unsubmitted')) {
              hasAutoPromptedKycRef.current = true;
              setTimeout(() => {
                setIsKycModalOpen(true);
              }, 400);
            } else if (isAdminUser) {
              hasAutoPromptedKycRef.current = true;
            }

            try {
              localStorage.setItem('acls_user_profile', JSON.stringify(pData));
              const map = new Map<string, SavedCase>();
              if (Array.isArray(pData.savedCases)) {
                pData.savedCases.forEach((c: SavedCase) => map.set(c.id, c));
              }
              const merged = Array.from(map.values()).slice(0, 3);
              setSavedCases(merged);
              try {
                localStorage.setItem('acls_saved_cases', JSON.stringify(merged));
              } catch (e) {}
            } catch (e) {}
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
            setLoading(false);
          } else {
            // Document doesn't exist in 'profiles' yet - check local cache or create default profile in Firestore
            let cachedProf: UserProfile | null = null;
            try {
              const local = localStorage.getItem('acls_user_profile');
              if (local) {
                const parsed = JSON.parse(local);
                if (parsed.email === currentUser.email) {
                  cachedProf = parsed;
                }
              }
            } catch (e) {}

            const defaultProf: UserProfile = cachedProf ? {
              ...cachedProf,
              email: currentUser.email || cachedProf.email,
              isAdmin: isAdminUser || cachedProf.isAdmin
            } : {
              fullName: currentUser.displayName || (isAdminUser ? 'Medical Council Admin' : (currentUser.email?.split('@')[0] || 'Practitioner')),
              email: currentUser.email || '',
              profession: 'doctor',
              highestDegree: isAdminUser ? 'MD / Specialist' : 'MBBS',
              councilRegistration: isAdminUser ? 'NMC-COUNCIL-ADMIN' : '',
              dob: '1990-01-01',
              sex: 'male',
              phone: '',
              isAdmin: isAdminUser,
              onboardedAt: Date.now(),
              kyc: {
                kycStatus: isAdminUser ? 'approved' : 'unsubmitted',
                councilRegistration: isAdminUser ? 'NMC-COUNCIL-ADMIN' : '',
                degree: isAdminUser ? 'MD / Specialist' : 'MBBS',
                specialty: isAdminUser ? 'Nepal Medical Council Board' : '',
                institution: isAdminUser ? 'Nepal Medical Council' : '',
                ...(isAdminUser ? { approvedAt: Date.now(), approvedBy: 'System Admin' } : {})
              }
            };

            setDoc(profileDocRef, defaultProf, { merge: true })
              .then(() => {
                setSyncStatus('synced');
                setLastSyncedAt(Date.now());
              })
              .catch((e) => console.warn("Auto-create profile failed:", e));
            setProfile(defaultProf);
            try {
              localStorage.setItem('acls_user_profile', JSON.stringify(defaultProf));
            } catch (e) {}
            setLoading(false);
          }
        }, (err) => {
          console.error("Profile error:", err);
          setSyncStatus('offline');
          setProfile(null);
          setLoading(false);
        });
      } else {
        MedicalAudio.stopAll();
        setState(prev => ({
          ...prev,
          isTimerRunning: false,
          activePrompt: null,
          rhythmCheckTimeLeft: 0,
        }));
        setProfile(null);
        setSavedCases([]);
        try {
          localStorage.removeItem('acls_user_profile');
          localStorage.removeItem('acls_saved_cases');
          localStorage.removeItem('acls_copilot_messages');
        } catch (e) {}
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

  // Force Cloud Database Synchronizer
  const handleForceSync = async () => {
    setSyncStatus('syncing');
    try {
      await testFirestoreConnection();
      if (user?.uid) {
        await syncSavedCasesToFirestore(user.uid, savedCases);
        if (profile) {
          await syncUserProfileToFirestore(user.uid, profile);
        }
      }
      setSyncStatus('synced');
      setLastSyncedAt(Date.now());
    } catch (e) {
      console.warn("Force sync offline/fallback:", e);
      setSyncStatus('offline');
    }
  };

  // Auto-sync when internet reconnects
  useEffect(() => {
    const handleOnline = () => {
      handleForceSync();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, profile, savedCases]);

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

  // Resuscitation clock. Every timer is recalculated from real timestamps
  // (see src/lib/codeClock.ts), so a dimmed or locked phone can't slow it down.
  // Runs for the whole code, including while prompts are open and while the
  // home screen is showing.
  useEffect(() => {
    if (!state.codeStartedAt) return;
    const tick = () => setState(prev => advanceClock(prev, Date.now()));
    tick();
    const interval = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state.codeStartedAt]);

  // Play each clock alert exactly once.
  const lastAlertSeqRef = useRef(0);
  useEffect(() => {
    const alert = state.alert;
    if (!alert || alert.seq === lastAlertSeqRef.current) return;
    lastAlertSeqRef.current = alert.seq;
    if (alert.kind === 'cycleEnd') MedicalAudio.playCycleEnd();
    else if (alert.kind === 'urgent') MedicalAudio.playUrgent();
    else MedicalAudio.playAlert();
  }, [state.alert?.seq]);

  // Keep the screen on while the patient is in arrest.
  const codeIsActive = isCodeActive(state);
  useEffect(() => {
    if (!codeIsActive || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await (navigator as any).wakeLock.request('screen');
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch (e) {
        // Not allowed right now (e.g. low battery mode); the clock stays accurate regardless.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [codeIsActive]);

  const addLog = (type: EventType, description: string) => {
    const newLog: LogEvent = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      type,
      description,
    };
    setState(prev => ({
      ...prev,
      // Keep every event: the journal is the record of the whole code.
      logs: [newLog, ...prev.logs],
    }));
  };

  const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const logReArrestIfNeeded = () => {
    if (state.roscAt) {
      addLog('CPR_START', `Re-arrest after ROSC - CPR restarted (arrest time so far ${formatClock(arrestSeconds(state, state.roscAt))})`);
    }
  };

  const toggleTimer = () => {
    vibrateDevice(40);
    const now = Date.now();
    if (state.isTimerRunning) {
      addLog('INFO', `Compressions paused - CPR cycle held at ${formatClock(state.cprTimeLeft)}`);
      setState(prev => pauseCpr(prev, now));
      return;
    }
    if (state.roscAt) {
      logReArrestIfNeeded();
      MedicalAudio.playAlert();
    } else if (!state.codeStartedAt) {
      addLog('CPR_START', 'Resuscitation started');
      MedicalAudio.playAlert();
    } else {
      addLog('INFO', 'Compressions resumed');
    }
    setState(prev => resumeCpr(prev, now));
  };

  const resetCprTimer = () => {
    vibrateDevice(75);
    logReArrestIfNeeded();
    addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} started`);
    setState(prev => startCprCycle(prev, Date.now()));
  };

  const handleBeginCpr = () => {
    vibrateDevice(75);
    addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} started`);
    setState(prev => startCprCycle(prev, Date.now()));
  };

  const handleShock = () => {
    vibrateDevice([300, 100, 300, 100, 450]);
    MedicalAudio.playUrgent();
    logReArrestIfNeeded();
    addLog('SHOCK', `Defibrillation administered: ${state.selectedEnergy}J (Shock #${state.shocksCount + 1}) - Resuming CPR Cycle immediately`);
    setState(prev => deliverShock(prev, Date.now()));
  };

  const handleEpi = () => {
    vibrateDevice([150, 80, 150]);
    MedicalAudio.playAlert();
    addLog('DRUG_EPI', `Administered 1mg Epinephrine IV/IO (Total Dose Count: #${state.epiCount + 1}) - 3m countdown running`);
    setState(prev => giveEpinephrine(prev, Date.now()));
  };

  const handleAmiodarone = () => {
    const dose = (state.amioCount ?? 0) + 1;
    if (dose > AMIODARONE_MAX_DOSES) return;
    vibrateDevice([150, 80, 150]);
    addLog('DRUG_AMIO', `Amiodarone ${amiodaroneDoseLabel(dose)} IV/IO (dose ${dose} of ${AMIODARONE_MAX_DOSES})`);
    setState(prev => giveAmiodarone(prev));
  };

  const handleLidocaine = () => {
    const dose = (state.lidoCount ?? 0) + 1;
    if (dose > LIDOCAINE_MAX_DOSES) return;
    vibrateDevice([150, 80, 150]);
    addLog('DRUG_LIDO', `Lidocaine ${lidocaineDoseLabel(dose)} IV/IO (dose ${dose}; max total 3 mg/kg)`);
    setState(prev => giveLidocaine(prev));
  };

  const handleRhythmSelect = (rhythm: PatientRhythm) => {
    vibrateDevice(50);
    if (rhythm === 'NON_SHOCKABLE') {
      MedicalAudio.playAlert();
    }
    const checkNumber = (state.rhythmCheckCount ?? 0) + 1;
    const label = rhythm === 'SHOCKABLE' ? 'VF / pulseless VT (shockable)' : rhythm === 'NON_SHOCKABLE' ? 'Asystole / PEA (non-shockable)' : rhythm;
    addLog('RHYTHM_CHECK', `Rhythm check #${checkNumber}: ${label}`);
    setState(prev => selectRhythm(prev, rhythm, Date.now()));
  };

  const handleRosc = () => {
    if (!state.codeStartedAt || state.roscAt) return;
    vibrateDevice([60, 60, 60, 60, 400]);
    const now = Date.now();
    addLog('ROSC', `ROSC achieved after ${formatClock(arrestSeconds(state, now))} of arrest time - Initiating Post-Cardiac Arrest Care Protocol`);
    setState(prev => confirmRosc(prev, now));
  };

  const handleRoscAtRhythmCheck = () => {
    if (!state.codeStartedAt || state.roscAt) return;
    vibrateDevice([60, 60, 60, 60, 400]);
    const now = Date.now();
    const checkNumber = (state.rhythmCheckCount ?? 0) + 1;
    addLog('RHYTHM_CHECK', `Rhythm check #${checkNumber}: organized rhythm with pulse`);
    addLog('ROSC', `ROSC confirmed at rhythm check #${checkNumber} after ${formatClock(arrestSeconds(state, now))} of arrest time - Initiating Post-Cardiac Arrest Care Protocol`);
    setState(prev => confirmRosc({ ...prev, rhythmCheckCount: (prev.rhythmCheckCount ?? 0) + 1 }, now));
  };

  const handleStartCPR = () => {
    vibrateDevice(100);
    // A code is already running (e.g. the user tapped back to the home screen):
    // go back to it instead of restarting the clock.
    if (isCodeActive(state)) {
      setHasSessionStarted(true);
      return;
    }
    addLog('CPR_START', 'Resuscitation started - Initial 10s Rhythm Assessment evaluation started.');
    setState(prev => startCode(prev, Date.now()));
    setHasSessionStarted(true);
  };

  const handleSignOut = async () => {
    try {
      MedicalAudio.stopAll();
      setState(prev => stopClock(prev));
      setHasSessionStarted(false);
      try {
        localStorage.removeItem('acls_user_profile');
        localStorage.removeItem('acls_saved_cases');
        localStorage.removeItem('acls_copilot_messages');
      } catch (e) {}
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setSavedCases([]);
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  const handleSaveCurrentCase = (patientCode: string, signatureDataUrl?: string): boolean => {
    if (savedCases.length >= 3) {
      return false; // Limit of 3 cases reached
    }

    const newCase: SavedCase = {
      id: `case_${Date.now()}`,
      patientCode: patientCode || `CASE-${Date.now().toString().slice(-4)}`,
      savedAt: Date.now(),
      totalDuration: state.totalTime,
      cprCycleCount: state.cprCycleCount,
      shocksCount: state.shocksCount,
      epiCount: state.epiCount,
      logs: state.logs,
      certifiedBy: effectiveProfile.fullName,
      councilRegistration: effectiveProfile.councilRegistration,
      signatureDataUrl: signatureDataUrl || '',
    };

    const updated = [newCase, ...savedCases];
    setSavedCases(updated);

    try {
      localStorage.setItem('acls_saved_cases', JSON.stringify(updated));
    } catch (e) {}

    if (user?.uid) {
      setSyncStatus('syncing');
      syncSavedCasesToFirestore(user.uid, updated)
        .then((ok) => {
          if (ok) {
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          } else {
            setSyncStatus('offline');
          }
        })
        .catch(() => setSyncStatus('offline'));
    }

    return true;
  };

  const handleDeleteCase = (caseId: string) => {
    const updated = savedCases.filter(c => c.id !== caseId);
    setSavedCases(updated);

    try {
      localStorage.setItem('acls_saved_cases', JSON.stringify(updated));
    } catch (e) {}

    if (user?.uid) {
      setSyncStatus('syncing');
      syncSavedCasesToFirestore(user.uid, updated)
        .then((ok) => {
          if (ok) {
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          } else {
            setSyncStatus('offline');
          }
        })
        .catch(() => setSyncStatus('offline'));
    }
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

  // Fallback Practitioner profile info & Admin Detection
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isUserAdmin = Boolean(
    userEmail === 'user.suniltim@gmail.com' ||
    profile?.isAdmin === true
  );

  const effectiveProfile: UserProfile = profile ? {
    ...profile,
    isAdmin: isUserAdmin || profile.isAdmin,
    kyc: isUserAdmin ? {
      kycStatus: 'approved',
      councilRegistration: profile.kyc?.councilRegistration || profile.councilRegistration || 'NMC-COUNCIL-ADMIN',
      degree: profile.kyc?.degree || 'MD / Specialist',
      specialty: profile.kyc?.specialty || 'Nepal Medical Council Board',
      institution: profile.kyc?.institution || 'Nepal Medical Council'
    } : profile.kyc
  } : {
    fullName: isUserAdmin ? "Medical Council Admin" : "Guest Practitioner",
    profession: "doctor",
    highestDegree: isUserAdmin ? "MD / Specialist" : "MBBS",
    dob: "1990-01-01",
    sex: "other",
    councilRegistration: isUserAdmin ? "NMC-COUNCIL-ADMIN" : "GUEST-KMC-003",
    email: user?.email || "guest@resuscitation.org",
    phone: "9800000000",
    isAdmin: isUserAdmin,
    onboardedAt: Date.now(),
    kyc: {
      kycStatus: isUserAdmin ? 'approved' : 'unsubmitted',
      councilRegistration: isUserAdmin ? 'NMC-COUNCIL-ADMIN' : '',
      degree: isUserAdmin ? 'MD / Specialist' : 'MBBS',
      specialty: isUserAdmin ? 'Nepal Medical Council Board' : '',
      institution: isUserAdmin ? 'Nepal Medical Council' : ''
    }
  };

  const isVerifiedDoctor = Boolean(user && (profile?.kyc?.kycStatus === 'approved' || isUserAdmin));

  const handleOpenCopilot = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (profile?.kyc?.kycStatus !== 'approved') {
      if (!profile?.kyc || profile.kyc.kycStatus === 'unsubmitted') {
        setIsKycModalOpen(true);
      } else {
        setIsVerificationGatekeeperOpen(true);
      }
      return;
    }
    setIsCopilotOpen(true);
  };

  const renderAppContent = () => {
    if (!hasSessionStarted) {
      const isDark = theme === 'clinical-dark';
      return (
        <div className={`flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none overflow-y-auto ${
          isDark ? 'bg-[#0b0f19] text-white' : 'bg-[#f8fafc] text-black'
        }`} id="landing-screen">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`max-w-md w-full p-6 space-y-5 border rounded-3xl shadow-xl my-auto text-left ${
              isDark ? 'bg-slate-900/80 border-white/10 text-white' : 'bg-white border-gray-200 text-black'
            }`}
          >
            {/* CPR Logo Graphic */}
            <div className="mx-auto flex items-center justify-center">
              <CprLogo className="w-28 sm:w-32 h-auto max-h-24" isDark={isDark} />
            </div>

            <div className="text-center">
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">ACLS Companion</h1>
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? 'medical-white' : 'clinical-dark')}
                  className={`p-2 rounded-xl border text-[9px] font-bold uppercase tracking-wider flex items-center justify-center cursor-pointer transition-colors ${
                    isDark 
                      ? 'border-indigo-500/30 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' 
                      : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                  title="Switch theme"
                >
                  {isDark ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-600" />
                  )}
                </button>
              </div>
              <p className="text-red-600 text-[8.5px] uppercase tracking-widest font-mono font-bold">Practice & Live Monitor System • 2025 Nepal Standards</p>
            </div>

            <p className={`text-[9.5px] leading-relaxed text-center font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              Please contact owner/developer of app via email at <a href="mailto:user.suniltim@gmail.com" className="text-red-600 dark:text-red-400 underline font-semibold">user.suniltim@gmail.com</a> to request access if you are physicians outside Nepal. In case of active arrest code, click below immediately to activate resuscitation logs.
            </p>

            {/* PRACTITIONER KYC & AUTH STATUS BANNER */}
            {user ? (
              <div className="space-y-2">
                {isUserAdmin ? (
                  <div className="p-3 bg-red-600/10 border border-red-600/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-red-600/20 text-red-600 rounded-xl">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[11px] font-bold text-red-600 dark:text-red-400 block">
                          Medical Council Admin: {effectiveProfile.fullName}
                        </span>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 font-mono">
                          NMC Registry & Case Auditing Access • {user.email}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : profile?.kyc?.kycStatus === 'approved' ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-xl">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block">
                          Verified Doctor: {profile?.fullName || user.displayName || 'Practitioner'}
                        </span>
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 font-mono">
                          NMC: {profile?.kyc?.councilRegistration || profile?.councilRegistration || 'VERIFIED'} • Full App Access
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : profile?.kyc?.kycStatus === 'pending' ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          KYC Application Under Admin Review
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                    <p className="text-[9.5px] text-slate-600 dark:text-slate-300 leading-tight">
                      Registration <strong>{profile?.kyc?.councilRegistration || 'Submitted'}</strong> is awaiting Medical Board Admin verification. Once verified, you can use the rest of the app.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsVerificationGatekeeperOpen(true)}
                        className="text-[9.5px] font-bold text-amber-600 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Check Status / Admin Review →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                          First-Time Doctor: KYC Form Required
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                    <p className="text-[9.5px] text-slate-600 dark:text-slate-300 leading-tight">
                      Signed in as <strong>{user.email}</strong>. To access resuscitation tools, please fill out the Doctor KYC form. Once the admin verifies, you can use the rest of the app.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsKycModalOpen(true)}
                      className="text-[9.5px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                    >
                      Fill Doctor KYC Form Now →
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* PRIMARY ACCESS BUTTONS */}
            <div className="space-y-2.5 pt-1">
              {isUserAdmin ? (
                <>
                  <button 
                    id="start-admin-panel-btn"
                    onClick={() => {
                      vibrateDevice(80);
                      setIsAdminPanelOpen(true);
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-white" />
                        1. Open Medical Council Admin Board
                      </span>
                      <p className="text-[8.5px] text-white/90 font-normal">
                        Approve Doctor KYC applications, review practitioner licenses & audit clinical cases
                      </p>
                    </div>
                  </button>

                  <button 
                    id="start-admin-cpr-btn"
                    onClick={() => {
                      vibrateDevice(80);
                      setIsGuestMode(false);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        2. Begin CPR Resuscitation Session (Admin Access)
                      </span>
                      <p className="text-[8.5px] text-white/90 font-normal">
                        Full Resuscitation Registry, Defib Joules, Case Logging, Drugs & Digital Signature
                      </p>
                    </div>
                  </button>

                  <button 
                    id="start-guest-mode-btn"
                    onClick={() => {
                      vibrateDevice(60);
                      setIsGuestMode(true);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-white" />
                        3. Guest Mode (Limited Access Only)
                      </span>
                    </div>
                  </button>
                </>
              ) : !user ? (
                <>
                  <button 
                    id="start-full-access-btn"
                    onClick={() => {
                      vibrateDevice(80);
                      setIsGuestMode(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-white" />
                        1. Doctor Sign In & Verification
                      </span>
                      <p className="text-[8.5px] text-white/90 font-normal">
                        Sign in with email/password. First-time doctors complete KYC for admin verification.
                      </p>
                    </div>
                  </button>

                  <button 
                    id="start-guest-mode-btn"
                    onClick={() => {
                      vibrateDevice(60);
                      setIsGuestMode(true);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-white" />
                        2. Guest Mode (Limited Access Only)
                      </span>
                    </div>
                  </button>
                </>
              ) : profile?.kyc?.kycStatus === 'approved' ? (
                <>
                  <button 
                    id="start-full-access-btn"
                    onClick={() => {
                      vibrateDevice(80);
                      setIsGuestMode(false);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        1. Start Resuscitation Session (Verified Doctor)
                      </span>
                      <p className="text-[8.5px] text-white/90 font-normal">
                        Full Resuscitation Registry, Defib Joules, Case Logging, Drugs & Digital Signature
                      </p>
                    </div>
                  </button>

                  <button 
                    id="start-guest-mode-btn"
                    onClick={() => {
                      vibrateDevice(60);
                      setIsGuestMode(true);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-white" />
                        2. Guest Mode (Limited Access Only)
                      </span>
                    </div>
                  </button>
                </>
              ) : profile?.kyc?.kycStatus === 'pending' ? (
                <>
                  <button 
                    id="start-full-access-btn"
                    onClick={() => {
                      vibrateDevice(80);
                      setIsVerificationGatekeeperOpen(true);
                    }}
                    className="w-full p-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-white" />
                        1. KYC Pending Admin Verification (Check Status)
                      </span>
                      <p className="text-[8.5px] text-white/90 font-normal">
                        License under review. Tap to check verification status or request admin approval.
                      </p>
                    </div>
                  </button>

                  <button 
                    id="start-guest-mode-btn"
                    onClick={() => {
                      vibrateDevice(60);
                      setIsGuestMode(true);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-white" />
                        2. Guest Mode (Limited Access Only)
                      </span>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    id="start-full-access-btn"
                    onClick={() => {
                      vibrateDevice(80);
                      setIsKycModalOpen(true);
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-white" />
                        1. Fill Doctor KYC Form (Required)
                      </span>
                      <p className="text-[8.5px] text-white/90 font-normal">
                        First-time user: Submit Medical Council registration & degree for admin verification.
                      </p>
                    </div>
                  </button>

                  <button 
                    id="start-guest-mode-btn"
                    onClick={() => {
                      vibrateDevice(60);
                      setIsGuestMode(true);
                      setActiveTab('timer');
                      handleStartCPR();
                    }}
                    className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-white" />
                        2. Guest Mode (Limited Access Only)
                      </span>
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* MANDATORY CLINICAL DISCLAIMER & COPYRIGHT FOOTER */}
            <div className="pt-3 border-t border-inherit text-center space-y-2">
              <p className={`text-[9.5px] font-medium leading-relaxed rounded-xl p-3 shadow-sm ${
                isDark 
                  ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20' 
                  : 'text-amber-900 bg-amber-50 border border-amber-200'
              }`}>
                This app has not been validated clinically as a tool. It is intended to use for academic purpose. Please use cautiously.
              </p>
              <div className="flex items-center justify-center gap-2">
                <p className={`text-[9.5px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Nepal ACLS Resuscitation Protocol • 2025 Standards
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (isUserAdmin) {
                      setIsAdminPanelOpen(true);
                    } else {
                      setIsAuthModalOpen(true);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 text-[10px] p-0.5 bg-transparent border-none cursor-pointer"
                  title="Admin Board"
                >
                  🛡️
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      );
    }

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
        handleAmiodarone={handleAmiodarone}
        handleLidocaine={handleLidocaine}
        handleRhythmSelect={handleRhythmSelect}
        addLog={addLog}
        effectiveProfile={effectiveProfile}
        handleStartCPR={handleStartCPR}
        hapticDuration={hapticDuration}
        setHapticDuration={setHapticDuration}
        hapticIntensity={hapticIntensity}
        setHapticIntensity={setHapticIntensity}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenKyc={() => setIsKycModalOpen(true)}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        onOpenAdminPasswordModal={() => (isUserAdmin ? setIsAdminPanelOpen(true) : setIsAuthModalOpen(true))}
        onSignOut={handleSignOut}
        savedCases={savedCases}
        onSaveCurrentCase={handleSaveCurrentCase}
        onDeleteCase={handleDeleteCase}
        isGuestMode={isGuestMode}
        theme={theme}
        setTheme={setTheme}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onForceSync={handleForceSync}
        onOpenCopilot={handleOpenCopilot}
      />
    );
  };

  // Global Dialog Overlay modals
  const renderGlobalPromptModals = () => {
    return (
      <AnimatePresence>
        {/* Prompts Overlay Modal */}
        {state.activePrompt && state.activePrompt !== 'EPI_DUE' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-md flex items-center justify-center p-6 select-none"
          >
            <motion.div 
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white text-black w-full max-w-sm p-6 text-center border border-gray-300 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {state.activePrompt === 'RHYTHM_CHECK' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 animate-pulse border border-red-300">
                    <Activity className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-black uppercase tracking-tight">Rhythm Evaluation Pause</h3>
                    <p className="text-gray-600 text-[9px] uppercase tracking-widest font-bold mt-1">Interrupted Chest Compressions (Max 10s)</p>
                  </div>

                  {/* Progress evaluation timer bar */}
                  <div className="space-y-1 pb-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold text-gray-700">
                      <span>EVALUATION INTERRUPTED</span>
                      <span className={state.rhythmCheckTimeLeft <= 3 ? 'text-red-600 font-bold animate-ping' : 'text-red-600'}>{state.rhythmCheckTimeLeft}s</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-red-600" animate={{ width: `${(state.rhythmCheckTimeLeft / 10) * 100}%` }} />
                    </div>
                    {state.rhythmCheckTimeLeft === 0 && (
                      <p className="text-[8px] text-red-600 uppercase font-black tracking-wider animate-pulse pt-0.5">⚠️ BREACH ALERT: RESUME CPR IMMEDIATELY</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => handleRhythmSelect('SHOCKABLE')}
                      className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-transform cursor-pointer border-none shadow-md"
                    >
                      VF / Pulseless VT
                    </button>
                    <button 
                      onClick={() => handleRhythmSelect('NON_SHOCKABLE')}
                      className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-transform cursor-pointer border-none shadow-md"
                    >
                      Asystole / PEA
                    </button>
                    {/* Not offered at the first rhythm check of an arrest */}
                    {(state.rhythmCheckCount ?? 0) >= 1 && (
                      <button 
                        onClick={handleRoscAtRhythmCheck}
                        className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-widest transition-transform cursor-pointer border-none shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" /> Confirm ROSC (Pulse Present)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {state.activePrompt === 'SHOCK_ADVISED' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 border border-red-300 shadow">
                    <Zap className="w-7 h-7 fill-current animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-red-600 uppercase tracking-tight">Shock Advised!</h3>
                    <p className="text-black text-xs font-black uppercase tracking-wider">CLEAR ALL STANDERS</p>
                  </div>
                  
                  <button 
                    onClick={handleShock}
                    className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest border-none shadow-md cursor-pointer"
                  >
                    DELIVER RESCUE SHOCK ({state.selectedEnergy}J)
                  </button>
                </div>
              )}

              {state.activePrompt === 'EPI_ADVISED' && (
                <div className="space-y-4">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 border border-red-300">
                    <Syringe className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black text-black uppercase tracking-tight">Non-Shockable protocol</h3>
                    <p className="text-gray-600 text-[9.5px] uppercase font-bold tracking-widest mt-1">Dispense drug & continue chest loops</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-2">
                    <button 
                      onClick={handleEpi}
                      className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[9.5px] tracking-widest border-none flex items-center justify-center gap-1 shadow-md cursor-pointer"
                    >
                      <Syringe className="w-3.5 h-3.5" /> Administer 1mg Epi
                    </button>
                    
                    <button 
                      onClick={handleBeginCpr}
                      className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[9.5px] tracking-widest cursor-pointer border-none"
                    >
                      Begin CPR
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
    <div className={`h-[100dvh] w-full font-sans antialiased flex flex-col overflow-hidden select-none ${
      theme === 'clinical-dark' ? 'bg-[#0b0f19] text-white' : 'bg-[#f8fafc] text-black'
    }`} id="acls-app-root">
      {/* Native Mobile App Bar */}
      <header className={`h-12 w-full px-3 sm:px-4 flex items-center justify-between z-50 select-none text-[9px] font-bold font-mono shrink-0 border-b pt-[env(safe-area-inset-top,0px)] transition-colors ${
        theme === 'clinical-dark' ? 'bg-[#0c111d] text-slate-300 border-white/10' : 'bg-white text-gray-800 border-gray-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2">
          {hasSessionStarted ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Return to home screen? Active resuscitation timer will keep tracking in background.")) {
                  setHasSessionStarted(false);
                }
              }}
              className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider py-1 px-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer border-none bg-transparent"
              title="Tap to return to Home"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="font-sans font-black tracking-tight text-[11px]">ACLS</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="font-sans font-black tracking-tight text-[11px]">ACLS 2025</span>
            </div>
          )}
          <span className="text-[7.5px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
            Nepal
          </span>
          {isVerifiedDoctor && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[7.5px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold">
              <CheckCircle2 className="w-2.5 h-2.5" /> Verified
            </span>
          )}
        </div>

        {/* Right Status info */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleOpenCopilot}
            className={`px-2 py-1 rounded-lg border text-[8px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-xs ${
              isVerifiedDoctor
                ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300'
            }`}
            title={
              isVerifiedDoctor
                ? "Open Gemini ACLS Resuscitation AI Co-Pilot (Verified Doctor)"
                : !user
                ? "AI Co-Pilot restricted to signed in, KYC-verified doctors. Click to Sign In."
                : "AI Co-Pilot restricted to KYC-verified doctors. Click to check verification."
            }
          >
            {isVerifiedDoctor ? (
              <Bot className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
            <span className="font-bold">AI</span>
            {!isVerifiedDoctor && (
              <span className="text-[7px] bg-amber-500/20 text-amber-800 dark:text-amber-200 px-1 py-0.2 rounded font-extrabold">
                KYC
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleForceSync}
            disabled={syncStatus === 'syncing'}
            className={`px-1.5 py-1 rounded-lg border text-[7.5px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
              syncStatus === 'synced'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : syncStatus === 'syncing'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse'
                : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20'
            }`}
            title="Cloud DB Sync"
          >
            <Database className="w-3 h-3 text-emerald-500" />
            <span className="hidden md:inline">
              {syncStatus === 'synced' ? 'SYNCED' : syncStatus === 'syncing' ? 'SYNC...' : 'OFFLINE'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'clinical-dark' ? 'medical-white' : 'clinical-dark')}
            className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-inherit"
            title="Toggle theme"
          >
            {theme === 'clinical-dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
          </button>
          <div className="flex items-center gap-1 font-mono text-[8.5px] opacity-75 pl-0.5">
            <span>🔋{batteryLevel}%</span>
            <span>{phoneTime}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative">
        {renderAppContent()}
      </div>

      {/* Global Modals for alarms, shocks and rhythms check evaluations */}
      {renderGlobalPromptModals()}

      {/* Auth, Doctor KYC, Admin Board, Admin Password Guard, & Verification Gatekeeper Modals */}
      <React.Suspense fallback={null}>
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          onSuccess={() => {
            setIsAuthModalOpen(false);
            setTimeout(() => {
              if (!profile?.kyc || profile.kyc.kycStatus === 'unsubmitted') {
                setIsKycModalOpen(true);
              } else if (profile.kyc.kycStatus === 'pending') {
                setIsVerificationGatekeeperOpen(true);
              }
            }, 300);
          }}
        />
        <DoctorKycModal 
          isOpen={isKycModalOpen} 
          onClose={() => setIsKycModalOpen(false)} 
          userProfile={profile} 
          onKycUpdated={(updatedProfile) => {
            if (updatedProfile) {
              setProfile(updatedProfile);
            }
            setIsKycModalOpen(false);
            setIsVerificationGatekeeperOpen(true);
          }}
        />
        <AdminKycPanel 
          isOpen={isAdminPanelOpen && isUserAdmin} 
          onClose={() => setIsAdminPanelOpen(false)} 
          currentUserEmail={user?.email || undefined} 
          onProfileApproved={(docId, updatedKyc) => {
            if (user?.uid === docId || !user) {
              setProfile(prev => prev ? ({
                ...prev,
                kyc: updatedKyc,
                councilRegistration: updatedKyc.councilRegistration || prev.councilRegistration
              }) : ({
                fullName: 'Dr. Practitioner',
                profession: 'doctor',
                councilRegistration: updatedKyc.councilRegistration || 'NMC-VERIFIED',
                kyc: updatedKyc
              }));
            }
          }}
        />
        <VerificationGatekeeperModal
          isOpen={isVerificationGatekeeperOpen}
          onClose={() => setIsVerificationGatekeeperOpen(false)}
          onOpenAuth={() => {
            setIsVerificationGatekeeperOpen(false);
            setIsAuthModalOpen(true);
          }}
          onOpenKyc={() => {
            setIsVerificationGatekeeperOpen(false);
            setIsKycModalOpen(true);
          }}
          onOpenAdmin={() => {
            setIsVerificationGatekeeperOpen(false);
            if (isUserAdmin) {
              setIsAdminPanelOpen(true);
            } else {
              setIsAuthModalOpen(true);
            }
          }}
          user={user}
          userProfile={profile}
        />
      </React.Suspense>

      {/* Gemini AI ACLS Resuscitation Co-Pilot & Google Search Grounding */}
      <GeminiResusCopilot
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        theme={theme}
        isVerifiedDoctor={isVerifiedDoctor}
        isUserSignedIn={Boolean(user)}
        userEmail={user?.email || undefined}
        kycStatus={profile?.kyc?.kycStatus}
        onOpenAuth={() => {
          setIsCopilotOpen(false);
          setIsAuthModalOpen(true);
        }}
        onOpenKyc={() => {
          setIsCopilotOpen(false);
          setIsKycModalOpen(true);
        }}
        onOpenVerificationGatekeeper={() => {
          setIsCopilotOpen(false);
          setIsVerificationGatekeeperOpen(true);
        }}
        currentAclsState={{
          cprCycleCount: state.cprCycleCount,
          shocksCount: state.shocksCount,
          epiCount: state.epiCount,
          totalTime: state.totalTime,
          currentRhythm: state.currentRhythm
        }}
      />
    </div>
  );
}
