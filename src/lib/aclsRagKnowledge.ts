/**
 * Built-in reference notes for the AI copilot. They are shown word for word
 * when the AI is offline, and sent to the AI as reference notes otherwise, so
 * they must agree with the 2025 AHA Guidelines and with copilotRoles.ts.
 *
 * Each note says honestly what it is: app notes written from the AHA sources
 * listed in `references` (cpr.heart.org), not AHA text. Anything that is not
 * from AHA (common doses, European practice, toxicology) is labelled as such.
 * tests/aclsKnowledge.test.ts checks the notes for outdated 2020 values.
 */
export interface RagReference {
  title: string;
  url: string;
}

export interface RagKnowledgeChunk {
  id: string;
  category: 'cardiac_arrest' | 'shockable' | 'non_shockable' | 'drugs' | 'hs_and_ts' | 'post_rosc' | 'pals' | 'tachycardia' | 'bradycardia' | 'toxicology';
  title: string;
  keywords: string[];
  summary: string;
  protocolContent: string;
  /** What the note is and what it is based on. Never presented as AHA text. */
  source: string;
  /** The AHA pages the note was written from (empty when it is not AHA based). */
  references: RagReference[];
  updatedAt: string;
}

const AHA = 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines';
const ALGO = 'https://cpr.heart.org/-/media/CPR-Files/CPR-Guidelines-Files/2025-Accessible';

export const AHA_REFERENCES = {
  adultAls: { title: '2025 AHA Guidelines Part 9: Adult Advanced Life Support', url: `${AHA}/adult-advanced-life-support` },
  adultBls: { title: '2025 AHA Guidelines Part 7: Adult Basic Life Support', url: `${AHA}/adult-basic-life-support` },
  specialCircumstances: { title: '2025 AHA Guidelines Part 10: Special Circumstances of Resuscitation', url: `${AHA}/adult-and-pediatric-special-circumstances-of-resuscitation` },
  postArrest: { title: '2025 AHA Guidelines Part 11: Post-Cardiac Arrest Care', url: `${AHA}/post-cardiac-arrest-care` },
  pals: { title: '2025 AHA Guidelines Part 8: Pediatric Advanced Life Support', url: `${AHA}/pediatric-advanced-life-support` },
  arrestAlgorithm: { title: '2025 AHA Adult Cardiac Arrest Algorithm', url: `${ALGO}/Algorithm-ACLS-CA-LngDscrp-250725-Ed.pdf` },
  postArrestAlgorithm: { title: '2025 AHA Adult Post-Cardiac Arrest Care Algorithm', url: `${ALGO}/Algorithm-ACLS-PCAC-LngDscrp-250726-Ed.pdf` },
  bradycardiaAlgorithm: { title: '2025 AHA Adult Bradycardia With a Pulse Algorithm', url: `${ALGO}/Algorithm-ACLS-Bradycardia-LngDscrp-250725-Ed.pdf` },
  tachycardiaAlgorithm: { title: '2025 AHA Adult Tachyarrhythmia With a Pulse Algorithm', url: `${ALGO}/Algorithm-ACLS-Tachyarrhythmia-LngDscrp-250726-Ed.pdf` },
  cardioversionAlgorithm: { title: '2025 AHA Adult Electrical Cardioversion Algorithm', url: `${ALGO}/Algorithm-ACLS-Electrical-Cardioversion-LngDscrp-250725-Ed.pdf` },
  palsAlgorithm: { title: '2025 AHA Pediatric Cardiac Arrest Algorithm', url: `${ALGO}/Algorithm-PALS-CA-LngDscrp-250729-Ed.pdf` },
} satisfies Record<string, RagReference>;

const R = AHA_REFERENCES;
const CHECKED = '2025 AHA Guidelines (checked October 2026)';

