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
  | 'CODE_END'
  | 'PROCEDURE'
  | 'INFO';

export type ClinicalEventSource = 'user' | 'system' | 'import';

export interface CodeStartPayload {
  reason?: string;
  initialRhythmAssessment?: boolean;
}

export interface EpisodeScopedPayload {
  /** Arrest episode this event belongs to. Episode 1 starts at CODE_START; each RE_ARREST increments it. */
  arrestEpisodeNumber?: number;
}

export interface CprStartPayload extends EpisodeScopedPayload {
  cycleNumber?: number;
}

export interface CprPausePayload extends EpisodeScopedPayload {
  cprCycle?: number;
  remainingSeconds?: number;
}

export interface CprResumePayload extends EpisodeScopedPayload {
  cprCycle?: number;
}

export interface RhythmCheckPayload extends EpisodeScopedPayload {
  checkNumber: number;
  rhythm: PatientRhythm | 'ORGANIZED_WITH_PULSE';
  /** Timestamp when chest-compression interruption/rhythm assessment actually began. */
  startedAt?: number;
}

export interface ShockPayload extends EpisodeScopedPayload {
  energyJ: number;
  defibType: 'BIPHASIC' | 'MONOPHASIC';
  shockNumber: number;
  /** CPR cycle automatically started by the shock action, if applicable. */
  cprCycleNumber?: number;
  /** Set when the clinician recorded the shock outside the usual AHA sequence; says why it was flagged. */
  protocolNote?: string;
}

export interface MedicationPayload extends EpisodeScopedPayload {
  route: 'IV/IO';
  doseNumber: number;
  doseMg?: number;
  doseLabel?: string;
  maxDoses?: number;
  /** Set when the clinician recorded the dose outside the usual AHA sequence; says why it was flagged. */
  protocolNote?: string;
}

export interface RoscPayload extends EpisodeScopedPayload {
  arrestDurationSeconds: number;
  rhythmCheckNumber?: number;
}

export interface ReArrestPayload {
  /** Episode being opened by this re-arrest. */
  arrestEpisodeNumber?: number;
  priorArrestSeconds: number;
  /** CPR cycle automatically started by the re-arrest action, if applicable. */
  cprCycleNumber?: number;
}

/** Resuscitation stopped without ROSC (termination of resuscitation). */
export interface CodeEndPayload extends EpisodeScopedPayload {
  outcome: 'TERMINATED';
  /** Time of death as recorded by the clinician (the moment they stopped). */
  timeOfDeath: number;
  arrestDurationSeconds: number;
}

export interface ProcedurePayload extends EpisodeScopedPayload {
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
  CODE_END: CodeEndPayload;
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
  /** 1-based arrest episode number for the currently active/last episode. */
  arrestEpisodeNumber?: number;
  roscAt?: number | null;
  /** Resuscitation stopped without ROSC (time of death). The code is closed. */
  terminatedAt?: number | null;
  /** Highest clinical-event sequence already included in a saved case (0 = nothing saved yet). */
  savedEventSequence?: number;
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

  /** Display only, never stored in Firestore: saved on this device, not uploaded yet. */
  syncPending?: boolean;
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
  finalRoscAt: number | null;
  roscCount: number;
  arrestEpisodeDurationsSeconds: number[];
  /** 1-based arrest episode IDs represented in the timeline, in chronological order. */
  arrestEpisodeNumbers?: number[];
  totalArrestDurationSeconds: number | null;
  /** Backward-compatible alias for totalArrestDurationSeconds. */
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
  /** How the code ended. Optional so metrics saved by older versions stay valid. */
  outcome?: 'ROSC' | 'TERMINATED' | 'NOT_DOCUMENTED';
  /** When resuscitation was stopped without ROSC (time of death), if it was. */
  codeEndAt?: number | null;
  /** Actions the clinician recorded outside the usual AHA sequence (each flagged in the log). */
  protocolDeviationCount?: number;
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
