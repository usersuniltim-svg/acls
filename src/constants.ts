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

export const STEP_INSTRUCTIONS = {
  SHOCKABLE: [
    'Shock Given. Resume CPR immediately.',
    'CPR 2 min. Obtain IV/IO access.',
    'Rhythm check. If Shockable: Shock + Resume CPR.',
    'CPR 2 min. Epinephrine 1mg every 3-5 min.',
    'Rhythm check. If Shockable: Shock + Resume CPR. Amiodarone 300mg bolus.',
  ],
  NON_SHOCKABLE: [
    'Epinephrine ASAP. Resume CPR.',
    'CPR 2 min. Obtain IV/IO access.',
    'Epinephrine every 3-5 min. Consider advanced airway.',
    'Rhythm check. Treat reversible causes (H\'s & T\'s).',
  ]
};
