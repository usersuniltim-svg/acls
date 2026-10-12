import type { ReversibleCauseId } from './types';

export const CPR_CYCLE_DURATION = 120; // 2 minutes
export const EPI_INTERVAL = 180; // 3 minutes minimum (AHA 3-5 min)

export const HS_AND_TS: { id: ReversibleCauseId; term: string; description: string }[] = [
  { id: 'HYPOVOLEMIA', term: 'Hypovolemia', description: 'Low blood volume' },
  { id: 'HYPOXIA', term: 'Hypoxia', description: 'Low oxygen levels' },
  { id: 'ACIDOSIS', term: 'Hydrogen ion (Acidosis)', description: 'Low blood pH' },
  { id: 'POTASSIUM', term: 'Hypo-/Hyperkalemia', description: 'Potassium imbalance' },
  { id: 'HYPOTHERMIA', term: 'Hypothermia', description: 'Body temp < 35°C' },
  { id: 'TENSION_PNEUMOTHORAX', term: 'Tension Pneumothorax', description: 'Collapsed lung/air pressure' },
  { id: 'TAMPONADE', term: 'Tamponade, Cardiac', description: 'Fluid in heart sac' },
  { id: 'TOXINS', term: 'Toxins', description: 'Accidental/intentional overdose' },
  { id: 'PULMONARY_THROMBOSIS', term: 'Thrombosis, Pulmonary', description: 'Pulmonary embolism' },
  { id: 'CORONARY_THROMBOSIS', term: 'Thrombosis, Coronary', description: 'Myocardial infarction' },
];

// The algorithm steps live in lib/arrestAlgorithm.ts (2025 AHA boxes 1 to 12).
