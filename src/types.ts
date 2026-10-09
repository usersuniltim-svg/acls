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
  | 'REVERSIBLE_CAUSE'
  | 'POST_ROSC_CHECK'
  | 'VITALS'
  | 'DISPOSITION'
  | 'AIRWAY'
  | 'ETCO2'
  | 'PROCEDURE'
  | 'INFO';

export type ClinicalEventSource = 'user' | 'system' | 'import';

export interface CodeStartPayload extends EpisodeScopedPayload {
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
  /** Total arrest time of the code so far (all episodes, time in ROSC excluded). */
  arrestDurationSeconds: number;
  /** Arrest time of the episode this ROSC ends. */
  episodeArrestSeconds?: number;
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

/** The AHA reversible causes of cardiac arrest (H's and T's). */
export type ReversibleCauseId =
  | 'HYPOVOLEMIA'
  | 'HYPOXIA'
  | 'ACIDOSIS'
  | 'POTASSIUM'
  | 'HYPOTHERMIA'
  | 'TENSION_PNEUMOTHORAX'
  | 'TAMPONADE'
  | 'TOXINS'
  | 'PULMONARY_THROMBOSIS'
  | 'CORONARY_THROMBOSIS';

export type ReversibleCauseStatus = 'SUSPECTED' | 'TREATED' | 'RULED_OUT';

/** One assessment of one reversible cause, attributed to the arrest episode it was made in. */
export interface ReversibleCausePayload extends EpisodeScopedPayload {
  cause: ReversibleCauseId;
  status: ReversibleCauseStatus;
  /** What was done or found, e.g. "needle decompression", "K+ 7.1". */
  note?: string;
}

/** Items of the 2025 AHA Adult Post-Cardiac Arrest Care Algorithm. */
export type PostRoscItemId =
  | 'AIRWAY'
  | 'OXYGENATION'
  | 'VENTILATION'
  | 'MAP'
  | 'ECG_12_LEAD'
  | 'IMAGING'
  | 'CAUSE_TREATMENT'
  | 'FOLLOWS_COMMANDS'
  | 'TEMPERATURE_CONTROL'
  | 'EEG'
  | 'GLUCOSE';

/** A post-ROSC checklist item marked done (or un-marked) after ROSC. */
export interface PostRoscCheckPayload extends EpisodeScopedPayload {
  item: PostRoscItemId;
  done: boolean;
  /** For items with an answer: ECG 'STEMI' | 'NO_STEMI'; commands 'YES' | 'NO_OR_UNSURE'. */
  result?: string;
}

/** Vital signs entered by the clinician after ROSC; flags list values outside AHA targets. */
export interface VitalsPayload extends EpisodeScopedPayload {
  phase: 'POST_ROSC';
  sbp?: number;
  dbp?: number;
  /** mm Hg; calculated from SBP/DBP when not entered (mapIsCalculated). */
  map?: number;
  mapIsCalculated?: boolean;
  hr?: number;
  spo2?: number;
  paco2?: number;
  etco2?: number;
  tempC?: number;
  glucoseMgDl?: number;
  flags: string[];
}

export type DispositionDestination = 'CATH_LAB' | 'ICU' | 'TRANSFER' | 'DIED' | 'OTHER';

/** Where the patient went after ROSC. Closes the case. */
export interface DispositionPayload extends EpisodeScopedPayload {
  destination: DispositionDestination;
  note?: string;
  roscDurationSeconds: number;
}

export type AdvancedAirwayDevice = 'ETT' | 'SGA';

/** Advanced airway placed, or its placement confirmed by waveform capnography. */
export interface AirwayPayload extends EpisodeScopedPayload {
  device: AdvancedAirwayDevice;
  confirmation: 'WAVEFORM_CAPNOGRAPHY' | 'CLINICAL_ONLY';
  /** True when this event only adds capnography confirmation to an airway already recorded. */
  confirmationOnly?: boolean;
}

/** One end-tidal CO2 reading during CPR; flags say what it may mean (2025 AHA). */
export interface Etco2Payload extends EpisodeScopedPayload {
  valueMmHg: number;
  airway: AdvancedAirwayDevice | 'NONE';
  flags: string[];
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
  REVERSIBLE_CAUSE: ReversibleCausePayload;
  POST_ROSC_CHECK: PostRoscCheckPayload;
  VITALS: VitalsPayload;
  DISPOSITION: DispositionPayload;
  AIRWAY: AirwayPayload;
  ETCO2: Etco2Payload;
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
  /** Total shocks across the full code, including prior arrest episodes. */
  shocksCount: number;
  /** Shocks delivered in the current arrest episode; resets after ROSC/re-arrest. */
  episodeShocksCount?: number;
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
  /** When the current arrest episode began (code start, or the latest re-arrest). */
  arrestEpisodeStartedAt?: number | null;
  roscAt?: number | null;
  /** Resuscitation stopped without ROSC (time of death). The code is closed. */
  terminatedAt?: number | null;
  /** Highest clinical-event sequence already included in a saved case (0 = nothing saved yet). */
  savedEventSequence?: number;
  /** Seconds since ROSC (live while in ROSC, frozen at disposition). */
  roscElapsedSeconds?: number;
  /** Patient handed over / left after ROSC. The case is closed. */
  dispositionAt?: number | null;
  disposition?: DispositionDestination | null;
  /** Advanced airway in place for this code (kept across ROSC and re-arrest). */
  advancedAirway?: { device: AdvancedAirwayDevice; at: number; confirmedByCapnography: boolean } | null;
  /** Energy and waveform of the last shock delivered in this code. */
  lastShockEnergyJ?: number | null;
  lastShockDefibType?: 'BIPHASIC' | 'MONOPHASIC' | null;
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
  /** Last recorded status of each reversible cause, per arrest episode. */
  reversibleCauses?: { arrestEpisodeNumber: number; cause: ReversibleCauseId; status: ReversibleCauseStatus; at: number; note?: string }[];
  /** Post-ROSC checklist items done at the end of the record (after the last ROSC). */
  postRoscChecklistDone?: PostRoscItemId[];
  /** Seconds from the ROSC to the first 12-lead ECG after it. */
  timeFromRoscTo12LeadSeconds?: number | null;
  postRoscVitalsCount?: number;
  /** Post-ROSC vitals entries with at least one value outside the AHA targets. */
  postRoscVitalsOutsideTargetCount?: number;
  disposition?: DispositionDestination | null;
  dispositionAt?: number | null;
  /** Energy of each shock, in order (J). */
  shockEnergiesJ?: number[];
  advancedAirwayDevice?: AdvancedAirwayDevice | null;
  timeToAdvancedAirwaySeconds?: number | null;
  airwayConfirmedByCapnography?: boolean | null;
  etco2ReadingCount?: number;
  maxEtco2DuringCprMmHg?: number | null;
  /** Each arrest episode rebuilt from the timeline: duration, shocks, drugs, how it ended. */
  episodes?: ArrestEpisodeSummary[];
  /**
   * Real-time seconds between consecutive epinephrine doses within the same
   * arrest episode. The gap across a ROSC is not an interval and is left out.
   */
  epinephrineIntervalsSeconds?: number[];
  /** Seconds from the start of the code to the first recorded IV/IO access. */
  timeToVascularAccessSeconds?: number | null;
}

export interface ArrestEpisodeSummary {
  episode: number;
  startAt: number;
  /** When the episode ended (ROSC or resuscitation stopped); null if still open. */
  endAt: number | null;
  endedBy: 'ROSC' | 'CODE_END' | null;
  durationSeconds: number | null;
  shocks: number;
  epinephrineDoses: number;
  amiodaroneDoses: number;
  lidocaineDoses: number;
  rhythmChecks: number;
  /** Seconds from the start of this episode to its first epinephrine dose. */
  firstEpinephrineAfterSeconds: number | null;
  /** Seconds between consecutive epinephrine doses within this episode. */
  epinephrineIntervalsSeconds: number[];
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
