import { LucideIcon } from 'lucide-react';

export type EventType = 'CPR_START' | 'SHOCK' | 'DRUG_EPI' | 'DRUG_AMIO' | 'DRUG_LIDO' | 'ROSC' | 'RHYTHM_CHECK' | 'ADVANCED_AIRWAY' | 'INFO';

export interface LogEvent {
  id: string;
  timestamp: number;
  type: EventType;
  description: string;
}

export type PatientRhythm = 'SHOCKABLE' | 'NON_SHOCKABLE' | 'UNKNOWN';

export interface AclsState {
  isTimerRunning: boolean;
  cprTimeLeft: number; // seconds
  epiTimeLeft: number; // seconds
  totalTime: number; // seconds
  shocksCount: number;
  epiCount: number;
  currentRhythm: PatientRhythm;
  cprCycleCount: number;
  logs: LogEvent[];
  showHsAndTs: boolean;
  activePrompt: 'RHYTHM_CHECK' | 'SHOCK_ADVISED' | 'EPI_ADVISED' | 'EPI_DUE' | null;
  rhythmCheckTimeLeft: number;
  defibType: 'BIPHASIC' | 'MONOPHASIC';
  selectedEnergy: number;
  epiDueElapsed?: number;

  // --- Real-clock anchors (epoch ms). All timers above are recalculated from
  // these, so a locked or dimmed phone can never slow the clock down. ---
  /** When the current code started; null when no code is running. */
  codeStartedAt?: number | null;
  /** When ROSC was confirmed; null while the patient is in arrest. */
  roscAt?: number | null;
  /** Time spent in ROSC before a re-arrest (not counted as arrest time). */
  roscPausedMs?: number;
  /** When the current 2-minute CPR cycle ends (while compressions are running). */
  cprEndsAt?: number | null;
  /** Time left in the CPR cycle while it is on hold. */
  cprRemainingMs?: number;
  /** When the current rhythm-check pause began. */
  rhythmCheckStartedAt?: number | null;
  /** Last epinephrine dose (or code start): the 3-5 min interval is timed from here. */
  epiAnchorAt?: number | null;
  /** Rhythm checks completed since the arrest (or re-arrest) began. */
  rhythmCheckCount?: number;
  amioCount?: number;
  lidoCount?: number;
  /** Sound to play; `seq` changes each time a new alert is raised. */
  alert?: { seq: number; kind: 'cycleEnd' | 'urgent' | 'epi' } | null;
}

export type KycStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';

export interface DoctorKyc {
  councilRegistration: string;
  degree: string;
  specialty: string;
  institution: string;
  idCardNumber?: string;
  kycStatus: KycStatus;
  submittedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface SavedCase {
  id: string;
  patientCode: string;
  savedAt: number;
  totalDuration: number;
  cprCycleCount: number;
  shocksCount: number;
  epiCount: number;
  logs: LogEvent[];
  certifiedBy: string;
  councilRegistration: string;
  signatureDataUrl?: string;
}

export interface GroundingChunk {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
  modelUsed?: string;
  isSearching?: boolean;
}

export type CopilotRole = 
  | 'acls_expert'
  | 'toxicology_hs_ts'
  | 'pals_pediatric'
  | 'post_rosc_care';

export interface UserProfile {
  uid?: string;
  fullName: string;
  profession: 'doctor' | 'nurse' | 'paramedics' | 'student';
  highestDegree: string;
  dob: string;
  sex: 'male' | 'female' | 'other';
  councilRegistration: string;
  email: string;
  phone: string;
  onboardedAt: any; // Firestore Timestamp
  isAdmin?: boolean;
  kyc?: DoctorKyc;
  savedCases?: SavedCase[];
}


