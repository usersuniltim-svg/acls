/**
 * Post-ROSC care, following the 2025 AHA Adult Post-Cardiac Arrest Care
 * Algorithm (Part 11, Post-Cardiac Arrest Care, Circulation 2025).
 *
 * Targets used here (2025 AHA):
 *  - SpO2 90-98% (PaO2 60-105 mm Hg); 100% FiO2 until SpO2 is reliable
 *  - PaCO2 35-45 mm Hg
 *  - MAP >= 65 mm Hg
 *  - Not following commands: temperature control 32-37.5 C for >= 36 h, EEG
 *  - Avoid hypoglycaemia (< 70 mg/dL)
 *
 * Pure functions only, so they can be tested without a browser.
 */
import type { ClinicalEvent, PostRoscItemId, VitalsPayload } from '../types';

export interface PostRoscItem {
  id: PostRoscItemId;
  label: string;
  detail: string;
  /** Algorithm phase, for grouping on screen and in the report. */
  phase: 'Initial stabilization' | 'Continued management' | 'Not following commands';
  /** Items that record an answer instead of a simple "done". */
  results?: { value: string; label: string }[];
}

export const POST_ROSC_ITEMS: PostRoscItem[] = [
  { id: 'AIRWAY', phase: 'Initial stabilization', label: 'Airway secured, placement confirmed', detail: 'Place or exchange an advanced airway as needed; confirm placement.' },
  { id: 'OXYGENATION', phase: 'Initial stabilization', label: 'SpO2 90-98%', detail: '100% FiO2 until SpO2/PaO2 is reliable, then titrate (PaO2 60-105 mm Hg).' },
  { id: 'VENTILATION', phase: 'Initial stabilization', label: 'PaCO2 35-45 mm Hg', detail: 'Normal ventilation.' },
  { id: 'MAP', phase: 'Initial stabilization', label: 'MAP 65 mm Hg or higher', detail: 'Fluids and vasopressors as needed.' },
  {
    id: 'ECG_12_LEAD', phase: 'Initial stabilization', label: '12-lead ECG', detail: 'STEMI with suspected cardiac cause: emergent coronary angiography.',
    results: [{ value: 'STEMI', label: 'STEMI' }, { value: 'NO_STEMI', label: 'No STEMI' }],
  },
  { id: 'IMAGING', phase: 'Initial stabilization', label: 'CT and/or ultrasound considered', detail: 'To find the cause and complications.' },
  { id: 'CAUSE_TREATMENT', phase: 'Continued management', label: 'Cause and complications treated', detail: 'Consider emergent coronary angiography and mechanical circulatory support.' },
  { id: 'GLUCOSE', phase: 'Continued management', label: 'Glucose checked', detail: 'Avoid hypoglycemia (< 70 mg/dL) and hyperglycemia.' },
  {
    id: 'FOLLOWS_COMMANDS', phase: 'Continued management', label: 'Follows commands?', detail: 'Assess off sedation / paralysis if feasible.',
    results: [{ value: 'YES', label: 'Yes' }, { value: 'NO_OR_UNSURE', label: 'No / unsure' }],
  },
  { id: 'TEMPERATURE_CONTROL', phase: 'Not following commands', label: 'Temperature control 32-37.5 °C', detail: 'Deliberate strategy, maintained for at least 36 hours.' },
  { id: 'EEG', phase: 'Not following commands', label: 'EEG for seizures', detail: 'Prompt EEG in patients not following commands.' },
];

export function postRoscItemLabel(id: PostRoscItemId): string {
  return POST_ROSC_ITEMS.find(i => i.id === id)?.label ?? id;
}

export function postRoscResultLabel(id: PostRoscItemId, result?: string): string | undefined {
  if (!result) return undefined;
  return POST_ROSC_ITEMS.find(i => i.id === id)?.results?.find(r => r.value === result)?.label ?? result;
}

export interface ChecklistEntry {
  done: boolean;
  at: number;
  result?: string;
}

type CheckEvent = Extract<ClinicalEvent, { kind: 'POST_ROSC_CHECK' }>;