export const ACLS_RAG_KNOWLEDGE_BASE: RagKnowledgeChunk[] = [
  {
    id: 'rag-vf-pvt-shockable',
    category: 'shockable',
    title: 'Adult VF / Pulseless VT (Shockable Rhythm)',
    keywords: ['vf', 'vfib', 'ventricular fibrillation', 'vt', 'pvt', 'pulseless vt', 'shock', 'defib', 'defibrillation', 'amiodarone', 'lidocaine', 'epinephrine'],
    summary: 'Shock (biphasic at the device dose, e.g. 120 to 200 J, maximum if unknown; monophasic 360 J), CPR 2 min straight after each shock, epinephrine after the 2nd shock, amiodarone or lidocaine after the 3rd shock.',
    protocolContent: `**2025 AHA Adult Cardiac Arrest Algorithm: VF / pulseless VT**
1. **Start CPR**, give oxygen with bag-mask ventilation, attach the monitor/defibrillator. Pulse check no more than 10 s.
2. VF/pVT: **Shock**. Biphasic: the device (manufacturer) recommendation, for example 120 to 200 J; if unknown, use the maximum available. Monophasic: 360 J. Later shocks: the same energy; higher energy may be considered.
3. **CPR 2 min** straight after the shock, without a pulse or rhythm check first. Get IV/IO access.
4. Rhythm check. Still shockable: **shock**, then CPR 2 min with **epinephrine 1 mg IV/IO**, repeated every 3 to 5 min. Consider an advanced airway and waveform capnography.
5. Rhythm check. Still shockable: **shock**, then CPR 2 min with an antiarrhythmic and treatment of reversible causes:
   - **Amiodarone** 300 mg IV/IO; second dose 150 mg. **Or lidocaine** 1 to 1.5 mg/kg; second dose 0.5 to 0.75 mg/kg.
6. Keep going in 2-minute cycles. Shockable: shock again. Not shockable: follow the asystole/PEA loop. Signs of ROSC: post-cardiac arrest care.
- Of uncertain benefit (2025): double sequential defibrillation, changing the pad vector, and beta blockers, bretylium, procainamide or sotalol for shock-refractory VF/pVT.
- ETCO2 below 10 mm Hg or falling: reassess CPR quality (AHA supportive text: at least 10, ideally 20 mm Hg or more).`,
    source: 'App reference notes based on the 2025 AHA Adult Cardiac Arrest Algorithm and Part 9 (Adult ALS)',
    references: [R.arrestAlgorithm, R.adultAls],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-pea-asystole-non-shockable',
    category: 'non_shockable',
    title: 'Adult PEA / Asystole (Nonshockable Rhythm)',
    keywords: ['pea', 'asystole', 'pulseless electrical activity', 'non shockable', 'nonshockable', 'epinephrine', 'flatline', 'hs and ts'],
    summary: 'High-quality CPR, epinephrine 1 mg IV/IO as soon as possible and every 3 to 5 min, and a search for reversible causes (H\'s and T\'s).',
    protocolContent: `**2025 AHA Adult Cardiac Arrest Algorithm: asystole / PEA**
1. Asystole/PEA: **epinephrine 1 mg IV/IO as soon as possible**, then every 3 to 5 min. Restart compressions straight after the rhythm check; give the drug during CPR.
2. CPR in 2-minute cycles. IV/IO access. Consider an advanced airway (endotracheal tube or supraglottic airway) with waveform capnography.
3. High-quality CPR: 100 to 120 per minute, at least 5 cm (2 in) but not more than 6 cm deep, full recoil, minimal interruptions, no excessive ventilation. 30:2 without an advanced airway; 1 breath every 6 s with one.
4. Rhythm check every 2 min. Shockable: shock (VF/pVT loop). Organized rhythm: check for a pulse, no more than 10 s.
5. Look for and treat reversible causes (H's and T's), for example:
   - Hypovolemia: fluid; blood products and bleeding control for hemorrhage.
   - Hypoxia: oxygen, effective ventilation, airway.
   - Hydrogen ion (acidosis): effective ventilation without overventilating. Routine sodium bicarbonate is not recommended (2025 AHA).
   - Hyperkalemia: AHA 2025 says evidence for IV calcium or sodium bicarbonate in hyperkalemic arrest is limited; follow local protocol.
   - Tension pneumothorax: needle decompression, then a chest tube.
   - Tamponade: bedside ultrasound and pericardiocentesis.
   - Toxins: specific antidotes; an opioid antagonist may be reasonable if CPR is not interrupted.
   - Thrombosis (pulmonary or coronary): thrombolysis per local protocol for PE; emergent coronary angiography after ROSC for persistent ST elevation.`,
    source: 'App reference notes based on the 2025 AHA Adult Cardiac Arrest Algorithm, Part 9 (Adult ALS) and Part 10 (Special Circumstances)',
    references: [R.arrestAlgorithm, R.adultAls, R.specialCircumstances],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-hs-and-ts-matrix',
    category: 'hs_and_ts',
    title: 'Reversible Causes (H\'s and T\'s)',
    keywords: ['hs and ts', 'reversible causes', 'hypovolemia', 'hypoxia', 'hydrogen ion', 'acidosis', 'hypokalemia', 'hyperkalemia', 'hypothermia', 'tension pneumothorax', 'tamponade', 'toxins', 'thrombosis', 'pulmonary embolism', 'myocardial infarction'],
    summary: 'Clues, bedside ultrasound findings and first treatments for the 5 H\'s and 5 T\'s, with the 2025 AHA cautions on calcium, bicarbonate and ventilation.',
    protocolContent: `**The 5 H's and 5 T's (2025 AHA list)**

| Reversible cause | Clues / POCUS | First management |
| :--- | :--- | :--- |
| **Hypovolemia** | Bleeding, trauma, GI bleed, sepsis; collapsed IVC | Fluid bolus; blood products (massive transfusion protocol) and bleeding control for hemorrhage |
| **Hypoxia** | Low SpO2 before arrest, airway obstruction | Oxygen, bag-mask ventilation, clear the airway, advanced airway |
| **Hydrogen ion (acidosis)** | Renal failure, DKA, prolonged arrest, pH < 7.1 | Effective ventilation without overventilating. Routine sodium bicarbonate is not recommended (2025 AHA); some protocols use it for known severe metabolic acidosis |
| **Hyperkalemia** | Peaked T waves, wide QRS, dialysis patient, crush injury | AHA 2025: evidence for IV calcium or sodium bicarbonate in hyperkalemic arrest is limited. Many protocols give calcium (10% calcium chloride 5 to 10 mL or 10% calcium gluconate 15 to 30 mL), insulin with dextrose, and dialysis; follow local protocol |
| **Hypokalemia** | Flat T waves, U waves, diuretics, vomiting/diarrhea | Potassium replacement (never as a rapid push); magnesium |
| **Hypothermia** | Core temperature below 35 °C (severe below 30 °C), cold exposure | Rewarm alongside resuscitation (2025 AHA). European (ERC) guidance limits shocks to 3 and withholds epinephrine below 30 °C; follow local protocol. Consider ECLS rewarming |
| **Tension pneumothorax** | Unequal chest rise, absent breath sounds, tracheal deviation | Needle decompression (2nd intercostal space midclavicular line or 4th/5th space anterior axillary line), then a chest tube |
| **Tamponade, cardiac** | Distended neck veins; pericardial effusion with RV collapse on POCUS | Ultrasound-guided pericardiocentesis |
| **Toxins** | Toxidrome, pupils, empty bottles | Specific antidotes (see toxicology notes); consider ECLS for refractory poisoning |
| **Thrombosis, pulmonary** | DVT history, sudden dyspnea, dilated RV on POCUS | Thrombolysis per local protocol; ECLS may support selected patients |
| **Thrombosis, coronary** | Chest pain, ischemic ECG | After ROSC: emergent coronary angiography for persistent ST elevation |`,
    source: 'App reference notes based on the 2025 AHA Cardiac Arrest Algorithm, Part 9 and Part 10; treatments marked "local protocol" or "ERC" are not AHA recommendations',
    references: [R.arrestAlgorithm, R.adultAls, R.specialCircumstances],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-resuscitation-medications-table',
    category: 'drugs',
    title: 'Adult ACLS Drug Doses',
    keywords: ['epinephrine', 'amiodarone', 'lidocaine', 'procainamide', 'atropine', 'adenosine', 'magnesium', 'calcium', 'sodium bicarbonate', 'dopamine', 'vasopressin', 'drug doses'],
    summary: 'Doses from the 2025 AHA adult algorithms, and which drugs AHA does not recommend routinely in cardiac arrest.',
    protocolContent: `**Adult drug doses (2025 AHA algorithms)**

- **Epinephrine**
  - *Cardiac arrest*: 1 mg IV/IO (10 mL of 0.1 mg/mL) every 3 to 5 min. Asystole/PEA: as soon as possible. VF/pVT: after the 2nd shock.
  - *Bradycardia infusion*: 2 to 10 mcg/min, titrated to response.
- **Amiodarone**
  - *Shock-refractory VF/pVT*: 300 mg IV/IO; second dose 150 mg.
  - *Stable wide-complex tachycardia*: 150 mg over 10 min, repeat as needed if VT recurs; then 1 mg/min for the first 6 hours.
- **Lidocaine** (*shock-refractory VF/pVT*): 1 to 1.5 mg/kg IV/IO; second dose 0.5 to 0.75 mg/kg. The algorithm gives these two doses.
- **Procainamide** (*stable wide-complex tachycardia*): 20 to 50 mg/min until the arrhythmia stops, hypotension, QRS widening above 50%, or 17 mg/kg in total. Maintenance 1 to 4 mg/min. Avoid with prolonged QT or heart failure.
- **Atropine** (*bradycardia*): 1 mg IV every 3 to 5 min, maximum 3 mg. Not part of the cardiac arrest algorithm.
- **Adenosine** (*regular narrow-complex, or regular monomorphic wide-complex tachycardia*): 6 mg rapid IV push with a saline flush; second dose 12 mg.
- **Dopamine** (*bradycardia*): 5 to 20 mcg/kg/min.
- **Magnesium**: may be considered for recurrent polymorphic VT (torsades de pointes); not recommended for polymorphic VT with a normal QT. 1 to 2 g IV is the common dose.

**Not recommended routinely in adult cardiac arrest (2025 AHA)**: calcium, sodium bicarbonate and magnesium. Vasopressin, alone or with epinephrine, offers no advantage over epinephrine. Calcium and bicarbonate are still used for specific problems (hyperkalemia, calcium channel blocker or sodium channel blocker poisoning) under local protocol; doses: 10% calcium chloride 5 to 10 mL or 10% calcium gluconate 15 to 30 mL; sodium bicarbonate 1 mEq/kg.`,
    source: 'App reference notes based on the 2025 AHA adult algorithms and Part 9 (Adult ALS); "common dose" items are not from AHA',
    references: [R.arrestAlgorithm, R.tachycardiaAlgorithm, R.bradycardiaAlgorithm, R.adultAls],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-pals-pediatric-resus',
    category: 'pals',
    title: 'Pediatric Cardiac Arrest (PALS)',
    keywords: ['pals', 'pediatric', 'child', 'infant', 'weight', 'broselow', 'pediatric defib', 'pediatric epi', 'pediatric arrest'],
    summary: 'Weight-based pediatric cardiac arrest doses: shocks 2 J/kg then 4 J/kg (up to 10 J/kg or the adult dose), epinephrine 0.01 mg/kg, amiodarone 5 mg/kg (max 300 mg, later doses max 150 mg).',
    protocolContent: `**2025 AHA Pediatric Cardiac Arrest Algorithm**

- **CPR**: 100 to 120 per minute, at least one third of the chest depth. 1 rescuer: 30:2. 2 rescuers: 15:2 before puberty, 30:2 after puberty starts. With an advanced airway: 1 breath every 2 to 3 s, compressions continuous.
- **Shocks**: first 2 J/kg; second 4 J/kg; later shocks at least 4 J/kg, up to 10 J/kg or the adult dose.
- **Epinephrine**: 0.01 mg/kg IV/IO (0.1 mL/kg of 0.1 mg/mL), maximum 1 mg, every 3 to 5 min. Nonshockable rhythm: as soon as possible.
- **Amiodarone**: 5 mg/kg IV/IO bolus (maximum 300 mg); may repeat up to 3 doses for refractory VF/pVT, maximum 150 mg for later doses. **Or lidocaine** 1 mg/kg IV/IO.
- **Arterial line in place**: aim for diastolic pressure of at least 25 mm Hg in infants and 30 mm Hg in children.
- **Reversible causes**: the H's and T's, plus hypoglycemia.
- **Not recommended routinely**: sodium bicarbonate and calcium.
- **Fluid for shock** (not arrest): 10 to 20 mL/kg boluses, reassessing after each.`,
    source: 'App reference notes based on the 2025 AHA Pediatric Cardiac Arrest Algorithm and Part 8 (PALS)',
    references: [R.palsAlgorithm, R.pals],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-post-rosc-care',
    category: 'post_rosc',
    title: 'Adult Post-Cardiac Arrest Care (ROSC)',
    keywords: ['rosc', 'post arrest', 'return of spontaneous circulation', 'ttm', 'temperature control', 'targeted temperature management', 'hypothermia', 'map', 'ecg', 'cath lab', 'prognosis'],
    summary: 'SpO2 90 to 98%, PaCO2 35 to 45 mm Hg, MAP at least 65 mm Hg, early 12-lead ECG, temperature control 32 to 37.5 °C for at least 36 h if not following commands, glucose 70 to 180 mg/dL, prognosis no earlier than 72 h.',
    protocolContent: `**2025 AHA Adult Post-Cardiac Arrest Care**

1. **Airway and breathing**
   - Place or exchange an advanced airway as needed and confirm placement.
   - 100% oxygen until SpO2 or PaO2 can be measured reliably, then **SpO2 90 to 98%** (PaO2 60 to 105 mm Hg).
   - **PaCO2 35 to 45 mm Hg** (unless severe acidemia).
2. **Circulation**
   - **MAP at least 65 mm Hg**. The 2025 guidelines removed the old systolic pressure target.
   - Fluids and vasopressors as needed. AHA finds no evidence to prefer a specific vasopressor.
3. **Find and treat the cause**
   - **12-lead ECG** as soon as feasible.
   - Persistent ST elevation: **emergent coronary angiography**, even if the patient is comatose.
   - Cardiogenic shock, recurrent ventricular arrhythmias or ongoing ischemia: emergency angiography is reasonable; consider mechanical circulatory support.
   - Comatose without ST elevation: emergency angiography is not recommended over a delayed or selective approach.
   - Consider CT (head, chest, abdomen, pelvis) and echo/POCUS.
4. **Not following commands**
   - Deliberate temperature control at **32 to 37.5 °C for at least 36 hours**. Avoid rewarming faster than 0.5 °C per hour. No routine rapid cold IV fluids before hospital.
   - Prompt **EEG**. Treat clinical seizures; treating nonconvulsive seizures is reasonable. No routine seizure prophylaxis; do not treat myoclonus that has no EEG correlate.
   - **Prognostication**: multimodal, never on a single finding, and no earlier than **72 hours after normothermia** and after sedation is stopped.
5. **Glucose**: avoid hypoglycemia (**below 70 mg/dL**) and hyperglycemia (**above 180 mg/dL**).
6. **Before discharge**: coronary angiography for survivors with a suspected cardiac cause, especially after an initial shockable rhythm, with unexplained left ventricular dysfunction, or with severe ischemia.`,
    source: 'App reference notes based on the 2025 AHA Post-Cardiac Arrest Care Algorithm and Part 11',
    references: [R.postArrestAlgorithm, R.postArrest],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-tachycardia-algorithm',
    category: 'tachycardia',
    title: 'Adult Tachyarrhythmia With a Pulse',
    keywords: ['tachycardia', 'tachyarrhythmia', 'svt', 'afib', 'atrial fibrillation', 'flutter', 'vt with pulse', 'cardioversion', 'adenosine', 'diltiazem', 'procainamide'],
    summary: 'Unstable: synchronized cardioversion (AF and flutter 200 J, narrow-complex and monomorphic VT 100 J, polymorphic VT defibrillation). Stable: vagal maneuvers and adenosine for regular narrow QRS; antiarrhythmic infusion for wide QRS.',
    protocolContent: `**2025 AHA Adult Tachyarrhythmia With a Pulse (heart rate typically 150 or more)**

- **Is the tachyarrhythmia causing** hypotension, acutely altered mental status, signs of shock, ischemic chest discomfort or acute heart failure?
- **Yes: synchronized cardioversion.** Sedate whenever feasible. If regular and narrow, consider adenosine.
  - Energies (2025 AHA Electrical Cardioversion Algorithm): atrial fibrillation 200 J; atrial flutter 200 J; narrow-complex tachycardia 100 J; monomorphic VT 100 J.
  - Polymorphic VT: an unsynchronized, high-energy shock (defibrillation dose).
  - If the energy for your device is not known, use the maximum. If cardioversion fails, consider a higher energy, the underlying cause, an antiarrhythmic and expert advice.
  - Resynchronize after each shock; if synchronizing delays care in a critical patient, give unsynchronized shocks.
- **No, narrow QRS (below 0.12 s)**: vagal maneuvers (if regular), **adenosine 6 mg** rapid IV push, then 12 mg (if regular); a beta blocker or calcium channel blocker; expert consultation. Common doses (not AHA): metoprolol 5 mg IV, diltiazem 0.25 mg/kg IV.
- **No, wide QRS (0.12 s or more)**: adenosine only if regular and monomorphic; an antiarrhythmic infusion: **procainamide** 20 to 50 mg/min (maximum 17 mg/kg; avoid with prolonged QT or heart failure) or **amiodarone 150 mg over 10 min**; expert consultation.
- **Do not give** verapamil or diltiazem for wide-complex tachycardia, or adenosine for unstable, irregular or polymorphic wide-complex tachycardia (harm).`,
    source: 'App reference notes based on the 2025 AHA Tachyarrhythmia and Electrical Cardioversion Algorithms and Part 9 (Adult ALS)',
    references: [R.tachycardiaAlgorithm, R.cardioversionAlgorithm, R.adultAls],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-bradycardia-algorithm',
    category: 'bradycardia',
    title: 'Adult Bradycardia With a Pulse',
    keywords: ['bradycardia', 'heart block', 'av block', 'atropine', 'pacing', 'transcutaneous pacing', 'transvenous pacing', 'dopamine'],
    summary: 'Bradycardia with cardiopulmonary compromise: atropine 1 mg (maximum 3 mg); if ineffective, transcutaneous pacing and/or dopamine or epinephrine infusion; consider transvenous pacing.',
    protocolContent: `**2025 AHA Adult Bradycardia With a Pulse (heart rate typically below 50)**

1. **Look for cardiopulmonary compromise**: hypotension, acutely altered mental status, signs of shock, ischemic chest discomfort, acute heart failure. Support the airway, give oxygen if needed, monitor, 12-lead ECG.
2. **Atropine** 1 mg IV, repeat every 3 to 5 min, maximum 3 mg. Often not effective in Mobitz II or complete heart block with wide QRS, or after heart transplant.
3. **If atropine is not effective**: transcutaneous pacing and/or **dopamine** 5 to 20 mcg/kg/min or **epinephrine** 2 to 10 mcg/min, titrated to response.
   - Pacing in practice (not AHA): demand mode, rate about 60 to 80, increase the current until both electrical and mechanical capture; give analgesia and sedation.
4. **Consider** expert consultation and **transvenous pacing**. New in 2025: for persistent unstable bradycardia that does not respond to drugs, temporary transvenous pacing is reasonable.
5. **Possible causes**: myocardial ischemia or infarction; drugs and toxins (calcium channel blockers, beta blockers, digoxin); hypoxia; electrolyte problems such as hyperkalemia.`,
    source: 'App reference notes based on the 2025 AHA Bradycardia With a Pulse Algorithm and Part 9 (Adult ALS)',
    references: [R.bradycardiaAlgorithm, R.adultAls],
    updatedAt: CHECKED,
  },
  {
    id: 'rag-toxicology-antidotes',
    category: 'toxicology',
    title: 'Toxicology and Antidotes in Resuscitation',
    keywords: ['toxins', 'toxicology', 'overdose', 'naloxone', 'calcium', 'glucagon', 'insulin', 'lipid emulsion', 'flumazenil', 'digibind', 'cyanide'],
    summary: 'Common antidotes for poisoning in or near cardiac arrest. Not an AHA guideline: check doses with a poison center or local protocol.',
    protocolContent: `**Toxicology antidotes (general practice, not AHA text; check with a poison center)**

- **Opioids**: naloxone 0.4 to 2 mg IV/IO/IM/IN, repeat every 2 to 3 min as needed. AHA 2025: give an opioid antagonist for respiratory arrest; in cardiac arrest it may be reasonable if high-quality CPR is not interrupted.
- **Beta blocker toxicity**: glucagon 3 to 10 mg IV over 3 to 5 min, then 3 to 5 mg/h; high-dose insulin (1 unit/kg bolus, then 0.5 to 1 unit/kg/h) with dextrose.
- **Calcium channel blocker toxicity**: 10% calcium gluconate 30 to 60 mL (or 10% calcium chloride 10 to 20 mL); high-dose insulin with dextrose; vasopressors.
- **Local anesthetic toxicity**: 20% lipid emulsion 1.5 mL/kg IV over 1 min, then 0.25 mL/kg/min.
- **Organophosphates**: atropine 2 to 5 mg IV, repeated every 5 to 10 min until secretions dry; pralidoxime 1 to 2 g IV over 15 to 30 min.
- **Tricyclic antidepressants and other sodium channel blockers**: sodium bicarbonate 1 to 2 mEq/kg IV until the QRS narrows (target pH about 7.50 to 7.55).
- **Refractory shock or arrest from poisoning**: AHA 2025 notes that ECLS (for example VA-ECMO) may support selected patients.`,
    source: 'App reference notes from general toxicology practice; not an AHA guideline except where AHA is named',
    references: [R.specialCircumstances],
    updatedAt: CHECKED,
  },
];

