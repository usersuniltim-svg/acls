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
  Laptop,
  ShieldCheck,
  FileText,
  X,
  CheckCircle2,
  Printer,
  Sparkles,
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
} from './types';
import { 
  CPR_CYCLE_DURATION, 
  EPI_INTERVAL, 
} from './constants';
import { MedicalAudio } from './lib/audio';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import MobileDashboard from './components/MobileDashboard';
import DesktopDashboard from './components/DesktopDashboard';

const AuthModal = React.lazy(() => import('./components/AuthModal'));
const DoctorKycModal = React.lazy(() => import('./components/DoctorKycModal'));
const AdminKycPanel = React.lazy(() => import('./components/AdminKycPanel'));
const AdminPasswordModal = React.lazy(() => import('./components/AdminPasswordModal'));
const VerificationGatekeeperModal = React.lazy(() => import('./components/VerificationGatekeeperModal'));
const SavedCasesList = React.lazy(() => import('./components/SavedCasesList'));

function CprLogo({ className = "w-28 h-auto" }: { className?: string }) {
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
      {/* Black ECG Line */}
      <path
        d="M 5, 210 H 75 L 95, 140 L 115, 265 L 135, 75 L 160, 250 L 180, 185 L 195, 210 H 215"
        stroke="#000000"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rescuer Head */}
      <circle cx="300" cy="52" r="32" fill="#000000" />
      {/* Rescuer Torso & Arms */}
      <path
        d="M 252, 110 H 348 C 352, 110 355, 115 352, 125 L 320, 240 H 280 L 248, 125 C 245, 115 248, 110 252, 110 Z"
        fill="#000000"
      />
      {/* White V-Cut inside Rescuer Torso */}
      <path
        d="M 276, 110 L 300, 195 L 324, 110 Z"
        fill="#FFFFFF"
      />
      {/* Patient Head */}
      <circle cx="180" cy="270" r="32" fill="#000000" />
      {/* Patient Torso & Body Lying Down */}
      <rect
        x="210"
        y="238"
        width="240"
        height="64"
        rx="32"
        fill="#000000"
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
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [isVerificationGatekeeperOpen, setIsVerificationGatekeeperOpen] = useState(false);
  const [isLandingSavedCasesOpen, setIsLandingSavedCasesOpen] = useState(false);

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
      if (currentUser) {
        const profileDocRef = doc(db, 'profiles', currentUser.uid);
        profileUnsubscribeRef.current = onSnapshot(profileDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const pData = docSnap.data() as any;
            setProfile(pData as UserProfile);
            try {
              localStorage.setItem('acls_user_profile', JSON.stringify(pData));
              if (Array.isArray(pData.savedCases) && pData.savedCases.length > 0) {
                setSavedCases((prev) => {
                  const map = new Map<string, SavedCase>();
                  pData.savedCases.forEach((c: SavedCase) => map.set(c.id, c));
                  prev.forEach((c) => map.set(c.id, c));
                  const merged = Array.from(map.values()).slice(0, 3);
                  try {
                    localStorage.setItem('acls_saved_cases', JSON.stringify(merged));
                  } catch (e) {}
                  return merged;
                });
              }
            } catch (e) {}
            setLoading(false);
          } else {
            // Document doesn't exist in 'profiles' yet - check local cache or create default profile in Firestore
            let cachedProf: UserProfile | null = null;
            try {
              const local = localStorage.getItem('acls_user_profile');
              if (local) cachedProf = JSON.parse(local);
            } catch (e) {}

            const defaultProf: UserProfile = cachedProf || {
              fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Practitioner',
              email: currentUser.email || '',
              profession: 'doctor',
              highestDegree: 'MBBS',
              councilRegistration: '',
              dob: '1990-01-01',
              sex: 'male',
              phone: '',
              onboardedAt: Date.now(),
              kyc: {
                kycStatus: 'unsubmitted',
                councilRegistration: '',
                degree: 'MBBS',
                specialty: '',
                institution: ''
              }
            };

            setDoc(profileDocRef, defaultProf, { merge: true }).catch((e) => console.warn("Auto-create profile failed:", e));
            setProfile(defaultProf);
            try {
              localStorage.setItem('acls_user_profile', JSON.stringify(defaultProf));
            } catch (e) {}
            setLoading(false);
          }
        }, (err) => {
          console.error("Profile error:", err);
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

  const handleSignOut = async () => {
    try {
      MedicalAudio.stopAll();
      setState(prev => ({
        ...prev,
        isTimerRunning: false,
        activePrompt: null,
        rhythmCheckTimeLeft: 0,
      }));
      setHasSessionStarted(false);
      await signOut(auth);
      setUser(null);
      setProfile(null);
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
      const profRef = doc(db, 'profiles', user.uid);
      updateDoc(profRef, { savedCases: updated }).catch(() => {
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { savedCases: updated }).catch(() => {});
      });
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
      const profRef = doc(db, 'profiles', user.uid);
      updateDoc(profRef, { savedCases: updated }).catch(() => {
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { savedCases: updated }).catch(() => {});
      });
    }
  };

  const handleInstantDemoVerify = async () => {
    const verifiedKyc = {
      degree: profile?.highestDegree || "MBBS / MD Specialist",
      councilRegistration: profile?.councilRegistration || "NMC-8821",
      specialty: "Emergency & Resuscitation",
      institution: "Kathmandu Medical College",
      kycStatus: 'approved' as const,
      submittedAt: Date.now(),
      approvedAt: Date.now(),
    };

    if (user?.uid) {
      const profRef = doc(db, 'profiles', user.uid);
      await setDoc(profRef, { kyc: verifiedKyc, councilRegistration: verifiedKyc.councilRegistration }, { merge: true }).catch(() => {});
    }

    const updatedProf = {
      ...(profile || effectiveProfile),
      councilRegistration: verifiedKyc.councilRegistration,
      kyc: verifiedKyc
    };

    setProfile(updatedProf);
    try {
      localStorage.setItem('acls_user_profile', JSON.stringify(updatedProf));
    } catch (e) {}

    setIsVerificationGatekeeperOpen(false);
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

  const renderInMobileLayout = isMobileScreen;

  const renderAppContent = () => {
    if (!hasSessionStarted) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-white text-black overflow-y-auto" id="landing-screen">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white p-6 space-y-6 border border-gray-300 rounded-3xl shadow-xl my-auto text-black"
          >
            {/* CPR Logo Graphic */}
            <div className="mx-auto flex items-center justify-center">
              <CprLogo className="w-28 sm:w-32 h-auto max-h-24" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-2xl font-display font-bold tracking-tight">ACLS Companion</h1>
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'clinical-dark' ? 'medical-white' : 'clinical-dark')}
                  className="px-2.5 py-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Switch theme"
                >
                  {theme === 'clinical-dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>White Theme</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Dark Theme</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-red-600 text-[8.5px] uppercase tracking-widest font-mono font-bold">Practice & Live Monitor System • v3.0</p>
            </div>

            <p className="text-gray-700 text-[10px] leading-relaxed max-w-sm mx-auto font-medium">
              Please calibrate defibrillation joules. In case of active arrest code, click below immediately to activate resuscitation logs.
            </p>

            {/* PRIMARY ACCESS BUTTONS (RED BUTTONS) */}
            <div className="space-y-3 pt-2">
              {/* BUTTON 1: SIGN IN / FULL ACCESS */}
              <button 
                id="start-full-access-btn"
                onClick={() => {
                  vibrateDevice(80);
                  setIsGuestMode(false);
                  if (user) {
                    setActiveTab('timer');
                    handleStartCPR();
                  } else {
                    setIsAuthModalOpen(true);
                  }
                }}
                className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-between transition-all active:scale-95 shadow-md border-none cursor-pointer text-left"
              >
                <div className="space-y-0.5">
                  <span className="text-[11px] uppercase tracking-wider font-extrabold block text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-white" />
                    1. Sign In & Full Access
                  </span>
                  <p className="text-[8.5px] text-white/90 font-normal">
                    Full Resuscitation Registry, Case Logging, Digital Signature & Retrieval
                  </p>
                </div>
              </button>

              {/* BUTTON 2: GUEST MODE */}
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
            </div>

            {/* MODAL: LANDING SAVED CASES & LOGS */}
            {isLandingSavedCasesOpen && (
              <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
                <div className="w-full max-w-xl bg-white border border-gray-300 rounded-2xl p-5 relative max-h-[90vh] overflow-y-auto space-y-4 text-left shadow-2xl text-black">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                    <h3 className="text-sm font-bold uppercase text-black flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-600" />
                      Saved Resuscitation Registry Logs
                    </h3>
                    <button 
                      onClick={() => setIsLandingSavedCasesOpen(false)}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer border-none"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <SavedCasesList
                    savedCases={savedCases}
                    onSaveCurrentCase={handleSaveCurrentCase}
                    onDeleteCase={handleDeleteCase}
                    hasCurrentLogs={state.logs.length > 0}
                    practitionerName={effectiveProfile.fullName}
                    councilRegistration={effectiveProfile.councilRegistration}
                  />
                </div>
              </div>
            )}


            {/* MANDATORY CLINICAL DISCLAIMER & COPYRIGHT FOOTER */}
            <div className="pt-4 border-t border-white/10 text-center space-y-2">
              <p className="text-[10px] text-amber-300 font-medium leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 shadow-sm">
                This app has not been validated clinically as a tool. It is intended to use for academic purpose. Please use cautiously.
              </p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Copyright © Dr. Sunil Timilsina, MBBS
                </p>
                <button
                  type="button"
                  onClick={() => setIsAdminPasswordModalOpen(true)}
                  className="text-slate-600 hover:text-slate-400 text-[9px] p-0.5 bg-transparent border-none cursor-pointer"
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
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenKyc={() => setIsKycModalOpen(true)}
          onOpenAdmin={() => setIsAdminPanelOpen(true)}
          onOpenAdminPasswordModal={() => setIsAdminPasswordModalOpen(true)}
          onSignOut={handleSignOut}
          savedCases={savedCases}
          onSaveCurrentCase={handleSaveCurrentCase}
          onDeleteCase={handleDeleteCase}
          isGuestMode={isGuestMode}
          theme={theme}
          setTheme={setTheme}
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
          addLog={addLog}
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
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenKyc={() => setIsKycModalOpen(true)}
          onOpenAdmin={() => setIsAdminPanelOpen(true)}
          onOpenAdminPasswordModal={() => setIsAdminPasswordModalOpen(true)}
          onSignOut={handleSignOut}
          savedCases={savedCases}
          onSaveCurrentCase={handleSaveCurrentCase}
          onDeleteCase={handleDeleteCase}
          isGuestMode={isGuestMode}
          theme={theme}
          setTheme={setTheme}
        />
      );
    }
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
                      VF / pulseless VT (YES SHOCK)
                    </button>
                    <button 
                      onClick={() => handleRhythmSelect('NON_SHOCKABLE')}
                      className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-transform cursor-pointer border-none shadow-md"
                    >
                      Asystole / PEA (NO SHOCK)
                    </button>
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
                      onClick={() => {
                        addLog('CPR_START', `CPR Cycle #${state.cprCycleCount + 1} finalized & started`);
                        setState(prev => ({ 
                          ...prev, 
                          activePrompt: null, 
                          isTimerRunning: true,
                          cprCycleCount: prev.cprCycleCount + 1
                        }));
                      }}
                      className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[9.5px] tracking-widest cursor-pointer border-none"
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
    <div className="h-screen w-full bg-white text-black font-sans antialiased flex flex-col overflow-hidden" id="acls-app-root">
      {/* Top minimal status bar for quick time / session info */}
      <div className="h-7 w-full bg-gray-100 px-4 flex items-center justify-between z-50 select-none text-[9px] font-bold text-gray-800 font-mono shrink-0 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
          <span className="text-black font-bold uppercase tracking-wider">Resuscitation Command</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-700 font-sans hidden sm:inline">{effectiveProfile.fullName} ({effectiveProfile.profession.toUpperCase()})</span>
          <span>🔋 {batteryLevel}%</span>
          <span className="text-black font-sans ml-1 font-bold">{phoneTime}</span>
        </div>
      </div>

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
        />
        <DoctorKycModal 
          isOpen={isKycModalOpen} 
          onClose={() => setIsKycModalOpen(false)} 
          userProfile={profile} 
        />
        <AdminKycPanel 
          isOpen={isAdminPanelOpen} 
          onClose={() => setIsAdminPanelOpen(false)} 
          currentUserEmail={user?.email || undefined} 
        />
        <AdminPasswordModal
          isOpen={isAdminPasswordModalOpen}
          onClose={() => setIsAdminPasswordModalOpen(false)}
          onSuccess={() => {
            setIsAdminPasswordModalOpen(false);
            setIsAdminPanelOpen(true);
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
          onInstantDemoVerify={handleInstantDemoVerify}
          user={user}
          userProfile={profile}
        />
      </React.Suspense>
    </div>
  );
}
