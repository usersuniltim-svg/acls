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
}

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
