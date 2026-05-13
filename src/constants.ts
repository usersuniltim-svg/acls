export const CPR_CYCLE_DURATION = 120; // 2 minutes
export const EPI_INTERVAL = 180; // 3 minutes minimum (AHA 3-5 min)

export const HS_AND_TS = [
  { term: 'Hypovolemia', description: 'Low blood volume' },
  { term: 'Hypoxia', description: 'Low oxygen levels' },
  { term: 'Hydrogen ion (Acidosis)', description: 'Low blood pH' },
  { term: 'Hypo-/Hyperkalemia', description: 'Potassium imbalance' },
  { term: 'Hypothermia', description: 'Body temp < 35°C' },
  { term: 'Tension Pneumothorax', description: 'Collapsed lung/air pressure' },
  { term: 'Tamponade, Cardiac', description: 'Fluid in heart sac' },
  { term: 'Toxins', description: 'Accidental/intentional overdose' },
  { term: 'Thrombosis, Pulmonary', description: 'Pulmonary embolism' },
  { term: 'Thrombosis, Coronary', description: 'Myocardial infarction' },
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
