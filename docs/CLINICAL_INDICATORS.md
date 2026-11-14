# ASTRA Clinical Health Indicators & Triage Framework

ASTRA monitors and scores **12 deep-space clinical indicators**, mapping live telemetry and mission logs into a standardized four-tier clinical risk classification: **Normal**, **Below Normal**, **Above Normal**, and **Critical**.

---

## 📋 The 12 Health Indicators

### 1. Resting Heart Rate (BPM)
- **Normal:** 60 – 100 BPM
- **Below Normal:** < 60 BPM (Bradycardia)
- **Above Normal:** > 100 BPM (Tachycardia / Exertion)
- **Critical:** Heart rate anomalies accompanied by chest pain, severe palpitations, shortness of breath, or syncope.

### 2. Blood Oxygen Saturation ($\text{SpO}_2$)
- **Normal:** 95% – 100%
- **Below Normal:** 92% – 94% (Mild Hypoxia)
- **Critical:** < 92% (Severe Hypoxia / Cabin decompression alert)

### 3. Blood Pressure ($\text{mmHg}$)
- **Normal:** 120 / 80 mmHg
- **Above Normal:** Stage 1 (130–139 / 80–89 mmHg), Stage 2 ($\ge 140$ / $\ge 90$ mmHg)
- **Below Normal:** $\le 90$ / $\le 60$ mmHg (Hypotension)

### 4. Body Temperature ($^\circ\text{C}$)
- **Normal:** 36.5$^\circ\text{C}$ – 37.5$^\circ\text{C}$ (Oral baseline: 36.7$^\circ\text{C}$)
- **Above Normal:** 37.6$^\circ\text{C}$ – 38.4$^\circ\text{C}$ (Low-grade fever)
- **Critical:** $> 38.5$ (Hyperthermia) or $< 35.0$ (Hypothermia)

### 5. Blood Glucose ($\text{mg/dL}$)
- **Normal (Pre-meal):** 80 – 130 mg/dL
- **Below Normal:** < 70 mg/dL (Hypoglycemia)
- **Above Normal:** > 130 mg/dL pre-meal, or $\ge 180$ mg/dL 2 hours post-prandial
- **Critical:** < 50 mg/dL (Seizures / unconsciousness) or > 240 mg/dL (Diabetic ketoacidosis risk)

### 6. Bone Mineral Density (DEXA T-Score)
- **Normal:** T-score $\ge -1.0$ (Pre-flight baseline)
- **Below Normal:** $-1.0$ to $-2.5$ (Low bone mass / Osteopenia)
- **Critical:** $\le -2.5$ (Severe microgravity bone demineralization) or suspected fracture

### 7. Hydration & Fluid Balance
- **Normal:** 2500 – 3000 mL/day fluid intake with stable cephalad fluid shift
- **Below Normal:** < 2000 mL/day (Dehydration risk)
- **Above Normal:** Persistent excess or fluid redistribution edema

### 8. Daily Exercise Countermeasure
- **Normal:** Completion of mission-prescribed aerobic and resistance sessions (e.g. 45–60 min/day)
- **Below Normal:** Missed sessions or incomplete workout volume
- **Critical:** Exercise stopped due to chest pain, severe arrhythmia, or sudden dizziness

### 9. Sleep Cycles & Circadian Duration
- **Normal:** 7 – 9 hours per 24-hour cycle
- **Below Normal:** < 7 hours or frequent awakenings
- **Critical:** Persistent insomnia, severe daytime microsleeps during safety-critical flight tasks

### 10. Mood, Stress & Psychological Well-being
- **Normal:** Stable mood, balanced self-report score
- **Below Normal:** Elevated irritability, social withdrawal, mild anxiety
- **Action:** Triggers Earth relaxation audio, 4-4-6 breathing pacer, and behavioral health support contact

### 11. Vestibular Balance & Neuro-vestibular Adaptation
- **Normal:** Stable vestibulo-ocular response, no dizziness at baseline
- **Below Normal:** Below baseline score (Space Adaptation Syndrome)
- **Critical:** Near-fall, spatial disorientation, inability to complete manual control tasks

### 12. Cumulative Radiation Exposure
- **Normal:** < 0.7 mSv/day (Nominal LEO/Transit background)
- **Above Normal:** 0.7 – 1.5 mSv/day
- **Critical:** Solar Particle Event (SPE) alert ($> 5.0$ mSv/hr), immediate storm shelter retreat advisory