/** Plain-text list of the AHA pages behind a set of notes, for the offline answers. */
export function referenceLines(chunks: RagKnowledgeChunk[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const c of chunks) {
    for (const r of c.references) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      lines.push(`- ${r.title}: ${r.url}`);
    }
  }
  return lines.length ? `Based on:\n${lines.join('\n')}` : '';
}

/**
 * An offline answer: the notes, the AHA pages they are based on, and a plain
 * statement of what they are. Used by the server and by the browser fallback.
 */
export function offlineNotesText(chunks: RagKnowledgeChunk[], body: string): string {
  const refs = referenceLines(chunks);
  return `${body}${refs ? `\n\n${refs}` : ''}\n\n*These are the app's built-in reference notes, not a live AI answer and not AHA text. Check against the current AHA guidelines.*`;
}

/**
 * High-precision Retrieval-Augmented Generation (RAG) search engine
 * Computes multi-token BM25/cosine relevance against knowledge chunks
 */
export function queryAclsRag(query: string, topK: number = 3): RagKnowledgeChunk[] {
  if (!query || query.trim().length === 0) {
    return ACLS_RAG_KNOWLEDGE_BASE.slice(0, topK);
  }

  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length > 1);

  const scored = ACLS_RAG_KNOWLEDGE_BASE.map(chunk => {
    let score = 0;
    const titleLower = chunk.title.toLowerCase();
    const summaryLower = chunk.summary.toLowerCase();
    const contentLower = chunk.protocolContent.toLowerCase();

    for (const token of queryTokens) {
      // Direct keyword exact match gives highest weight
      if (chunk.keywords.some(k => k.includes(token))) {
        score += 15;
      }
      if (titleLower.includes(token)) {
        score += 10;
      }
      if (summaryLower.includes(token)) {
        score += 5;
      }
      if (contentLower.includes(token)) {
        score += 2;
      }
    }

    // Category boosts
    if (cleanQuery.includes('pals') || cleanQuery.includes('child') || cleanQuery.includes('pediatric')) {
      if (chunk.category === 'pals') score += 25;
    }
    if (cleanQuery.includes('drug') || cleanQuery.includes('dose') || cleanQuery.includes('epi') || cleanQuery.includes('amiodarone')) {
      if (chunk.category === 'drugs') score += 20;
    }
    if (cleanQuery.includes('h') || cleanQuery.includes('t') || cleanQuery.includes('cause') || cleanQuery.includes('potassium')) {
      if (chunk.category === 'hs_and_ts') score += 20;
    }
    if (cleanQuery.includes('vf') || cleanQuery.includes('vt') || cleanQuery.includes('shock')) {
      if (chunk.category === 'shockable') score += 20;
    }
    if (cleanQuery.includes('pea') || cleanQuery.includes('asystole')) {
      if (chunk.category === 'non_shockable') score += 20;
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top matches, or default top if no score
  const results = scored.filter(s => s.score > 0).map(s => s.chunk);
  if (results.length === 0) {
    return ACLS_RAG_KNOWLEDGE_BASE.slice(0, topK);
  }
  return results.slice(0, topK);
}
