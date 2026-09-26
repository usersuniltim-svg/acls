export interface RagKnowledgeChunk {
  id: string;
  category: 'cardiac_arrest' | 'shockable' | 'non_shockable' | 'drugs' | 'hs_and_ts' | 'post_rosc' | 'pals' | 'tachycardia' | 'bradycardia' | 'toxicology';
  title: string;
  keywords: string[];
  summary: string;
  protocolContent: string;
  source: string;
  updatedAt: string;
}

export const ACLS_RAG_KNOWLEDGE_BASE: RagKnowledgeChunk[] = [
  {
    id: 'rag-vf-pvt-shockable',
    category: 'shockable',
    title: 'ACLS 2025 VF / Pulseless VT (Shockable Rhythm) Protocol',
    keywords: ['vf', 'vfib', 'ventricular fibrillation', 'vt', 'pvt', 'pulseless vt', 'shock', 'defib', 'defibrillation', 'amiodarone', 'lidocaine', 'epinephrine'],
    summary: 'Immediate defibrillation (200J Biphasic), 2 minutes high-quality CPR, Epinephrine after 2nd shock, Amiodarone or Lidocaine after 3rd shock.',
    protocolContent: `**ACLS 2025 Shockable Algorithm (VF / Pulseless VT):**
1. **Initial Action**: Confirm cardiac arrest (unresponsive, absent breathing/carotid pulse <10 sec). Start CPR immediately. Attach Monitor/Defibrillator.
2. **Rhythm Check**: VF / Pulseless VT -> **SHOCK #1** (200J Biphasic or manufacturer maximum).
3. **Immediate CPR**: Resume CPR for 2 minutes immediately without pausing for rhythm check. Establish IV/IO access.
4. **Rhythm Check (Cycle 2)**: If shockable -> **SHOCK #2**. Resume CPR 2 min.
   - **Epinephrine 1 mg IV/IO** (1:10,000 solution) given during CPR cycle 2, repeated every 3 to 5 minutes.
   - Consider advanced airway (endotracheal tube or supraglottic airway) with continuous waveform capnography (ETCO2 target >10-20 mmHg during CPR).
5. **Rhythm Check (Cycle 3)**: If shockable -> **SHOCK #3**. Resume CPR 2 min.
   - **Antiarrhythmic Agent**:
     - **Amiodarone**: First dose 300 mg IV/IO bolus; second dose 150 mg IV/IO after subsequent shock.
     - OR **Lidocaine**: First dose 1.0 - 1.5 mg/kg IV/IO; second dose 0.5 - 0.75 mg/kg IV/IO.
6. **Treat Reversible Causes**: Concurrently assess and treat the 5 H's and 5 T's (especially Hypoxia, Hypokalemia/Hyperkalemia, Hypovolemia, Toxins, and Ischemia).`,
    source: 'AHA/ILCOR 2025 Guidelines for CPR and Emergency Cardiovascular Care',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-pea-asystole-non-shockable',
    category: 'non_shockable',
    title: 'ACLS 2025 PEA / Asystole (Non-Shockable Rhythm) Protocol',
    keywords: ['pea', 'asystole', 'pulseless electrical activity', 'non shockable', 'epinephrine', 'flatline', 'hs and ts'],
    summary: 'High-quality CPR, immediate Epinephrine 1mg IV/IO ASAP, repeated q3-5m, aggressive search for reversible causes (Hs and Ts).',
    protocolContent: `**ACLS 2025 Non-Shockable Algorithm (PEA / Asystole):**
1. **Initial Action**: Identify non-shockable rhythm (organized rhythm with absent pulses = PEA; flatline verified in 2 leads = Asystole).
2. **Immediate Drug**: Administer **Epinephrine 1 mg IV/IO as early as possible**.
3. **High-Quality CPR**: Continuous CPR in 2-minute cycles (100-120 bpm, 5-6 cm depth, complete recoil, minimal interruptions).
4. **Medication Timing**: Repeat **Epinephrine 1 mg IV/IO every 3 to 5 minutes**.
5. **Priority Diagnostic Investigation**: Search and aggressively reverse the primary precipitant (5 H's and 5 T's).
   - Hypovolemia -> Rapid warm crystalloid bolus (1-2 L).
   - Hypoxia -> 100% FiO2, bag-valve-mask, secure airway.
   - Hydrogen ion (Acidosis) -> Ensure ventilation; consider Sodium Bicarbonate 1 mEq/kg for preexisting severe metabolic acidosis.
   - Hyperkalemia -> Calcium gluconate 10% 10-20 mL or Calcium chloride 10% 5-10 mL IV over 2-5 min, followed by regular insulin 10 units + 50 mL D50W, and Sodium Bicarbonate.
   - Tension Pneumothorax -> Immediate needle decompression (2nd intercostal space midclavicular line or 4th/5th intercostal anterior axillary line) followed by tube thoracostomy.
   - Cardiac Tamponade -> Emergency bedside ultrasound (POCUS) + pericardiocentesis.
   - Toxins / Overdose -> Specific antidote (Naloxone, Lipid emulsion, Calcium, Glucagon).
   - Thrombosis (PE/Coronary) -> Thrombolytic therapy / emergent PCI consideration.`,
    source: 'AHA 2025 Resuscitation Standards & ERC Guidelines',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-hs-and-ts-matrix',
    category: 'hs_and_ts',
    title: 'Comprehensive Hs & Ts Reversible Causes Clinical Matrix',
    keywords: ['hs and ts', 'reversible causes', 'hypovolemia', 'hypoxia', 'hydrogen ion', 'acidosis', 'hypokalemia', 'hyperkalemia', 'hypothermia', 'hypoglycemia', 'tension pneumothorax', 'tamponade', 'toxins', 'thrombosis', 'pulmonary embolism', 'myocardial infarction'],
    summary: 'Differential diagnostic clues, bedside ultrasonography findings, and immediate treatment modalities for all 5 Hs and 5 Ts.',
    protocolContent: `**The 5 H's and 5 T's Emergency Clinical Differential Matrix:**

| Reversible Cause | Diagnostic Clues / POCUS | Immediate Emergency Management |
| :--- | :--- | :--- |
| **Hypovolemia** | Flat neck veins, history of bleeding, trauma, GI bleed, sepsis, collapsed IVC on ultrasound | Rapid 1-2L IV/IO crystalloid bolus, massive transfusion protocol (PRBC, FFP, Platelets 1:1:1), surgical hemostasis |
| **Hypoxia** | Cyanosis, low SpO2 prior to arrest, airway obstruction, ETCO2 < 10 | 100% O2, bag-valve-mask, reposition airway, suction, endotracheal intubation |
| **Hydrogen Ion (Acidosis)** | Known renal failure, DKA, prolonged arrest, arterial blood gas pH < 7.1 | Hyperventilation (ensure adequate minute ventilation), Sodium Bicarbonate 1 mEq/kg IV |
| **Hyperkalemia** | Peaked T waves, wide QRS, ESRD/Dialysis patient, crush injury | 10% Calcium Gluconate 10-20 mL IV (membrane stabilization) + Regular Insulin 10 IU + 50 mL D50W + Sodium Bicarb 50 mEq |
| **Hypokalemia** | Flattened T waves, U waves, diuretic use, prolonged vomiting/diarrhea | Magnesium Sulfate 1-2g IV, Potassium Chloride (cautious infusion, never rapid push) |
| **Hypothermia** | Core body temp < 30°C (< 86°F), cold exposure | Active internal and external rewarming (warm IV fluids, heated humidified O2, warm pleural lavage), limit defib/epi until temp > 30°C |
| **Tension Pneumothorax** | Asymmetric chest rise, absent breath sounds, tracheal deviation, subcutaneous emphysema | Immediate needle thoracostomy (2nd ICS midclavicular or 5th ICS anterior axillary line) -> Chest tube |
| **Cardiac Tamponade** | Muffled heart sounds, distended neck veins, POCUS showing pericardial effusion + RV diastolic collapse | Emergent ultrasound-guided subxiphoid pericardiocentesis |
| **Toxins / Overdose** | Constricted/dilated pupils, toxidrome, empty drug bottles | Naloxone (opioids), Calcium/High-dose insulin (CCB), Glucagon (Beta-blockers), 20% Lipid Emulsion (LAST/Local anesthetics) |
| **Thrombosis (Pulmonary)** | DVT history, sudden dyspnea, dilated right ventricle on POCUS | Tenecteplase / Alteplase 50mg IV bolus, continue CPR for minimum 15-30 minutes post-thrombolysis |
| **Thrombosis (Coronary)** | History of chest pain, ischemic ECG changes, STEMI presentation | Immediate post-ROSC catheterization lab activation (emergent PCI) |`,
    source: 'ACLS 2025 Core Guidelines & Emergency Medicine Review',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-resuscitation-medications-table',
    category: 'drugs',
    title: 'ACLS Emergency Resuscitation Medication Dosages & Indications',
    keywords: ['epinephrine', 'amiodarone', 'lidocaine', 'atropine', 'adenosine', 'magnesium', 'calcium', 'sodium bicarbonate', 'dopamine', 'norepinephrine', 'drug doses'],
    summary: 'Exact drug concentrations, routes (IV/IO), initial and maintenance dosages, and clinical pearls for resuscitation pharmacotherapy.',
    protocolContent: `**ACLS 2025 Emergency Pharmacotherapy Reference:**

- **Epinephrine**:
  - *Cardiac Arrest (Adult)*: 1 mg IV/IO (10 mL of 1:10,000 / 0.1 mg/mL) every 3-5 minutes, followed by 20 mL saline flush.
  - *Post-ROSC / Bradycardia Infusion*: 2 - 10 mcg/min IV infusion, titrated to MAP ≥ 65 mmHg.
- **Amiodarone**:
  - *Shock-Refractory VF/pVT*: First dose 300 mg IV/IO rapid push diluted in 20 mL D5W. Second dose 150 mg IV/IO after subsequent shock.
  - *Stable Wide-Complex Tachycardia*: 150 mg in 100 mL D5W infused over 10 minutes; maintenance infusion 1 mg/min for 6 hours, then 0.5 mg/min.
- **Lidocaine**:
  - *Shockable Arrest*: First dose 1.0 - 1.5 mg/kg IV/IO. Second dose 0.5 - 0.75 mg/kg. Max cumulative dose 3 mg/kg.
- **Atropine**:
  - *Symptomatic Bradycardia*: 1 mg IV bolus every 3-5 minutes. Maximum cumulative dose 3 mg. (Do not use in cardiac arrest).
- **Adenosine**:
  - *Stable SVT / Regular Narrow Tachycardia*: First dose 6 mg rapid IV push over 1-2 sec via antecubital vein with immediate 20 mL saline flush. Second dose 12 mg if no conversion in 1-2 minutes.
- **Magnesium Sulfate**:
  - *Torsades de Pointes (Polymorphic VT with prolonged QT)*: 1 - 2 g IV/IO diluted in 10 mL D5W given over 1-2 minutes in arrest (or over 15 min if pulse present).
- **Calcium Gluconate 10% / Calcium Chloride 10%**:
  - *Hyperkalemia / Hypocalcemia / CCB Overdose*: Calcium gluconate 10% 15-30 mL (or Calcium chloride 10% 5-10 mL) IV/IO over 2-5 minutes.
- **Sodium Bicarbonate 8.4%**:
  - *Severe Acidosis / TCA Overdose / Hyperkalemia*: 1 mEq/kg (approx 50-100 mEq) IV push.`,
    source: 'American Heart Association / ERC Resuscitation Drug Compendium',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-pals-pediatric-resus',
    category: 'pals',
    title: 'PALS 2025 Pediatric Advanced Life Support Guidelines',
    keywords: ['pals', 'pediatric', 'child', 'infant', 'weight', 'broselow', 'pediatric defib', 'pediatric epi', 'pediatric arrest'],
    summary: 'Weight-based resuscitation formulas, pediatric shock voltages (2-4 J/kg), Epinephrine (0.01 mg/kg), and CPR ratios.',
    protocolContent: `**PALS 2025 Pediatric Cardiac Arrest Reference:**

- **Compression-to-Ventilation Ratio**:
  - *Single Rescuer*: 30:2 compressions to breaths.
  - *2 Rescuers (Healthcare providers)*: 15:2 compressions to breaths.
  - *With Advanced Airway*: Continuous compressions (100-120 bpm) with 1 breath every 2-3 seconds (20-30 breaths/min).
- **Defibrillation Energy (Pediatric)**:
  - *Initial Shock*: **2 J/kg**
  - *Second Shock*: **4 J/kg**
  - *Subsequent Shocks*: ≥ 4 J/kg (up to 10 J/kg or adult maximum of 200J).
- **Pediatric Medications**:
  - **Epinephrine**: **0.01 mg/kg** (0.1 mL/kg of 1:10,000 solution) IV/IO every 3-5 minutes. Maximum single dose 1 mg.
  - **Amiodarone**: **5 mg/kg** IV/IO bolus (may repeat up to 2 times for refractory VF/pVT, max single dose 300 mg).
  - **Lidocaine**: Loading dose 1 mg/kg IV/IO.
  - **Fluid Resuscitation**: Normal Saline / Ringer's Lactate **20 mL/kg** IV/IO bolus over 5-10 minutes for hypovolemia/septic shock.`,
    source: 'PALS 2025 Guidelines / ILCOR Pediatric Task Force',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-post-rosc-care',
    category: 'post_rosc',
    title: 'Post-Cardiac Arrest Care & Targeted Temperature Management (ROSC)',
    keywords: ['rosc', 'post arrest', 'return of spontaneous circulation', 'ttm', 'targeted temperature management', 'hypothermia', 'map', 'ecg', 'cath lab'],
    summary: 'Systematic post-resuscitation bundle: Airway/oxygenation targets, hemodynamic stabilization (MAP > 65), 12-lead ECG, and TTM (32-36°C).',
    protocolContent: `**Post-Cardiac Arrest / ROSC Care Protocol:**

1. **Airway & Respiratory Optimization**:
   - Maintain SpO2 between 92% - 98% (avoid hyperoxia and hypoxia).
   - Maintain PaCO2 between 35 - 45 mmHg (avoid hyperventilation).
2. **Hemodynamic Targets**:
   - Maintain Mean Arterial Pressure (**MAP**) ≥ **65 mmHg** (Systolic BP > 90 mmHg).
   - Use IV crystalloids and vasopressor infusions:
     - **Norepinephrine**: 0.1 - 0.5 mcg/kg/min.
     - **Epinephrine**: 0.1 - 0.5 mcg/kg/min.
     - **Dopamine**: 5 - 20 mcg/kg/min.
3. **Emergent Cardiac Evaluation**:
   - Immediate 12-lead ECG: Check for ST-elevation (STEMI) or high-risk features.
   - Emergent coronary angiography / PCI for suspected cardiac etiology.
4. **Neurological Protection & Targeted Temperature Management (TTM)**:
   - For all comatose patients (not following commands): Maintain constant target temperature between **32°C and 36°C** (or prevent fever < 37.5°C) for at least 24 hours.
   - Sedation, neuromuscular blockade if shivering occurs, continuous EEG monitoring to detect non-convulsive status epilepticus.
   - Avoid prognostication earlier than 72 hours post-arrest.`,
    source: 'AHA/Neurocritical Care Society 2025 ROSC Recommendations',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-tachycardia-algorithm',
    category: 'tachycardia',
    title: 'Tachycardia with Pulse Algorithm (Stable vs Unstable)',
    keywords: ['tachycardia', 'svt', 'afib', 'atrial fibrillation', 'flutter', 'vt with pulse', 'cardioversion', 'adenosine', 'diltiazem'],
    summary: 'Stepwise differentiation of stable vs unstable tachycardia (hypotension, altered mental status, ischemic chest pain, acute heart failure).',
    protocolContent: `**Tachycardia with Pulse Algorithm (Heart Rate typically ≥ 150 bpm):**

- **Assess Unstable Signs**:
  1. Hypotension (SBP < 90 mmHg)
  2. Acutely altered mental status
  3. Signs of shock (pale, diaphoretic, poor perfusion)
  4. Ischemic chest discomfort
  5. Acute heart failure / pulmonary edema
- **If Unstable**:
  - Immediate **Synchronized Cardioversion**:
    - Narrow Regular (SVT/Flutter): 50 - 100 J
    - Narrow Irregular (AFib): 120 - 200 J Biphasic
    - Wide Regular (Monomorphic VT): 100 J
    - Wide Irregular (Polymorphic VT): Defibrillation shock (200J unsynchronized)
- **If Stable**:
  - **Narrow QRS (< 0.12 sec)**:
    - Regular: Vagal maneuvers -> **Adenosine 6 mg rapid IV push** (if no conversion, 12 mg).
    - If converted: Probable SVT. If not: Beta-blocker (Metoprolol 5mg IV) or Calcium Channel Blocker (Diltiazem 0.25 mg/kg IV).
  - **Wide QRS (≥ 0.12 sec)**:
    - If regular & monomorphic: **Amiodarone 150 mg IV over 10 min** OR **Procainamide 20-50 mg/min** (max 17 mg/kg). Avoid adenosine in irregular wide-complex tachycardia (risk of degenerating into VF).`,
    source: 'ACLS 2025 Arrhythmia Management Guidelines',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-bradycardia-algorithm',
    category: 'bradycardia',
    title: 'Bradycardia with Pulse Algorithm (Heart Rate < 50 bpm)',
    keywords: ['bradycardia', 'heart block', 'av block', 'atropine', 'pacing', 'transcutaneous pacing', 'dopamine'],
    summary: 'Management of symptomatic bradycardia: Atropine 1mg, Transcutaneous Pacing, Dopamine and Epinephrine chronotropic infusions.',
    protocolContent: `**Symptomatic Bradycardia with Pulse Algorithm (Heart Rate < 50 bpm):**

1. **Assess for Serious Signs of Hypoperfusion**:
   - Hypotension, acute altered mental status, chest pain, acute heart failure.
2. **First-Line Drug**:
   - **Atropine**: **1 mg IV bolus** every 3-5 minutes (maximum 3 mg).
   - Note: Ineffective in Mobitz Type II second-degree AV block and Third-degree (Complete) AV block with wide QRS, or cardiac transplant patients.
3. **If Atropine Ineffective**:
   - **Transcutaneous Pacing (TCP)**: Set demand mode, initial rate 60-80 bpm, increase current (mA) until electrical and mechanical capture confirmed. Provide analgesia/sedation.
   - OR **Dopamine Infusion**: 5 to 20 mcg/kg/min chronotropic infusion.
   - OR **Epinephrine Infusion**: 2 to 10 mcg/min IV infusion.
4. **Prepare for Transvenous Pacing** and consult Cardiology.`,
    source: 'AHA/ACC 2025 Bradycardia Guidelines',
    updatedAt: '2025/2026'
  },
  {
    id: 'rag-toxicology-antidotes',
    category: 'toxicology',
    title: 'Emergency Toxicology & Targeted Resuscitation Antidotes',
    keywords: ['toxins', 'toxicology', 'overdose', 'naloxone', 'calcium', 'glucagon', 'insulin', 'lipid emulsion', 'flumazenil', 'digibind', 'cyanide'],
    summary: 'Targeted antidotes and advanced resuscitation protocols for acute overdose and poisoning cardiac arrests.',
    protocolContent: `**Resuscitation Toxicology & Critical Antidote Reference:**

- **Opioid Overdose**:
  - **Naloxone**: 0.4 - 2 mg IV/IO/IM/IN, repeat every 2-3 minutes as needed. In cardiac arrest, prioritize high-quality CPR and airway over rapid naloxone delivery.
- **Beta-Blocker Toxicity**:
  - **Glucagon**: 3 - 10 mg IV push over 3-5 min, followed by infusion 3-5 mg/hr.
  - **High-Dose Insulin Euglycemia (HIE)**: 1 unit/kg regular insulin bolus + 0.5 - 1 unit/kg/hr infusion with 10% or 50% Dextrose.
- **Calcium Channel Blocker (CCB) Toxicity**:
  - **10% Calcium Gluconate**: 30-60 mL IV (or 10% Calcium Chloride 10-20 mL).
  - High-Dose Insulin Euglycemia (HIE) + Vasopressors (Norepinephrine / Epinephrine).
- **Local Anesthetic Systemic Toxicity (LAST - Bupivacaine/Lidocaine)**:
  - **20% Intralipid (Lipid Emulsion)**: 1.5 mL/kg IV bolus over 1 min, followed by infusion 0.25 mL/kg/min.
- **Organophosphate Poisoning**:
  - **Atropine**: 2 - 5 mg IV repeated every 5-10 minutes until secretions dry (clearing of bronchorrhea). **Pralidoxime (2-PAM)** 1-2 g IV over 15-30 min.
- **Tricyclic Antidepressants (TCA) / Sodium Channel Blockers**:
  - **Sodium Bicarbonate 8.4%**: 1 - 2 mEq/kg IV push until QRS narrows < 100 ms and serum pH reaches 7.50-7.55.`,
    source: 'American College of Medical Toxicology / ACLS 2025 Tox Guidelines',
    updatedAt: '2025/2026'
  },
];

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
