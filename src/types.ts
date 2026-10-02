import { LucideIcon } from 'lucide-react';

export type EventType = 'CPR_START' | 'SHOCK' | 'DRUG_EPI' | 'DRUG_AMIO' | 'DRUG_LIDO' | 'ROSC' | 'RHYTHM_CHECK' | 'ADVANCED_AIRWAY' | 'INFO';

export interface LogEvent {
  id: string;
  timestamp: number;
  type: EventType;
  description: string;
}

export type ClinicalEventKind =
  | 'CODE_START'
  | 'CPR_START'
  | 'CPR_PAUSE'
  | 'CPR_RESUME'
  | 'RHYTHM_CHECK'
  | 'SHOCK'
  | 'EPINEPHRINE'
  | 'AMIODARONE'
  | 'LIDOCAINE'
  | 'ROSC'
  | 'RE_ARREST'
  | 'PROCEDURE'
  | 'INFO';

export type ClinicalEventSource = 'user' | 'system' | 'import';

export interface CodeStartPayload {
  reason?: string;
  initialRhythmAssessment?: boolean;
}

export interface CprStartPayload {
  cycleNumber?: number;
}

export interface CprPausePayload {
  cprCycle?: number;
  remainingSeconds?: number;
}

export interface CprResumePayload {
  cprCycle?: number;
}

export interface RhythmCheckPayload {
  checkNumber: number;
  rhythm: PatientRhythm | 'ORGANIZED_WITH_PULSE';
  /** Timestamp when chest-compression interruption/rhythm assessment actually began. */
  startedAt?: number;
}

export interface ShockPayload {
  energyJ: number;
  defibType: 'BIPHASIC' | 'MONOPHASIC';
  shockNumber: number;
}

export interface MedicationPayload {
  route: 'IV/IO';
  doseNumber: number;
  doseMg?: number;
  doseLabel?: string;
  maxDoses?: number;
}

export interface RoscPayload {
  arrestDurationSeconds: number;
  rhythmCheckNumber?: number;
}

export interface ReArrestPayload {
  priorArrestSeconds: number;
}

export interface ProcedurePayload {
  procedure?: string;
  site?: string;
}

export interface ClinicalEventPayloadMap {
  CODE_START: CodeStartPayload;
  CPR_START: CprStartPayload;
  CPR_PAUSE: CprPausePayload;
  CPR_RESUME: CprResumePayload;
  RHYTHM_CHECK: RhythmCheckPayload;
  SHOCK: ShockPayload;
  EPINEPHRINE: MedicationPayload;
  AMIODARONE: MedicationPayload;
  LIDOCAINE: MedicationPayload;
  ROSC: RoscPayload;
  RE_ARREST: ReArrestPayload;
  PROCEDURE: ProcedurePayload;
  INFO: Record<string, unknown>;
}

export type ClinicalEventPayload =
  ClinicalEventPayloadMap[ClinicalEventKind];

export type ClinicalEvent = {
  [K in ClinicalEventKind]: {
    id: string;
    timestamp: number;
    sequence: number;
    kind: K;
    actorId?: string;
    actorName?: string;
    source: ClinicalEventSource;
    payload: ClinicalEventPayloadMap[K];
    /** Human-readable description retained for PDF/UI/backward compatibility. */
    description?: string;
  }
}[ClinicalEventKind];

export type ClinicalEventInput<K extends ClinicalEventKind = ClinicalEventKind> = {
  kind: K;
  timestamp?: number;
  actorId?: string;
  actorName?: string;
  source?: ClinicalEventSource;
  payload?: ClinicalEventPayloadMap[K];
  description?: string;
}

export type PatientRhythm = 'SHOCKABLE' | 'NON_SHOCKABLE' | 'UNKNOWN';

export interface AclsState {
  isTimerRunning: boolean;
  cprTimeLeft: number;
  epiTimeLeft: number;
  totalTime: number;
  shocksCount: number;
  epiCount: number;
  currentRhythm: PatientRhythm;
  cprCycleCount: number;
  logs: LogEvent[];
  clinicalEvents: ClinicalEvent[];
  showHsAndTs: boolean;
  activePrompt: 'RHYTHM_CHECK' | 'SHOCK_ADVISED' | 'EPI_ADVISED' | 'EPI_DUE' | null;
  rhythmCheckTimeLeft: number;
  defibType: 'BIPHASIC' | 'MONOPHASIC';
  selectedEnergy: number;
  epiDueElapsed?: number;

  codeStartedAt?: number | null;
  roscAt?: number | null;
  roscPausedMs?: number;
  cprEndsAt?: number | null;
  cprRemainingMs?: number;
  rhythmCheckStartedAt?: number | null;
  epiAnchorAt?: number | null;
  rhythmCheckCount?: number;
  amioCount?: number;
  lidoCount?: number;
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
  clinicalEvents?: ClinicalEvent[];
  metrics?: ResuscitationMetrics;
  certifiedBy: string;
  councilRegistration: string;
  signatureDataUrl?: string;

  // Storage/audit metadata. Optional so existing saved records remain readable.
  userId?: string;
  updatedAt?: number;
  recordVersion?: number;
  caseStorageVersion?: number;
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

export interface ResuscitationMetrics {
  codeStartAt: number | null;
  firstCprAt: number | null;
  firstRhythmCheckAt: number | null;
  firstShockAt: number | null;
  firstEpinephrineAt: number | null;
  roscAt: number | null;
  arrestDurationSeconds: number | null;
  timeToFirstCprSeconds: number | null;
  timeToFirstRhythmCheckSeconds: number | null;
  timeToFirstShockSeconds: number | null;
  timeToFirstEpinephrineSeconds: number | null;
  shockCount: number;
  epinephrineCount: number;
  amiodaroneCount: number;
  lidocaineCount: number;
  rhythmCheckCount: number;
  cprCycleCount: number;
  cprPauseCount: number;
  reArrestCount: number;
  shockableRhythmChecks: number;
  nonShockableRhythmChecks: number;
  medicationIntervalsSeconds: number[];
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
  onboardedAt: any;
  isAdmin?: boolean;
  kyc?: DoctorKyc;

  /** @deprecated Compatibility cache. Canonical records live in users/{uid}/cases. */
  savedCases?: SavedCase[];
}