/** Current state of each checklist item, from events at or after `since` (the ROSC time). */
export function postRoscChecklist(
  events: ClinicalEvent[] | undefined,
  since: number,
): Partial<Record<PostRoscItemId, ChecklistEntry>> {
  const state: Partial<Record<PostRoscItemId, ChecklistEntry>> = {};
  (events ?? [])
    .filter((e): e is CheckEvent => e.kind === 'POST_ROSC_CHECK' && e.timestamp >= since)
    .sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp)
    .forEach(e => {
      state[e.payload.item] = { done: e.payload.done, at: e.timestamp, ...(e.payload.result ? { result: e.payload.result } : {}) };
    });
  return state;
}

/** MAP from systolic and diastolic pressure: (SBP + 2 x DBP) / 3, rounded. */
export function meanArterialPressure(sbp: number, dbp: number): number {
  return Math.round((sbp + 2 * dbp) / 3);
}

export type VitalsInput = Omit<VitalsPayload, 'phase' | 'flags' | 'mapIsCalculated' | 'arrestEpisodeNumber'>;

/** Fill in MAP from SBP/DBP when it was not entered. */
export function completeVitals(input: VitalsInput): VitalsInput & { mapIsCalculated?: boolean } {
  if (input.map == null && input.sbp != null && input.dbp != null) {
    return { ...input, map: meanArterialPressure(input.sbp, input.dbp), mapIsCalculated: true };
  }
  return input;
}

/** Values outside the 2025 AHA post-ROSC targets, in plain language. */
export function assessPostRoscVitals(v: VitalsInput): string[] {
  const flags: string[] = [];
  const map = v.map ?? (v.sbp != null && v.dbp != null ? meanArterialPressure(v.sbp, v.dbp) : undefined);
  if (map != null && map < 65) flags.push(`MAP ${map} mm Hg is below the 65 mm Hg target`);
  if (v.spo2 != null && v.spo2 < 90) flags.push(`SpO2 ${v.spo2}% is below the 90-98% target`);
  if (v.spo2 != null && v.spo2 > 98) flags.push(`SpO2 ${v.spo2}% is above the 90-98% target (titrate FiO2 down)`);
  if (v.paco2 != null && (v.paco2 < 35 || v.paco2 > 45)) flags.push(`PaCO2 ${v.paco2} mm Hg is outside the 35-45 mm Hg target`);
  if (v.tempC != null && v.tempC > 37.5) flags.push(`Temperature ${v.tempC} °C is above 37.5 °C (prevent fever)`);
  if (v.tempC != null && v.tempC < 32) flags.push(`Temperature ${v.tempC} °C is below 32 °C`);
  if (v.glucoseMgDl != null && v.glucoseMgDl < 70) flags.push(`Glucose ${v.glucoseMgDl} mg/dL is below 70 mg/dL`);
  return flags;
}

/** One-line summary of a vitals entry for the log. */
export function describeVitals(v: VitalsInput & { mapIsCalculated?: boolean }): string {
  const parts: string[] = [];
  if (v.sbp != null && v.dbp != null) parts.push(`BP ${v.sbp}/${v.dbp}`);
  if (v.map != null) parts.push(`MAP ${v.map}${v.mapIsCalculated ? ' (calc)' : ''}`);
  if (v.hr != null) parts.push(`HR ${v.hr}`);
  if (v.spo2 != null) parts.push(`SpO2 ${v.spo2}%`);
  if (v.paco2 != null) parts.push(`PaCO2 ${v.paco2}`);
  if (v.etco2 != null) parts.push(`EtCO2 ${v.etco2}`);
  if (v.tempC != null) parts.push(`Temp ${v.tempC} °C`);
  if (v.glucoseMgDl != null) parts.push(`Glucose ${v.glucoseMgDl} mg/dL`);
  return parts.join(', ');
}

export const DISPOSITION_LABEL = {
  CATH_LAB: 'Cath lab',
  ICU: 'ICU',
  TRANSFER: 'Transfer to another facility',
  DIED: 'Died after ROSC',
  OTHER: 'Other',
} as const;
