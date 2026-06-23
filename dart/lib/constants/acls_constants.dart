class CauseItem {
  final String term;
  final String description;

  const CauseItem({required this.term, required this.description});
}

class AclsConstants {
  static const int cprCycleDuration = 120; // 2 minutes in seconds
  static const int epiInterval = 180; // 3 minutes in seconds

  static const List<CauseItem> hAndTs = [
    CauseItem(term: 'Hypovolemia', description: 'Low blood volume'),
    CauseItem(term: 'Hypoxia', description: 'Low oxygen levels'),
    CauseItem(term: 'Hydrogen ion (Acidosis)', description: 'Low blood pH'),
    CauseItem(term: 'Hypo-/Hyperkalemia', description: 'Potassium imbalance'),
    CauseItem(term: 'Hypothermia', description: 'Body temp < 35°C'),
    CauseItem(term: 'Tension Pneumothorax', description: 'Collapsed lung/air pressure'),
    CauseItem(term: 'Tamponade, Cardiac', description: 'Fluid in heart sac'),
    CauseItem(term: 'Toxins', description: 'Accidental/intentional overdose'),
    CauseItem(term: 'Thrombosis, Pulmonary', description: 'Pulmonary embolism'),
    CauseItem(term: 'Thrombosis, Coronary', description: 'Myocardial infarction'),
  ];

  static const Map<String, List<String>> stepInstructions = {
    'SHOCKABLE': [
      'Shock Given. Resume CPR immediately.',
      'CPR 2 min. Obtain IV/IO access.',
      'Rhythm check. If Shockable: Shock + Resume CPR.',
      'CPR 2 min. Epinephrine 1mg every 3-5 min.',
      'Rhythm check. If Shockable: Shock + Resume CPR. Amiodarone 300mg bolus.',
    ],
    'NON_SHOCKABLE': [
      'Epinephrine ASAP. Resume CPR.',
      'CPR 2 min. Obtain IV/IO access.',
      'Epinephrine every 3-5 min. Consider advanced airway.',
      'Rhythm check. Treat reversible causes (H\'s & T\'s).',
    ]
  };
}
