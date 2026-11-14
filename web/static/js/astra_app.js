// =========================================================================
// ASTRA - Team SPARC NASA Space Apps Platform (Unified with AstroHealth)
// =========================================================================

// ---------- Theme Management ----------
const root = document.documentElement;
try {
  const t = localStorage.getItem("theme");
  if (t) root.dataset.theme = t;
} catch (e) {}

function isDark() {
  return root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
}

const themeBtn = document.getElementById("themeBtn");
if (themeBtn) {
  themeBtn.onclick = () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    updateThemeBtn();
    if (user) show(page);
  };
}

function updateThemeBtn() {
  if (themeBtn) {
    themeBtn.innerHTML = isDark() ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
}
updateThemeBtn();

// ---------- Simulated & Baseline Data ----------
const crew = ["Cmdr. Rivera", "Dr. Okafor", "Eng. Tanaka", "Spec. Haddad", "Hamza (Commander)"];
let seed = 7;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const days = Array.from({ length: 14 }, (_, i) => "D" + (i + 1));
const series = (b, v) => days.map(() => +(b + (rnd() - 0.5) * v).toFixed(1));

const data = {};
crew.forEach((n, i) => {
  data[n] = {
    hr: series(68 + (i % 4) * 6, 14),
    spo2: series(98 - (i % 4) * 0.7, 4),
    sys: series(118 + (i % 4) * 5, 14),
    dia: series(77 + (i % 4) * 3, 10),
    glu: series(100 + (i % 4) * 10, 40),
    fluid: series(2300 - (i % 4) * 180, 700),
    sleep: series(7.5 - (i % 4) * 0.4, 2),
    rad: series(0.6 + (i % 4) * 0.05, 0.3),
    ex: series(55, 40),
    cog: series(85 - (i % 4) * 3, 20),
    symptom: i === 3 // Spec. Haddad demo flag
  };
});

const ENVV = {
  spacecraft: { 'Cabin temperature (C)': 22.4, 'Oxygen (%)': 20.9, 'CO2 (mmHg)': 3.2, 'Humidity (%)': 45, 'Pressure (kPa)': 101.3, 'Radiation (mSv/day)': 0.7 },
  earth: { 'Cabin temperature (C)': 21.0, 'Oxygen (%)': 20.9, 'CO2 (mmHg)': 0.3, 'Humidity (%)': 50, 'Pressure (kPa)': 101.3, 'Radiation (mSv/day)': 0.007 }
};

// ---------- Prototype Classification Rules ----------
function hrStat(v, sym) {
  if (sym) return ["Critical", "Symptoms present: stop activity, contact medical officer."];
  if (v < 60) return ["Below", "Recheck; compare with personal baseline."];
  if (v > 100) return ["Above", "Rest, hydrate, recheck in 10-15 min."];
  return ["Normal", "Continue monitoring."];
}

function spoStat(v) {
  if (v <= 92) return ["Critical", "Alert medical officer; follow approved protocol."];
  if (v <= 94) return ["Below", "Check sensor position and recheck."];
  return ["Normal", "Continue monitoring."];
}

function bpStat(s, d) {
  if (s <= 90 || d <= 60) return ["Below", "Sit or lie down, hydrate, report symptoms."];
  if (s >= 140 || d >= 90) return ["Above", "Stage 2: rest, recheck, report to medical officer."];
  if (s >= 130 || d >= 80) return ["Above", "Stage 1: monitor and review lifestyle."];
  return ["Normal", "Continue monitoring."];
}

function gluStat(v) {
  if (v >= 240) return ["Critical", "Contact medical officer immediately."];
  if (v < 70) return ["Below", "Follow approved hypoglycemia protocol; recheck in 15 min."];
  if (v > 130) return ["Above", "Review plan, hydration and activity; recheck."];
  return ["Normal", "Continue monitoring."];
}

const last = a => a[a.length - 1];

function vitals(n) {
  const d = data[n];
  return [
    ["Heart rate (BPM)", "hr", last(d.hr), hrStat(last(d.hr), d.symptom), "60-100"],
    ["SpO2 (%)", "spo2", last(d.spo2), spoStat(last(d.spo2)), "95-100"],
    ["Systolic (mmHg)", "sys", last(d.sys), bpStat(last(d.sys), last(d.dia)), "below 130 / 80"],
    ["Blood glucose (mg/dL)", "glu", last(d.glu), gluStat(last(d.glu)), "80-130 pre-meal"]
  ];
}

function alerts(n) {
  return vitals(n).filter(v => v[3][0] !== "Normal").map(v => ({ n, m: v[0] + ": " + v[2], s: v[3][0], a: v[3][1] }));
}

// ---------- Persistence (LocalStorage + Flask SQLite Bridge) ----------
const DB = {
  g(k, d) {
    try {
      const v = localStorage.getItem("ahm_" + k);
      return v ? JSON.parse(v) : d;
    } catch (e) { return d; }
  },
  s(k, v) {
    try { localStorage.setItem("ahm_" + k, JSON.stringify(v)); } catch (e) {}
  }
};

const now = () => Date.now();
const fmt = t => new Date(t).toLocaleString();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LBL = { Normal: "Normal", Below: "Below Normal", Above: "Above Normal", Critical: "Critical" };

// ---------- 12 Health Indicators Definition ----------
const IND = [
  ["hr", "Resting heart rate", "60-100 BPM", "Below 60 BPM (compare with baseline)", "Above 100 BPM", "Abnormal rate with chest pain, shortness of breath, fainting or confusion", "Stress, fever, dehydration, recent activity. Low rates can be normal in fit people.", "Recheck, compare with baseline, rest, alert medical personnel when indicated.", [["72 BPM", "Normal", "Normal"], ["54 BPM", "Below", "Below Normal"], ["112 BPM", "Above", "Above Normal"], ["118 BPM with chest pain", "Critical", "Critical"]]],
  ["bal", "Balance", "Within personal baseline", "Below baseline (e.g. under 5th percentile)", "Better than baseline", "Fall, near-fall, or unable to complete assessment", "Inner-ear adaptation, fatigue, neurological or musculoskeletal issues.", "Rest, avoid hazardous tasks, repeat test, request medical exam for critical events.", [["Within baseline", "Normal", "Normal"], ["Below 5th percentile", "Below", "Below Normal"], ["Better than baseline", "Above", "Above Normal"], ["Near-fall", "Critical", "Critical"]]],
  ["hyd", "Hydration", "Assigned target (2500 mL) achieved", "Intake below target", "Intake above target", "Suspected serious dehydration or fluid imbalance symptoms", "Fatigue, dizziness, reduced performance.", "Follow assigned fluid plan and reminders. Do not drink excessively. Alert mission control for symptoms.", [["2500 / 2500 mL", "Normal", "Normal"], ["1700 / 2500 mL", "Below", "Below Normal"], ["3300 / 2500 mL", "Above", "Above Normal"], ["Dizziness and confusion", "Critical", "Critical"]]],
  ["glu", "Blood sugar", "80-130 mg/dL before meals", "Below 70 mg/dL", "Above 130 pre-meal or 180+ two hours after a meal", "Low: seizure, unconsciousness, cannot swallow. High: 240+ mg/dL", "Shakiness, confusion (low); thirst, fatigue (high).", "Follow the approved hypoglycemia/hyperglycemia protocol and contact medical personnel. Never calculate insulin doses.", [["95 mg/dL pre-meal", "Normal", "Normal"], ["64 mg/dL", "Below", "Below Normal"], ["152 mg/dL pre-meal", "Above", "Above Normal"], ["190 mg/dL two hours after meal", "Above", "Above Normal"], ["245 mg/dL", "Critical", "Critical High"], ["Unconscious", "Critical", "Critical Low"]]],
  ["bp", "Blood pressure", "About 120/80 mmHg", "Systolic 90 or less, or diastolic 60 or less", "Stage 1: 130-139 / 80-89. Stage 2: 140+ / 90+ (use higher category)", "Severe symptoms or concerning readings", "Headache, dizziness, cardiovascular strain.", "Rest, recheck, report to the medical officer. Sit or lie down if low.", [["118/78 mmHg", "Normal", "Normal"], ["134/82 mmHg", "Above", "Above Normal - Stage 1"], ["150/95 mmHg", "Above", "Above Normal - Stage 2"], ["88/58 mmHg", "Below", "Below Normal"], ["180/120 with severe headache", "Critical", "Critical"]]],
  ["spo2", "Blood oxygen (SpO2)", "95-100%", "93-94%", "n/a", "92% or below", "Possible cabin atmosphere or circulation concerns, or sensor error.", "Check sensor placement, repeat, alert the medical officer and follow the approved protocol.", [["98%", "Normal", "Normal"], ["94%", "Below", "Below Normal"], ["92%", "Critical", "Critical"], ["91%", "Critical", "Critical"]]],
  ["bone", "Bone density", "T-score -1 or higher, or stable baseline", "T-score between -1 and -2.5", "n/a", "Suspected fracture, severe bone pain, or loss beyond mission limits", "Microgravity bone loss and fracture risk.", "Follow approved bone-health exercise and nutrition plan; request medical assessment where indicated.", [["T-score -0.4", "Normal", "Normal"], ["T-score -1.8", "Below", "Below Normal"], ["T-score -2.7", "Below", "Very low"], ["Suspected fracture", "Critical", "Critical"]]],
  ["ex", "Daily exercise", "Prescribed session completed", "Session not completed", "Exceeds prescribed volume or intensity", "Chest pain, fainting, severe breathlessness, or injury", "Muscle and bone loss if sessions are missed; overtraining if exceeded.", "Follow the prescribed plan, record reason for missed sessions, monitor recovery.", [["45 min completed", "Normal", "Normal"], ["Session skipped", "Below", "Below Normal"], ["90 min, above plan", "Above", "Above Normal"], ["Chest pain during session", "Critical", "Critical"]]],
  ["sleep", "Sleep", "7-9 hours", "Under 7 hours", "Over 9 hours", "Prolonged inability to sleep, microsleeps, confusion, daytime impairment", "Fatigue, reduced attention, impaired recovery.", "Review sleep routine, workload, stress and repeated deficiency.", [["8 h", "Normal", "Normal"], ["5 h", "Below", "Below Normal"], ["10.5 h", "Above", "Above Normal"], ["Microsleeps and confusion", "Critical", "Critical"]]],
  ["temp", "Body temperature", "Near personal baseline for the method used", "Below clinician-approved hypothermia threshold", "Above clinician-approved fever threshold", "High or low reading with confusion or other severe symptoms", "Infection, heat stress. Thresholds differ by method and location.", "Record time, method and location; recheck with the same method; report per medical protocol.", [["36.7 C oral (baseline 36.6)", "Normal", "Normal"], ["Well below baseline", "Below", "Below Normal"], ["Above fever threshold", "Above", "Above Normal"], ["Fever with confusion", "Critical", "Critical"]]],
  ["mood", "Mood and stress", "Stable self-reported mood", "Increased stress, loneliness, low mood, irritability", "Significant change from personal baseline", "Serious behavioral or psychological concerns", "Isolation, workload, sleep loss.", "Offer rest, peer support, psychological consultation and the approved escalation procedure.", [["Stable mood", "Normal", "Normal"], ["Loneliness, low motivation", "Below", "Below Normal"], ["Large change from baseline", "Above", "Above Normal"], ["Serious behavioral concerns", "Critical", "Critical"]]],
  ["rad", "Radiation exposure", "0-0.9 mSv/day", "n/a", "0.9-1.3 mSv/day (notify mission control)", "Above 1.3 mSv/day (dangerous)", "Higher cumulative dose and long-term health risk.", "Normal: continue monitoring. Above normal: notify mission control. Dangerous: activate radiation emergency procedures.", [["0.6 mSv/day", "Normal", "Normal"], ["1.0 mSv/day", "Above", "Above Normal"], ["1.5 mSv/day", "Critical", "Dangerous"]]]
];

const BLK = { hr: 'hr', spo2: 'spo2', bp: 'sys', glu: 'glu', sleep: 'sleep', hyd: 'fluid', ex: 'ex', rad: 'rad' };

function cur(k, n) {
  const d = data[n], i = IND.find(x => x[0] === k);
  let c, rd;
  if (k === "hr") { c = hrStat(last(d.hr), d.symptom)[0]; rd = last(d.hr) + " BPM"; }
  else if (k === "spo2") { c = spoStat(last(d.spo2))[0]; rd = last(d.spo2) + "%"; }
  else if (k === "bp") { c = bpStat(last(d.sys), last(d.dia))[0]; rd = Math.round(last(d.sys)) + "/" + Math.round(last(d.dia)) + " mmHg"; }
  else if (k === "glu") { c = gluStat(last(d.glu))[0]; rd = Math.round(last(d.glu)) + " mg/dL"; }
  else if (k === "sleep") { const v = last(d.sleep); c = v < 7 ? "Below" : v > 9 ? "Above" : "Normal"; rd = v + " h"; }
  else if (k === "hyd") { const v = Math.round(last(d.fluid)); c = v < 2500 ? "Below" : v > 2500 ? "Above" : "Normal"; rd = v + " / 2500 mL"; }
  else if (k === "rad") { const v = last(d.rad); c = v <= 0.9 ? "Normal" : v <= 1.3 ? "Above" : "Critical"; rd = v + " mSv/day"; }
  else if (k === "ex") { const v = Math.round(last(d.ex)); c = v < 45 ? "Below" : v > 60 ? "Above" : "Normal"; rd = v + " min (prescribed 45)"; }
  else { const s = i[8][0]; return [s[0], s[1], LBL[s[1]]]; }
  return [rd, c, LBL[c]];
}

function pushAlert(n, ind, val, cls, act, key) {
  const a = DB.g("alerts", []);
  if (key && a.some(x => x.key === key)) return;
  a.unshift({ id: now() + Math.random(), key, n, ind, val, cls, act, t: now(), st: "Open" });
  DB.s("alerts", a);
}

function checkMeds() {
  const rx = DB.g("rx", []), lg = DB.g("rxlog", {}), d = new Date(), ds = d.toDateString();
  rx.forEach(r => {
    const [h, m] = r.time.split(":"), due = new Date();
    due.setHours(+h, +m + 60, 0, 0);
    if (d > due && !lg[r.id + ds]) {
      pushAlert(r.n, "Medication confirmation missed", r.med + " due " + r.time, "Above", "Notify medical officer: confirmation not received.", "m" + r.id + ds);
    }
  });
}

function syncAlerts() {
  const d = new Date().toDateString();
  crew.forEach(n => IND.forEach(i => {
    const r = cur(i[0], n);
    if (r[1] !== "Normal") pushAlert(n, i[1], r[0], r[1], i[7], n + i[0] + d);
  }));
  checkMeds();
}

const col = () => isDark() ? { t: "#e8f2ff", g: "rgba(155,180,216,.15)" } : { t: "#0f172a", g: "rgba(15,23,42,.1)" };

function lc(id, label, arr, color) {
  const c = col();
  const el = document.getElementById(id);
  if (!el) return null;
  return new Chart(el, {
    type: "line",
    data: {
      labels: arr.map((_, i) => i + 1),
      datasets: [{ label, data: arr, borderColor: color, backgroundColor: color + "22", fill: true, tension: 0.3 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: c.t } } },
      scales: { x: { ticks: { color: c.t }, grid: { color: c.g } }, y: { ticks: { color: c.t }, grid: { color: c.g } } }
    }
  });
}

function chart(id, label, arr, color, extra) {
  const c = col();
  const el = document.getElementById(id);
  if (!el) return null;
  const ch = new Chart(el, {
    type: "line",
    data: {
      labels: days,
      datasets: [{ label, data: arr, borderColor: color, backgroundColor: color + "33", fill: true, tension: 0.35, pointRadius: 2 }].concat(extra || [])
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: c.t } } },
      scales: { x: { ticks: { color: c.t }, grid: { color: c.g } }, y: { ticks: { color: c.t }, grid: { color: c.g } } }
    }
  });
  charts.push(ch);
}

const card = (id, title) => `<div class="glass"><b>${title}</b><canvas id="${id}"></canvas></div>`;
const badge = s => `<span class="badge ${s}">${s}</span>`;
const bd = c => `<span class='badge ${c}'>${LBL[c]}</span>`;
const DS = k => 'Simulated Data' + (['hr', 'spo2', 'sleep', 'ex'].includes(k) ? ' (WHOOP & Sensor supported)' : '');

const AV = {
  Normal: ['Skipping scheduled checks.', 'Not required', 'No'],
  Critical: ['Continuing the activity; self-treating beyond the approved protocol.', 'Immediately', 'Yes, urgent'],
  Below: ['Hazardous tasks and strenuous activity until rechecked; never self-adjust medication.', 'If readings persist or symptoms develop', 'Logged for review']
};
AV.Above = [AV.Below[0], AV.Below[1], 'Yes'];

function bindCf() {
  document.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => {
    const l = DB.g("rxlog", {});
    l[b.dataset.cf + new Date().toDateString()] = now();
    DB.s("rxlog", l);
    show(page);
  });
}

function panel(i, r, n, live) {
  const rx = DB.g("rx", []).filter(x => x.n === n && x.ind === i[0]), lg = DB.g("rxlog", {}), ds = new Date().toDateString(), kk = BLK[i[0]];
  const med = rx.length ? rx.map(x => `<div class="msg"><b>${esc(x.med)}</b> ${esc(x.dose)}, ${esc(x.freq)}, scheduled ${esc(x.time)}<br>${esc(x.notes)}<br>Today: ${lg[x.id + ds] ? "Taken " + fmt(lg[x.id + ds]) : "Not yet confirmed"}${live && user.role === "astro" && !lg[x.id + ds] ? ` <button class="b" data-cf="${x.id}">Confirm taken</button>` : ""}</div>`).join("") : "<p class='mut'>No medication is currently assigned for this condition. Contact the medical officer for assessment.</p>";
  const bl = kk ? (data[n][kk].reduce((a, b) => a + b) / 14).toFixed(1) : "Established from baseline";
  return `<div class="glass"><h3 style="margin-top:0">${i[1]} ${badge(r[1])}</h3><div class="big">${r[0]}</div><p>Alert status: <b>${r[2]}</b>${r[1] !== "Normal" ? " (alert visible to mission control)" : ""}</p><p class="mut">Data source: ${DS(i[0])}</p><div class="wrap"><table><tr><td>Normal</td><td>${i[2]}</td></tr><tr><td>Below normal</td><td>${i[3]}</td></tr><tr><td>Above normal</td><td>${i[4]}</td></tr><tr><td>Critical</td><td>${i[5]}</td></tr><tr><td>Possible concerns</td><td>${i[6]}</td></tr><tr><td>Recommended action</td><td>${i[7]}</td></tr><tr><td>What to avoid</td><td>${AV[r[1]][0]}</td></tr><tr><td>Contact medical officer</td><td>${AV[r[1]][1]}</td></tr><tr><td>Alert mission control</td><td>${AV[r[1]][2]}</td></tr><tr><td>Personal baseline</td><td>${bl}</td></tr></table></div><h4>Medication (prescription database)</h4>${med}${live && kk ? '<canvas id="ih"></canvas>' : ""}<p class="mut">Prototype thresholds, subject to approval by qualified mission medical personnel.</p></div>`;
}

// ---------- Questionnaire & Mental Health ----------
const MQ = [
  ["mood", "Mood today (1 very low, 10 very good)"],
  ["stress", "How stressed do you feel? (1-10)"],
  ["anx", "Anxiety (1-10)"],
  ["lone", "Lonely or isolated recently? (1-10)"],
  ["fam", "Missed communicating with family? (1-10)"],
  ["slp", "Difficulty sleeping because of stress? (1-10)"],
  ["mot", "Lost motivation for daily activities? (1-10)"]
];

function mhClass(q, H) {
  const avg = [11 - q.mood, q.stress, q.anx, q.lone, q.fam, q.slp, q.mot].reduce((a, b) => a + b) / 7;
  if (q.risk || q.unsafe) return ["Critical", avg];
  const bl = H.length >= 3 ? H.reduce((s, x) => s + x.avg, 0) / H.length : null;
  if (avg >= 7 || (bl !== null && avg - bl >= 2.5)) return ["Above", avg];
  return [avg >= 4.5 ? "Below" : "Normal", avg];
}

// ---------- Relaxation & Audio ----------
let selInd = "hr", gm = 1, hch = null, selS = { k: "hr", i: -1, c: crew[0] }, EN = "forest", ac, ns;

function sound(on) {
  if (on) {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < d.length; i++) {
      l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = l * 3;
    }
    ns = ac.createBufferSource();
    ns.buffer = b;
    ns.loop = true;
    const g = ac.createGain();
    g.gain.value = 0.4;
    ns.connect(g);
    g.connect(ac.destination);
    ns.start();
  } else if (ns) {
    ns.stop();
    ns = null;
  }
}

const SC = {
  forest: "linear-gradient(#87ceeb,#cfe9c5 45%,#2e7d32 46%,#1b5e20)",
  ocean: "linear-gradient(#7ec8ff,#bfe6ff 40%,#0a5fb4 41%,#073b73)",
  sky: "linear-gradient(#4aa3f0,#e6f4ff)",
  earth: "radial-gradient(circle at 50% 135%,#39A9F5 0 38%,#1265C7 39% 48%,#0b1a3a 49%),#020611"
};

// ---------- Cognitive Games ----------
function fin(g, r) {
  const all = DB.g("cog", []), mine = all.filter(x => x.n === user.name && x.g === g), prev = mine[mine.length - 1], b = mine.slice(0, 3);
  all.push({ n: user.name, g, t: now(), ...r });
  DB.s("cog", all);
  const bl = b.length ? Math.round(b.reduce((s, x) => s + x.score, 0) / b.length) : null;
  const resEl = document.getElementById("gres");
  if (resEl) {
    resEl.innerHTML = `<div class="glass"><b>Results</b><p>Score <b>${r.score}</b> | Avg reaction ${r.rt} ms | Accuracy ${r.acc}% | Mistakes ${r.mist} | Difficulty ${r.diff} | Time ${r.time}s</p><p class="mut">Previous score: ${prev ? prev.score : "none"}. Baseline: ${bl === null ? "set by your first sessions" : bl + " (this session is " + (r.score >= bl ? "at or above" : "below") + " baseline)"}. Task-performance measure only.</p></div>`;
  }
  hist();

  // Forward to backend
  fetch('/api/cognitive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      astronaut_name: user.name,
      game_id: g,
      game_name: ["", "Reaction", "Memory", "Tracking"][g],
      score: r.score,
      rt: r.rt,
      acc: r.acc,
      mist: r.mist,
      diff: r.diff,
      rating: r.score >= (bl || 60) ? "Flight Ready" : "Fatigued"
    })
  }).catch(() => {});
}

function hist() {
  if (hch) { try { hch.destroy(); } catch (e) {} hch = null; }
  const hcEl = document.getElementById("hc");
  if (!hcEl) return;
  hch = lc("hc", "Score", DB.g("cog", []).filter(x => x.n === user.name && x.g === [0, 1, 3, 2][gm]).map(x => x.score), "#6955D9");
}

function g1() {
  document.getElementById("ga").innerHTML = `<p>Click the target as fast as you can. 6 trials.</p><div class="arena" id="ar"></div><button class="b" id="st" style="margin-top:10px">Start</button>`;
  document.getElementById("st").onclick = () => {
    const ar = document.getElementById("ar"), T = performance.now();
    let n = 0, rts = [], miss = 0, early = 0, live = false, t0 = 0, to, w;
    ar.onclick = () => { if (!live && w) early++; };
    const nx = () => {
      if (!ar.isConnected) return;
      if (n >= 6) {
        ar.innerHTML = "Done";
        w = 0;
        const a = rts.length ? Math.round(rts.reduce((x, y) => x + y) / rts.length) : 0;
        fin(1, { score: Math.round(Math.max(0, 1000 - a) * rts.length / 60), rt: a, acc: Math.round(rts.length / 6 * 100), mist: miss + early, diff: "Fixed", time: Math.round((performance.now() - T) / 1000) });
        return;
      }
      n++;
      ar.innerHTML = "Wait...";
      live = false;
      w = setTimeout(() => {
        if (!ar.isConnected) return;
        const d = document.createElement("div");
        d.className = "dot";
        d.style.left = Math.random() * 85 + "%";
        d.style.top = Math.random() * 80 + "%";
        ar.innerHTML = "";
        ar.appendChild(d);
        live = true;
        t0 = performance.now();
        d.onclick = e => {
          e.stopPropagation();
          rts.push(performance.now() - t0);
          clearTimeout(to);
          live = false;
          nx();
        };
        to = setTimeout(() => { miss++; live = false; nx(); }, 1500);
      }, 1000 + Math.random() * 2000);
    };
    nx();
  };
}

function g2() {
  const C = ["#39A9F5", "#6955D9", "#23D5F5", "#1265C7"], S = ["▲", "●", "■", "◆"];
  document.getElementById("ga").innerHTML = `<p>Watch the sequence, then repeat it. Three mistakes end the game.</p><div id="pad">${C.map((c, i) => `<button class="sq" data-s="${i}" style="background:${c}">${S[i]}</button>`).join("")}</div><button class="b" id="st">Start</button> <span id="lv" class="mut"></span>`;
  document.getElementById("st").onclick = () => {
    const pad = document.getElementById("pad");
    let seq = [0, 1, 2].map(() => Math.floor(Math.random() * 4)), pos = 0, showing = true, mist = 0, taps = 0, ok = 0, lastTap = 0, gaps = [];
    const T = performance.now();
    const play = () => {
      if (!pad.isConnected) return;
      showing = true;
      document.getElementById("lv").textContent = "Level " + seq.length;
      seq.forEach((s, i) => setTimeout(() => {
        const b = pad.children[s];
        b.classList.add("lit");
        setTimeout(() => b.classList.remove("lit"), 400);
      }, i * 700 + 500));
      setTimeout(() => { showing = false; pos = 0; lastTap = performance.now(); }, seq.length * 700 + 500);
    };
    const end = () => {
      showing = true;
      const a = gaps.length ? Math.round(gaps.reduce((x, y) => x + y) / gaps.length) : 0;
      fin(2, { score: Math.max(0, (seq.length - 1) * 100 - mist * 20), rt: a, acc: taps ? Math.round(ok / taps * 100) : 0, mist, diff: "Level " + seq.length, time: Math.round((performance.now() - T) / 1000) });
    };
    pad.onclick = e => {
      const b = e.target.closest("[data-s]");
      if (!b || showing) return;
      taps++;
      gaps.push(performance.now() - lastTap);
      lastTap = performance.now();
      if (+b.dataset.s === seq[pos]) {
        ok++;
        pos++;
        if (pos === seq.length) {
          if (seq.length >= 9) { end(); return; }
          showing = true;
          seq.push(Math.floor(Math.random() * 4));
          setTimeout(play, 700);
        }
      } else {
        mist++;
        if (mist >= 3) { end(); return; }
        showing = true;
        setTimeout(play, 900);
      }
    };
    play();
  };
}

function g3() {
  document.getElementById("ga").innerHTML = `<p>Memorize the 3 bright circles. They blend in and move. When they stop, click the 3 you memorized. 3 rounds.</p><canvas id="cv" width="640" height="300" style="width:100%;border:1px solid var(--bd);border-radius:12px;background:var(--bg2)"></canvas><button class="b" id="st">Start</button>`;
  document.getElementById("st").onclick = () => {
    const cv = document.getElementById("cv"), x = cv.getContext("2d"), T = performance.now();
    let R = 0, ok = 0, mist = 0, rts = [], B = [], t0 = 0, picks = 0, sym = [], ph = 0;
    const round = () => {
      if (!cv.isConnected) return;
      if (R >= 3) {
        const a = rts.length ? Math.round(rts.reduce((p, q) => p + q) / rts.length) : 0;
        x.clearRect(0, 0, 640, 300);
        fin(3, { score: Math.max(0, ok * 100 - mist * 30), rt: a, acc: Math.round(ok / 9 * 100), mist, diff: "Level 3 of 3", time: Math.round((performance.now() - T) / 1000) });
        return;
      }
      R++; picks = 0; t0 = 0; ph = 0;
      B = Array.from({ length: 5 + R * 2 }, (_, i) => ({ x: 30 + Math.random() * 580, y: 30 + Math.random() * 240, a: Math.random() * 6.28, t: i < 3, p: false }));
      const sp = 1 + R * 0.9, st = performance.now();
      const f = () => {
        if (!cv.isConnected) return;
        const e = performance.now() - st;
        x.clearRect(0, 0, 640, 300);
        ph = e < 2000 ? 0 : e < 7000 ? 1 : 2;
        if (ph === 1 && Math.floor(e / 400) !== Math.floor((e - 17) / 400)) {
          sym = Array.from({ length: 6 }, () => ({ x: Math.random() * 620, y: Math.random() * 290, c: "▲●■✦"[Math.floor(Math.random() * 4)] }));
        }
        if (ph === 1) {
          B.forEach(b => {
            b.x += Math.cos(b.a) * sp;
            b.y += Math.sin(b.a) * sp;
            if (b.x < 16 || b.x > 624) b.a = Math.PI - b.a;
            if (b.y < 16 || b.y > 284) b.a = -b.a;
          });
        }
        x.font = "20px sans-serif";
        x.fillStyle = "#6955D9";
        if (ph === 1) sym.forEach(s => x.fillText(s.c, s.x, s.y));
        B.forEach(b => {
          x.beginPath();
          x.arc(b.x, b.y, 16, 0, 6.28);
          x.fillStyle = b.p ? "#d93a4a" : (ph === 0 && b.t ? "#23D5F5" : "#39A9F5");
          x.fill();
        });
        if (ph === 2 && !t0) t0 = performance.now();
        if (ph < 2 || picks < 3) requestAnimationFrame(f);
      };
      f();
      cv.onclick = ev => {
        if (ph !== 2 || picks >= 3) return;
        const r = cv.getBoundingClientRect(), px = (ev.clientX - r.left) * 640 / r.width, py = (ev.clientY - r.top) * 300 / r.height;
        const b = B.find(b => !b.p && Math.hypot(b.x - px, b.y - py) < 20);
        if (!b) return;
        b.p = true;
        picks++;
        if (picks === 1) rts.push(performance.now() - t0);
        if (b.t) ok++; else mist++;
        if (picks === 3) setTimeout(round, 600);
      };
    };
    round();
  };
}

// ---------- ASTRA Pages Dictionary ----------
const NEW = {};

NEW.game = me => [
  `<h1>Cognitive Assessment Games</h1><p class="mut">Task-performance assessment batteries for spaceflight readiness.</p><div class="tabs">${["Game 1: Simple reaction", "Game 2: Spatial Tracking", "Game 3: Sequence Memory"].map((t, i) => `<button class="${gm === i + 1 ? "on" : ""}" data-g="${i + 1}">${t}</button>`).join("")}</div><div class="glass" id="ga"></div><div id="gres" style="margin:14px 0"></div><div class="glass"><b>Score History</b><canvas id="hc"></canvas></div>`,
  () => {
    document.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { gm = +b.dataset.g; show("game"); });
    [0, g1, g3, g2][gm]();
    hist();
  }
];

NEW.cog = me => {
  const C = DB.g("cog", []);
  return [
    `<h1>Cognitive Performance Records</h1><div class="glass wrap"><table><tr><th>Time</th><th>Astronaut</th><th>Game</th><th>Score</th><th>Avg RT ms</th><th>Accuracy</th><th>Mistakes</th><th>Difficulty</th></tr>${C.slice().reverse().map(x => `<tr><td>${fmt(x.t)}</td><td>${x.n}</td><td>${["", "Reaction", "Memory", "Tracking"][x.g]}</td><td>${x.score}</td><td>${x.rt}</td><td>${x.acc}%</td><td>${x.mist}</td><td>${x.diff}</td></tr>`).join("") || "<tr><td>No sessions yet</td></tr>"}</table></div><div class="glass" style="margin-top:14px">${card("c1", "Scores across sessions")}</div>`,
    () => charts.push(lc("c1", "Score", C.map(x => x.score), "#6955D9"))
  ];
};

NEW.ind = me => {
  const i = IND.find(x => x[0] === selInd), r = cur(i[0], me);
  return [
    `<h1>Health Indicators</h1><div class="grid">${IND.map(x => { const c = cur(x[0], me); return `<div class="glass" style="cursor:pointer;padding:12px" data-i="${x[0]}"><span class="mut">${x[1]}</span><br><b>${c[0]}</b> ${badge(c[1])}</div>`; }).join("")}</div>${panel(i, r, me, true)}`,
    () => {
      document.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { selInd = b.dataset.i; show("ind"); });
      bindCf();
      if (document.getElementById("ih")) charts.push(lc("ih", i[1], data[me][BLK[i[0]]], "#23D5F5"));
    }
  ];
};

NEW.scen = me => {
  const n = me || selS.c, i = IND.find(x => x[0] === selS.k), sc = i[8][selS.i];
  let h = `<h1>Health Scenario Examples</h1><div class="glass"><p class="mut">Simulated clinical conditions showing how classification, recommendations, medication lookup and alerts respond.</p><select id="sk">${IND.map(x => `<option value="${x[0]}" ${x[0] === selS.k ? "selected" : ""}>${x[1]}</option>`).join("")}</select>${me ? "" : `<select id="sc">${crew.map(c => `<option ${c === selS.c ? "selected" : ""}>${c}</option>`).join("")}</select>`}<div class="tabs">${i[8].map((s, j) => `<button class="${j === selS.i ? "on" : ""}" data-si="${j}">${s[0]}</button>`).join("")}</div></div>`;
  if (sc) h += `<div style="margin-top:14px">${panel(i, sc, n, false)}</div>`;
  return [
    h,
    () => {
      document.getElementById("sk").onchange = e => { selS.k = e.target.value; selS.i = -1; show("scen"); };
      if (document.getElementById("sc")) document.getElementById("sc").onchange = e => { selS.c = e.target.value; show("scen"); };
      document.querySelectorAll("[data-si]").forEach(b => b.onclick = () => {
        selS.i = +b.dataset.si;
        const s = i[8][selS.i];
        if (s[1] !== "Normal") pushAlert(n, i[1] + " (simulated scenario)", s[0], s[1], i[7], "s" + now());
        show("scen");
      });
    }
  ];
};

NEW.alerts = me => {
  checkMeds();
  const A = DB.g("alerts", []).filter(a => !me || a.n === me);
  return [
    `<h1>${me ? "My Alerts" : "Mission Alert Center"}</h1><div class="glass wrap"><table><tr><th>Time</th>${me ? "" : "<th>Astronaut</th>"}<th>Indicator</th><th>Value</th><th>Class</th><th>Recommended action</th><th>Status</th>${me ? "" : "<th>Actions</th>"}</tr>${A.map(a => `<tr><td>${fmt(a.t)}</td>${me ? "" : `<td>${a.n}</td>`}<td>${esc(a.ind)}</td><td>${esc(a.val)}</td><td>${badge(a.cls)}</td><td>${esc(a.act)}</td><td>${a.st}</td>${me ? "" : `<td>${a.st === "Open" ? `<button class="b" data-a="${a.id}" data-as="Acknowledged">Ack</button> ` : ""}${a.st !== "Resolved" ? `<button class="b" data-a="${a.id}" data-as="Resolved">Resolve</button>` : ""}</td>`}</tr>`).join("") || "<tr><td>No active alerts. All parameters nominal.</td></tr>"}</table></div>`,
    () => document.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      const all = DB.g("alerts", []), x = all.find(y => String(y.id) === b.dataset.a);
      if (x) x.st = b.dataset.as;
      DB.s("alerts", all);
      show("alerts");
    })
  ];
};

NEW.med = me => {
  const rx = DB.g("rx", []).filter(r => !me || r.n === me), lg = DB.g("rxlog", {}), ds = new Date().toDateString();
  const row = r => {
    const t = lg[r.id + ds];
    return `<tr>${me ? "" : `<td>${r.n}</td>`}<td>${esc((IND.find(i => i[0] === r.ind) || [0, r.ind])[1])}</td><td>${esc(r.med)}</td><td>${esc(r.dose)}</td><td>${esc(r.freq)}</td><td>${esc(r.time)}</td><td>${esc(r.notes || '')}</td><td>${t ? "Taken " + fmt(t) : "Not confirmed"}${me && !t ? ` <button class="b" data-cf="${r.id}">Confirm</button>` : ""}${me ? "" : ` <button class="b" data-rm="${r.id}">Remove</button>`}</td></tr>`;
  };
  const form = me ? "" : `<div class="glass" style="margin-bottom:14px"><b>Enter Prescription (Authorized Flight Surgeon Console)</b><p class="mut">System never prescribes autonomously. Human-in-the-loop validation only.</p><select id="rn">${crew.map(c => `<option>${c}</option>`).join("")}</select><select id="ri">${IND.map(i => `<option value="${i[0]}">${i[1]}</option>`).join("")}</select><input id="rm" placeholder="Medication name"><input id="rd" placeholder="Dosage (e.g. 1000 IU)"><input id="rt" type="time"><input id="rf" placeholder="Frequency (e.g. Daily)"><input id="ro" placeholder="Instructions"><button class="b b-prim" id="ra">Add Prescription</button></div>`;
  return [
    `<h1>${me ? "My Medication Schedule" : "Prescriptions & Adherence"}</h1>${form}<div class="glass wrap"><table><tr>${me ? "" : "<th>Astronaut</th>"}<th>Condition</th><th>Medication</th><th>Dose</th><th>Frequency</th><th>Time</th><th>Instructions</th><th>Status today</th></tr>${rx.map(row).join("") || "<tr><td>No prescriptions assigned. Contact medical officer for assessment.</td></tr>"}</table></div>`,
    () => {
      bindCf();
      if (document.getElementById("ra")) {
        document.getElementById("ra").onclick = () => {
          const v = id => document.getElementById(id).value.trim();
          if (!v("rm") || !v("rd") || !v("rt") || !v("rf")) return;
          const a = DB.g("rx", []);
          a.push({ id: now(), n: v("rn"), ind: v("ri"), med: v("rm"), dose: v("rd"), time: v("rt"), freq: v("rf"), notes: v("ro") });
          DB.s("rx", a);
          show("med");
        };
      }
      document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
        DB.s("rx", DB.g("rx", []).filter(r => String(r.id) !== b.dataset.rm));
        show("med");
      });
    }
  ];
};

NEW.mind = me => {
  const H = DB.g("mh", []).filter(x => x.n === me), jr = DB.g("jr_" + me, []), lt = H[H.length - 1];
  const act = {
    Normal: "Continue daily monitoring and maintain regular communication.",
    Below: "Consider a rest period, contact family or crew, and speak with an Earth-based specialist.",
    Above: "A support professional has been notified to review your circumstances.",
    Critical: "Immediately activate the approved mission behavioral-health escalation procedure."
  };
  return [
    `<h1>Mental Health & Well-being</h1><div class="glass"><b>Daily Check-in</b> <span class="mut">Private screening. Mission control receives classification only.</span>${MQ.map(q => `<p style="margin:8px 0">${q[1]}<br><input type="range" min="1" max="10" value="5" id="q_${q[0]}" oninput="this.nextElementSibling.textContent=this.value" style="width:200px;margin-right:10px"><b>5</b></p>`).join("")}${[["spec", "I would like to speak with a mental health specialist"], ["sup", "I need additional support today"], ["unsafe", "I cannot safely perform essential activities"], ["risk", "I am at immediate risk of harming myself or others"]].map(c => `<label style="display:block;margin:4px 0"><input type="checkbox" id="q_${c[0]}" style="width:auto;margin-right:8px"> ${c[1]}</label>`).join("")}<p style="margin-top:12px"><button class="b b-prim" id="sub">Submit Check-in</button></p><div id="mres">${lt ? `<div class="alert">Last result: ${badge(lt.cls)} ${act[lt.cls]}</div>` : ""}</div></div><div class="grid" style="margin-top:14px">${card("c1", "Concern Index History")}<div class="glass"><b>Private Mission Journal</b> <span class="mut">Local encrypted log.</span><textarea id="jt" placeholder="Reflections on today's mission..."></textarea><button class="b" id="jb" style="margin-top:8px">Save Entry</button>${jr.slice(-3).reverse().map(j => `<div class="msg"><span class="mut">${fmt(j.t)}</span><br>${esc(j.x)}</div>`).join("")}</div></div>`,
    () => {
      charts.push(lc("c1", "Concern index", H.map(x => +x.avg.toFixed(1)), "#6955D9"));
      document.getElementById("sub").onclick = () => {
        const q = {};
        MQ.forEach(x => q[x[0]] = +document.getElementById("q_" + x[0]).value);
        ["spec", "sup", "unsafe", "risk"].forEach(k => q[k] = document.getElementById("q_" + k).checked);
        const [c, avg] = mhClass(q, H), all = DB.g("mh", []);
        all.push({ n: me, t: now(), q, avg, cls: c });
        DB.s("mh", all);
        if (c !== "Normal") pushAlert(me, "Mental well-being check-in", "Status " + LBL[c] + (q.spec || q.sup ? "; support requested" : ""), c, act[c]);
        document.getElementById("mres").innerHTML = `<div class="alert">${badge(c)} ${act[c]}<br><span class="mut">Self-report screening completed.</span></div>`;
      };
      document.getElementById("jb").onclick = () => {
        const v = document.getElementById("jt").value.trim();
        if (!v) return;
        jr.push({ t: now(), x: v });
        DB.s("jr_" + me, jr);
        show("mind");
      };
    }
  ];
};

NEW.support = me => {
  const dl = DB.g("delay", 1.2), M = DB.g("msgs", []), ar = m => m.sent + m.delay * 60000, st = m => now() < ar(m) ? "In transit, not yet received" : "Delivered " + fmt(ar(m));
  let h = `<h1>${me ? "Earth-Based Psychological Support" : "Support Inbox"}</h1>`;
  if (me) {
    const mine = M.filter(m => m.n === me), inb = mine.filter(m => m.dir === "down" && now() >= ar(m)), tr = mine.filter(m => m.dir === "down" && now() < ar(m)).length, up = mine.filter(m => m.dir === "up");
    h += `<div class="glass"><b>Configured Signal Delay (minutes)</b><input id="dl" type="number" step="0.1" min="0" value="${dl}"><p class="mut">Interplanetary transmission latency. Real space missions feature minutes of delay each way.</p><textarea id="mt" placeholder="Secure transmission to Earth Flight Surgeon..."></textarea><button class="b b-prim" id="ms">Send Message</button> <button class="b" id="rf">Refresh Inbox</button></div><div class="glass" style="margin-top:14px"><b>Transmissions Log</b>${up.slice().reverse().map(m => `<div class="msg">${esc(m.text)}<br><span class="mut">Sent ${fmt(m.sent)} | Delay ${m.delay} min | ${st(m)}</span></div>`).join("") || "<p class='mut'>No outgoing messages.</p>"}${up.length && !inb.length ? "<p><b>Pending specialist response...</b></p>" : ""}${tr ? `<p class="mut">${tr} response in transit to the spacecraft</p>` : ""}${inb.map(m => `<div class="msg"><b>Ground Surgeon</b>: ${esc(m.text)}<br><span class="mut">Sent ${fmt(m.sent)}, received ${fmt(ar(m))}</span></div>`).join("")}</div><div class="glass" style="margin-top:14px"><b>Scheduled Consultations</b><input id="cw" type="datetime-local"><button class="b" id="cb" style="margin-top:6px">Request Consultation</button>${DB.g("cons", []).filter(c => c.n === me).map(c => `<div class="msg">${esc(c.w)}: ${c.st}</div>`).join("")}</div><div class="alert">Emergency: In acute flight medical crises, execute autonomous onboard protocols immediately. Do not wait for Earth transmission.</div>`;
  } else {
    const inc = M.filter(m => m.dir === "up" && now() >= ar(m)), tr = M.filter(m => m.dir === "up" && now() < ar(m)).length;
    h += `<div class="glass"><b>Messages Received from Flight Crew</b> ${tr ? `<span class="mut">(${tr} still in transit)</span>` : ""}${inc.map(m => `<div class="msg"><b>${m.n}</b>: ${esc(m.text)}<br><span class="mut">Received ${fmt(ar(m))}</span></div>`).join("") || "<p class='mut'>None received yet.</p>"}<select id="rn">${crew.map(c => `<option>${c}</option>`).join("")}</select><textarea id="rt" placeholder="Reply to astronaut (travels with transmission delay)..."></textarea><button class="b b-prim" id="rs">Send Delayed Reply</button> <button class="b" id="rf">Refresh</button></div><div class="glass" style="margin-top:14px"><b>Crew Consultation Requests</b>${DB.g("cons", []).map((c, i) => `<div class="msg">${c.n}: ${esc(c.w)} (${c.st})${c.st === "Requested" ? ` <button class="b" data-cc="${i}">Confirm</button>` : ""}</div>`).join("") || "<p class='mut'>No pending requests.</p>"}</div>`;
  }
  const E = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  return [
    h,
    () => {
      E("rf", () => show("support"));
      E("ms", () => {
        const t = document.getElementById("mt").value.trim(), d = +document.getElementById("dl").value || 0;
        if (!t) return;
        DB.s("delay", d);
        M.push({ n: me, dir: "up", text: t, sent: now(), delay: d });
        DB.s("msgs", M);
        show("support");
      });
      E("cb", () => {
        const cw = document.getElementById("cw");
        if (!cw || !cw.value) return;
        const c = DB.g("cons", []);
        c.push({ n: me, w: cw.value, st: "Requested" });
        DB.s("cons", c);
        show("support");
      });
      E("rs", () => {
        const t = document.getElementById("rt").value.trim(), selN = document.getElementById("rn").value;
        if (!t) return;
        M.push({ n: selN, dir: "down", text: t, sent: now(), delay: dl });
        DB.s("msgs", M);
        show("support");
      });
      document.querySelectorAll("[data-cc]").forEach(b => b.onclick = () => {
        const c = DB.g("cons", []);
        c[+b.dataset.cc].st = "Confirmed";
        DB.s("cons", c);
        show("support");
      });
    }
  ];
};

NEW.earth = me => {
  const L = DB.g("earth", []).filter(x => x.n === me);
  return [
    `<h1>Earth Connection Mode</h1><div class="glass"><p class="mut">Sensory relaxation and psychological pacing environment for deep space crews.</p><div class="tabs">${Object.keys(SC).map(k => `<button class="${k === EN ? "on" : ""}" data-e="${k}">${k.toUpperCase()}</button>`).join("")}</div><div class="scene" style="background:${SC[EN]}"><div class="breath"></div><b style="position:absolute;bottom:14px;text-shadow:0 1px 6px #000;color:#fff">Inhale 4 s &bull; Hold 4 s &bull; Exhale 6 s</b></div><p><button class="b" id="eb">Log Relaxation Session</button> <button class="b" id="snd">Toggle Ambient Audio</button></p><p id="hp" style="margin-top:8px"></p></div><div class="glass" style="margin-top:14px"><b>Session History</b>${L.slice().reverse().map(x => `<div class="msg">${fmt(x.t)} | ${x.env} | Helped: ${x.helped || "Recorded"}</div>`).join("") || "<p class='mut'>No sessions logged yet.</p>"}</div>`,
    () => {
      document.querySelectorAll("[data-e]").forEach(b => b.onclick = () => { EN = b.dataset.e; show("earth"); });
      let on = false;
      document.getElementById("snd").onclick = () => { on = !on; sound(on); document.getElementById("snd").textContent = on ? "Stop Audio" : "Toggle Ambient Audio"; };
      document.getElementById("eb").onclick = () => {
        const a = DB.g("earth", []);
        a.push({ n: me, t: now(), env: EN });
        DB.s("earth", a);
        document.getElementById("hp").innerHTML = "Did it help? " + ["Yes", "Somewhat", "No"].map(v => `<button class="b" data-h="${v}">${v}</button>`).join(" ");
        document.querySelectorAll("[data-h]").forEach(b => b.onclick = () => {
          const arr = DB.g("earth", []);
          arr[arr.length - 1].helped = b.dataset.h;
          DB.s("earth", arr);
          show("earth");
        });
      };
    }
  ];
};

const sst = n => { const a = IND.map(i => cur(i[0], n)[1]); return a.includes('Critical') ? 'Critical' : a.some(x => x !== 'Normal') ? 'Above' : 'Normal'; };
const sb = n => { const s = sst(n); return `<span class='badge ${s}'>${s === 'Above' ? 'Needs attention' : s}</span>`; };
const mhs = n => { const H = DB.g('mh', []).filter(x => x.n === n); return H.length ? bd(H[H.length - 1].cls) : "<span class='mut'>No check-in yet</span>"; };
const cgs = n => { const C = DB.g('cog', []).filter(x => x.n === n); return C.length ? C[C.length - 1].score : '-'; };
let selProf = crew[0];
const tile = (x, n, go) => { const c = cur(x[0], n); return `<div class='glass' style='padding:12px;${go ? 'cursor:pointer' : ''}' ${go ? `data-i='${x[0]}'` : ''}><span class='mut'>${x[1]}</span><br><b style="font-size:1.15rem">${c[0]}</b> ${bd(c[1])}</div>`; };
const selCrew2 = (n, id) => `<select id='${id}'>${crew.map(c => `<option ${c === n ? 'selected' : ''}>${c}</option>`).join('')}</select>`;

NEW.dash = me => {
  if (me) {
    const i = crew.indexOf(me), al = DB.g('alerts', []).filter(a => a.n === me && a.st === 'Open'), rx = DB.g('rx', []).filter(r => r.n === me), lg = DB.g('rxlog', {}), ds = new Date().toDateString();
    const nxt = rx.length ? rx.map(r => `${esc(r.med)} ${esc(r.dose)} at ${esc(r.time)} (${lg[r.id + ds] ? 'taken' : 'due'})`).join('; ') : 'No medication assigned. Contact medical officer.';
    return [
      `<h1>ASTRA | ${me}</h1><div class='grid'><div class='glass'><span class='mut'>Astronaut ID</span><div class='big'>AST-00${i + 1}</div><span class='mut'>Mission ASTRA-1, Day ${42 + i}</span><br>${sb(me)}</div><div class='glass'><span class='mut'>Mental Status</span><div>${mhs(me)}</div><span class='mut'>Latest cognitive score: ${cgs(me)}</span></div><div class='glass'><span class='mut'>Medication Adherence</span><p style="margin-top:4px">${nxt}</p></div></div><div class='grid'>${IND.map(x => tile(x, me, 1)).join('')}</div><div class='glass'><b>Medical Guidance Advisory</b>${al.length ? al.slice(0, 4).map(a => `<div class='alert'>${esc(a.ind)}: ${esc(a.val)} (${LBL[a.cls]}). ${esc(a.act)}</div>`).join('') : "<p class='mut'>All indicators within nominal range.</p>"}</div><div class='grid' style='margin-top:14px'>${card('c1', 'Heart Rate (BPM, 14-Day Trend)')}${card('c2', 'Radiation Exposure (mSv/day)')}</div>`,
      () => {
        document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { selInd = b.dataset.i; show('ind'); });
        charts.push(lc('c1', 'BPM', data[me].hr, '#23D5F5'), lc('c2', 'mSv', data[me].rad, '#6955D9'));
      }
    ];
  }
  const A = DB.g('alerts', []).filter(a => a.st === 'Open'), cr = A.filter(a => a.cls === 'Critical').length, ok = crew.filter(n => sst(n) === 'Normal').length, ra = (crew.reduce((s, n) => s + last(data[n].rad), 0) / crew.length).toFixed(2);
  return [
    `<h1>ASTRA Ground Mission Control</h1><div class='grid'><div class='glass'><span class='mut'>Astronauts Monitored</span><div class='big'>${crew.length}</div></div><div class='glass'><span class='mut'>Normal Status</span><div class='big'>${ok}</div></div><div class='glass'><span class='mut'>Need Attention</span><div class='big'>${crew.length - ok}</div></div><div class='glass'><span class='mut'>Open Critical Alerts</span><div class='big'>${cr}</div></div><div class='glass'><span class='mut'>Mean Radiation</span><div class='big'>${ra} <span class="mut" style="font-size:1rem">mSv</span></div></div></div><div class='grid'>${crew.map(n => { const d = data[n]; return `<div class='glass'><b>${n}</b> <span class='mut'>AST-00${crew.indexOf(n) + 1}</span> ${sb(n)}<p style="margin:6px 0;font-size:0.88rem">HR ${last(d.hr)} | BP ${Math.round(last(d.sys))}/${Math.round(last(d.dia))} | SpO2 ${last(d.spo2)}%<br>Sleep ${last(d.sleep)} h | Fluid ${Math.round(last(d.fluid))} mL | Rad ${last(d.rad)} mSv</p>Mental: ${mhs(n)} | Cognitive: ${cgs(n)}<p style="margin-top:8px"><button class='b' data-pf='${n}'>Open Profile</button></p></div>`; }).join('')}</div><div class='glass'><b>Open Anomaly Alerts</b>${A.slice(0, 6).map(a => `<div class='alert'><b>${a.n}</b>: ${esc(a.ind)} ${esc(a.val)} ${bd(a.cls)}</div>`).join('') || "<p class='mut'>No active alerts.</p>"}<button class='b b-prim' id='ga2' style="margin-top:6px">Open Alert Center</button></div>`,
    () => {
      document.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { selProf = b.dataset.pf; show('crew'); });
      document.getElementById('ga2').onclick = () => show('alerts');
    }
  ];
};

NEW.crew = me => {
  const n = selProf;
  return [
    `<h1>Crew Profile & Physiological Record</h1>${selCrew2(n, 'pc')}<div class='glass' style='margin-top:10px'><b>${n}</b> &bull; AST-00${crew.indexOf(n) + 1} &bull; Status: ${sb(n)} &bull; Mental status: ${mhs(n)} <span class='mut'>(Answers and journal remain confidential)</span></div><div class='grid' style='margin-top:14px'>${IND.map(x => tile(x, n, 0)).join('')}</div><div class='grid'>${card('c1', 'Heart Rate 14-Day Curve')}${card('c2', 'Sleep Duration (Hours)')}</div>`,
    () => {
      document.getElementById('pc').onchange = e => { selProf = e.target.value; show('crew'); };
      charts.push(lc('c1', 'BPM', data[n].hr, '#23D5F5'), lc('c2', 'Hours', data[n].sleep, '#6955D9'));
    }
  ];
};

NEW.rad = me => {
  const n = me || selProf, d = data[n].rad, c = cur('rad', n), cum = d.reduce((a, b) => a + b).toFixed(1);
  return [
    `<h1>Radiation Dosimetry & Space Weather</h1>${me ? '' : selCrew2(n, 'pc')}<div class='grid'><div class='glass'><span class='mut'>Current Daily Exposure</span><div class='big'>${last(d)} mSv</div>${bd(c[1])}</div><div class='glass'><span class='mut'>14-Day Cumulative Dose</span><div class='big'>${cum} mSv</div></div></div><div class='glass wrap'><table><tr><td>Normal</td><td>0-0.9 mSv/day</td><td>Standard mission profile</td></tr><tr><td>Above Normal</td><td>0.9-1.3 mSv/day</td><td>Notify mission control, increase shielding</td></tr><tr><td>Dangerous</td><td>Above 1.3 mSv/day</td><td>Activate storm shelter / solar flare protocol</td></tr></table></div><div class='grid' style='margin-top:14px'>${card('c1', 'Daily Exposure vs Thresholds')}${card('c2', 'Radiation vs Sleep')}${card('c3', 'Radiation vs Cognitive Alertness')}</div>`,
    () => {
      if (document.getElementById('pc')) document.getElementById('pc').onchange = e => { selProf = e.target.value; show('rad'); };
      const a = lc('c1', 'mSv/day', d, '#23D5F5');
      if (a) {
        a.data.datasets.push(
          { label: '0.9 Threshold', data: d.map(() => 0.9), borderColor: '#e8a20c', pointRadius: 0, fill: false },
          { label: '1.3 Danger', data: d.map(() => 1.3), borderColor: '#ef4444', pointRadius: 0, fill: false }
        );
        a.update();
        charts.push(a);
      }
      [['c2', 'Sleep (h)', data[n].sleep], ['c3', 'Cognitive', data[n].cog]].forEach(x => {
        const b = lc(x[0], 'mSv/day', d, '#23D5F5');
        if (b) {
          b.data.datasets.push({ label: x[1], data: x[2], borderColor: '#6955D9', yAxisID: 'y1', fill: false });
          b.options.scales.y1 = { position: 'right', ticks: { color: col().t }, grid: { drawOnChartArea: false } };
          b.update();
          charts.push(b);
        }
      });
    }
  ];
};

NEW.env = me => {
  const m = DB.g('envmode', 'spacecraft'), H = DB.g('envh', []), V = ENVV[m], O = ENVV[m === 'earth' ? 'spacecraft' : 'earth'], ks = Object.keys(V);
  return [
    `<h1>Spacecraft Environment & ECLSS</h1><div class='glass'><p>Active Habitat Simulation: <b>${m === 'earth' ? 'Earth-like Atmosphere' : 'Spacecraft Standard Mode'}</b></p><button class='b b-prim' id='ea'>Activate Earth Simulation</button> <button class='b' id='sa'>Return to Spacecraft Mode</button></div><div class='grid' style='margin-top:14px'>${ks.map(k => `<div class='glass'><span class='mut'>${k}</span><div class='big'>${V[k]}</div><span class='mut'>${m === 'earth' ? 'Spacecraft' : 'Earth-like'}: ${O[k]}</span></div>`).join('')}</div><div class='glass'>${card('c1', 'Atmospheric Balance Comparison')}</div><div class='glass' style='margin-top:14px'><b>Mode Switch History</b>${H.slice().reverse().map(x => `<div class='msg'>${fmt(x.t)} | ${esc(x.by)} | ${x.mode}</div>`).join('') || "<p class='mut'>No mode changes logged.</p>"}</div>`,
    () => {
      const set = md => {
        DB.s('envmode', md);
        const h = DB.g('envh', []);
        h.push({ t: now(), by: user.name, mode: md });
        DB.s('envh', h);
        show('env');
      };
      document.getElementById('ea').onclick = () => set('earth');
      document.getElementById('sa').onclick = () => set('spacecraft');
      const c = col(), pick = o => [o[ks[0]], o[ks[1]], o[ks[3]]];
      charts.push(new Chart(document.getElementById('c1'), {
        type: 'bar',
        data: {
          labels: ['Temp C', 'O2 %', 'Humidity %'],
          datasets: [{ label: 'Spacecraft', data: pick(ENVV.spacecraft), backgroundColor: '#38bdf8' }, { label: 'Earth-like', data: pick(ENVV.earth), backgroundColor: '#22d3ee' }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: c.t } } },
          scales: { x: { ticks: { color: c.t }, grid: { color: c.g } }, y: { ticks: { color: c.t }, grid: { color: c.g } } }
        }
      }));
    }
  ];
};

NEW.fit = me => {
  const L = DB.g('fit_' + me, []);
  return [
    `<h1>Fitness & Microgravity Countermeasures</h1><div class='glass'><p class='mut'>Aerobic and resistive exercise protocol logging.</p><select id='ft'>${['Cardiovascular', 'Resistance training', 'Mobility & flexibility', 'Bone-health ARED', 'Recovery'].map(x => `<option>${x}</option>`).join('')}</select><input id='fn' placeholder='Exercise session name'><input id='fd' type='number' placeholder='Duration (min)'><select id='fi'><option>Low</option><option>Moderate</option><option>High</option></select><input id='fh' type='number' placeholder='Heart rate (BPM)'><label style="display:block;margin:6px 0"><input type='checkbox' id='fc' style='width:auto'> Session completed</label><label style="display:block;margin:6px 0"><input type='checkbox' id='fs' style='width:auto'> Chest pain, severe breathlessness or injury</label><button class='b b-prim' id='fb'>Log Session</button></div><div class='glass wrap' style='margin-top:14px'><table><tr><th>Date</th><th>Type</th><th>Exercise</th><th>Min</th><th>Intensity</th><th>HR</th><th>Status</th></tr>${L.slice().reverse().map(x => `<tr><td>${fmt(x.t)}</td><td>${x.ty}</td><td>${esc(x.nm)}</td><td>${x.du}</td><td>${x.it}</td><td>${x.hr || '-'}</td><td>${x.dn ? 'Completed' : 'Partial'}</td></tr>`).join('')}</table></div><div class='glass' style='margin-top:14px'>${card('c1', 'Exercise Minutes per Session')}</div>`,
    () => {
      charts.push(lc('c1', 'min', L.map(x => x.du), '#38bdf8'));
      document.getElementById('fb').onclick = () => {
        const dn = document.getElementById('fc').checked, sy = document.getElementById('fs').checked;
        L.push({ t: now(), ty: document.getElementById('ft').value, nm: document.getElementById('fn').value || 'Session', du: +document.getElementById('fd').value || 0, it: document.getElementById('fi').value, hr: +document.getElementById('fh').value || 0, dn });
        DB.s('fit_' + me, L);
        if (sy) pushAlert(me, 'Daily exercise', 'Symptoms reported during exercise', 'Critical', 'Stop activity immediately and contact medical officer.');
        else if (!dn) pushAlert(me, 'Daily exercise', 'Prescribed session not completed', 'Below', 'Review schedule, fatigue, and record reason.');
        show('fit');
      };
    }
  ];
};

NEW.rep = me => {
  const ns = me ? [me] : crew, A = DB.g('alerts', []).filter(a => !me || a.n === me);
  return [
    `<div style='display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;'>
      <h1 style='margin:0;'>Health History & Mission Reports</h1>
      <a href='/api/telemetry/export.csv' class='b b-prim' download='ASTRA_Mission_Telemetry.csv' style='text-decoration:none; display:inline-flex; align-items:center; gap:8px; font-weight:600;'>&#128190; Export Telemetry (CSV)</a>
    </div><div class='glass wrap'><table><tr><th>Astronaut</th><th>Status</th>${IND.map(i => `<th>${i[1]}</th>`).join('')}</tr>${ns.map(n => `<tr><td>${n}</td><td>${sb(n)}</td>${IND.map(i => `<td>${cur(i[0], n)[0]}</td>`).join('')}</tr>`).join('')}</table></div><div class='grid' style='margin-top:14px'><div class='glass'><b>Alert Statistics</b><p>Open: ${A.filter(a => a.st === 'Open').length} | Ack: ${A.filter(a => a.st === 'Acknowledged').length} | Resolved: ${A.filter(a => a.st === 'Resolved').length}</p></div><div class='glass'><b>Well-being Trends</b><p>${ns.map(n => `${n}: ${DB.g('mh', []).filter(x => x.n === n).map(x => LBL[x.cls]).slice(-4).join(', ') || 'No entries'}`).join('<br>')}</p></div><div class='glass'><b>Cognitive Assessments</b><p>${DB.g('cog', []).filter(x => ns.includes(x.n)).length} total tests recorded</p></div></div><div class='glass wrap' style='margin-top:14px'><b>Alert Log</b><table>${A.slice(0, 15).map(a => `<tr><td>${fmt(a.t)}</td><td>${a.n}</td><td>${esc(a.ind)}</td><td>${esc(a.val)}</td><td>${bd(a.cls)}</td><td>${a.st}</td></tr>`).join('') || '<tr><td>No alerts logged</td></tr>'}</table></div>`
  ];
};

NEW.set = me => [
  `<h1>Settings & Telemetry Diagnostics</h1><div class='glass'><p>Signed in as <b>${user.name}</b> (${user.role === 'mc' ? 'Earth Mission Control' : 'Flight Astronaut'}).</p><button class='b' id='lo'>Sign Out</button></div><div class='glass' style='margin-top:14px'><b>Hardware Sensor Status (nRF52840)</b><p class='mut'>AstroHealth integrates real-time serial and Bluetooth LE packets directly into ASTRA indicators. Baud: 115200, Service UUID: 0x180D, Char UUID: 0x2A37.</p><button class='b b-prim' onclick='connectWebSerial()'>Connect USB Serial</button> <button class='b' onclick='connectWebBluetooth()'>Connect BLE</button></div>`,
  () => { document.getElementById('lo').onclick = () => location.reload(); }
];

// ---------- Legacy Branch Fallbacks ----------
function legacyShow(p) {
  const me = user.role === "astro" ? user.name : null, m = document.getElementById("main");
  if (p === "vitals") {
    m.innerHTML = `<h1>Health Analytics</h1><div class="grid">${card("c1", "Heart Rate (BPM)")}${card("c2", "Blood Pressure (mmHg)")}${card("c3", "Glucose (mg/dL)")}${card("c4", "SpO2 (%)")}</div><div class="glass wrap"><table><tr><th>Indicator</th><th>Now</th><th>Status</th><th>Recommended Action</th></tr>${vitals(me).map(x => `<tr><td>${x[0]}</td><td>${x[2]}</td><td>${badge(x[3][0])}</td><td>${x[3][1]}</td></tr>`).join("")}</table></div>`;
    const d = data[me];
    chart("c1", "BPM", d.hr, "#23D5F5");
    chart("c2", "Systolic", d.sys, "#38bdf8", [{ label: "Diastolic", data: d.dia, borderColor: "#818cf8", tension: 0.35, pointRadius: 2 }]);
    chart("c3", "mg/dL", d.glu, "#22d3ee");
    chart("c4", "SpO2 %", d.spo2, "#818cf8");
  } else if (p === "hydr") {
    const v = Math.round(last(data[me].fluid)), t = 2500, pc = Math.min(100, Math.round(v / t * 100));
    m.innerHTML = `<h1>Hydration Management</h1><div class="glass"><div class="big">${v} / ${t} mL</div><div class="bar"><i style="width:${pc}%"></i></div><p class="mut">${pc}% of assigned target achieved today.</p></div><div class="glass" style="margin-top:14px">${card("c1", "Daily Fluid Intake (mL)")}</div>`;
    chart("c1", "mL", data[me].fluid, "#38bdf8");
  } else if (p === "sleep") {
    m.innerHTML = `<h1>Sleep & Circadian Rhythm</h1><div class="grid"><div class="glass"><span class="mut">Last Rest Period</span><div class="big">${last(data[me].sleep)} Hours</div></div></div><div class="glass">${card("c1", "Sleep Duration Curve")}</div>`;
    chart("c1", "Hours", data[me].sleep, "#818cf8");
  } else {
    show("dash");
  }
}

// ---------- Main App Navigation & Dispatch ----------
let user = null, page = "dash", charts = [];

const pages = {
  astro: [
    ["dash", "Dashboard"],
    ["vitals", "Health Analytics"],
    ["hydr", "Hydration"],
    ["sleep", "Sleep"],
    ["fit", "Fitness"],
    ["rad", "Radiation"],
    ["game", "Mind Games"],
    ["ind", "Health Indicators"],
    ["mind", "Mental Health"],
    ["support", "Earth Support"],
    ["earth", "Earth Connection"],
    ["scen", "Medical Guidance"],
    ["rep", "Reports"],
    ["alerts", "My Alerts"],
    ["med", "Medication"],
    ["env", "Environment"],
    ["set", "Settings"]
  ],
  mc: [
    ["dash", "Mission Overview"],
    ["crew", "Crew Profiles"],
    ["rad", "Radiation"],
    ["env", "Environment"],
    ["med", "Prescriptions"],
    ["alerts", "Alert Center"],
    ["support", "Support Inbox"],
    ["cog", "Cognitive Records"],
    ["scen", "Medical Guidance"],
    ["rep", "Reports"],
    ["set", "Settings"]
  ]
};

function buildNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = "<h2>ASTRA | SPARC</h2>" + pages[user.role].map(p => `<button data-p="${p[0]}">${p[1]}</button>`).join("");
  nav.onclick = e => {
    const btn = e.target.closest("[data-p]");
    if (btn) show(btn.dataset.p);
  };
}

function show(p) {
  page = p;
  charts.forEach(c => { try { c.destroy(); } catch (e) {} });
  charts = [];
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("act", b.dataset.p === p));
  const me = user.role === "astro" ? user.name : null, m = document.getElementById("main");
  if (hch) { try { hch.destroy(); } catch (e) {} hch = null; }
  if (p !== "earth") sound(false);

  let R = NEW[p] && NEW[p](me);
  if (R) {
    m.innerHTML = R[0];
    if (R[1]) R[1]();
  } else {
    legacyShow(p);
  }
}

// ---------- Landing Page & Auth Flow ----------
document.addEventListener("DOMContentLoaded", () => {
  const gl = document.getElementById("gl");
  const ge = document.getElementById("ge");
  const go = document.getElementById("go");
  const who = document.getElementById("who");
  const role = document.getElementById("role");

  if (who) {
    crew.forEach(c => who.add(new Option(c, c)));
  }

  if (role) {
    role.onchange = () => { who.style.display = role.value === "mc" ? "none" : ""; };
  }

  if (gl) {
    gl.onclick = () => {
      document.getElementById("landing").style.display = "none";
      document.getElementById("login").style.display = "block";
    };
  }

  if (ge) {
    ge.onclick = () => {
      document.getElementById("feat").scrollIntoView({ behavior: "smooth" });
    };
  }

  if (go) {
    go.onclick = () => {
      if (document.getElementById("pw").value !== "demo") {
        document.getElementById("err").textContent = "Demo password is: demo";
        return;
      }
      user = {
        role: role.value,
        name: role.value === "mc" ? "Mission Control" : who.value
      };
      document.getElementById("login").style.display = "none";
      document.getElementById("landing").style.display = "none";
      document.getElementById("app").classList.add("on");
      page = "dash";
      buildNav();
      syncAlerts();
      show("dash");
    };
  }

  // URL Query Parameters support for direct navigation & automated screenshots
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("role")) {
    const r = urlParams.get("role");
    const p = urlParams.get("page") || "dash";
    const u = urlParams.get("user") || (r === "mc" ? "Mission Control" : crew[0]);
    user = { role: r, name: u };
    const landingEl = document.getElementById("landing");
    const loginEl = document.getElementById("login");
    const appEl = document.getElementById("app");
    if (landingEl) landingEl.style.display = "none";
    if (loginEl) loginEl.style.display = "none";
    if (appEl) appEl.classList.add("on");
    page = p;
    buildNav();
    syncAlerts();
    show(p);
  }

  // Auto-update MET
  setInterval(updateMET, 1000);
});

// ---------- Mission Elapsed Time (MET) ----------
function updateMET() {
  const metElem = document.getElementById("met-display");
  if (!metElem) return;
  const launchDate = new Date("2026-11-01T00:00:00Z");
  const now = new Date();
  const diff = now - launchDate;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  metElem.innerText = `MET: ${String(days).padStart(3, '0')}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ---------- Audible & Visual Critical Alarm Engine (Web Audio API) ----------
let audioCtx = null;
let lastAlarmTime = 0;
let alarmSilenced = false;

function playCriticalAlarm(msg) {
  const banner = document.getElementById("critical-alert-banner");
  const bannerMsg = document.getElementById("critical-alert-msg");
  if (banner) {
    banner.style.display = "flex";
    if (bannerMsg && msg) bannerMsg.innerText = msg;
  }

  if (alarmSilenced) return;

  const now = Date.now();
  if (now - lastAlarmTime < 3500) return;
  lastAlarmTime = now;

  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(587, audioCtx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.30);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.55);
  } catch (e) {
    console.warn("Audio alarm warning:", e);
  }
}

function dismissAlarm() {
  alarmSilenced = true;
  const banner = document.getElementById("critical-alert-banner");
  if (banner) banner.style.display = "none";
}

// ---------- Hardware Connectivity (nRF52840 Web Serial & BLE) ----------
let isHardwareConnected = false;

function setHardwareStatus(statusText, badgeClass) {
  isHardwareConnected = true;
  const statusBadge = document.getElementById("hw-status-badge");
  if (statusBadge) {
    statusBadge.innerText = statusText;
    statusBadge.className = `badge ${badgeClass}`;
  }
}

function handleHardwarePacket(packet) {
  const hr = parseFloat(packet.heart_rate !== undefined ? packet.heart_rate : (packet.hr || 0));
  const spo2 = parseFloat(packet.spo2 !== undefined ? packet.spo2 : 0);
  const temp = parseFloat(packet.temperature !== undefined ? packet.temperature : (packet.temp || 36.8));
  const targetCrew = user && user.role === "astro" ? user.name : crew[0];

  // Sensor Contact Badge Update (Finger detection)
  const contactBadge = document.getElementById("sensor-contact-badge");
  if (contactBadge) {
    if (hr > 30) {
      contactBadge.innerText = "● SENSOR: CONTACT ACTIVE";
      contactBadge.className = "badge Normal";
      contactBadge.title = `Finger detected - Pulse: ${hr.toFixed(0)} BPM`;
    } else {
      contactBadge.innerText = "○ SENSOR: NO FINGER";
      contactBadge.className = "badge Above";
      contactBadge.title = "No finger contact detected on MAX30102";
    }
  }

  // Critical anomaly detection & alarm trigger
  const isCrit = packet.risk_level === 'Critical' || (hr > 0 && (hr < 50 || hr > 120 || (spo2 > 0 && spo2 < 92)));
  if (isCrit) {
    const alertReason = packet.recommendation || `Critical vitals: HR ${hr.toFixed(0)} BPM, SpO2 ${spo2.toFixed(0)}%`;
    playCriticalAlarm(alertReason);
  } else {
    alarmSilenced = false;
    const banner = document.getElementById("critical-alert-banner");
    if (banner) banner.style.display = "none";
  }

  // Update live values in dataset if active reading
  if (data[targetCrew]) {
    if (hr > 0) {
      data[targetCrew].hr.push(hr);
      if (data[targetCrew].hr.length > 14) data[targetCrew].hr.shift();
    }
    if (spo2 > 0) {
      data[targetCrew].spo2.push(spo2);
      if (data[targetCrew].spo2.length > 14) data[targetCrew].spo2.shift();
    }
  }

  // Forward to backend REST API
  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packet)
  }).catch(() => {});

  // Re-render active view
  if (page === "dash" || page === "ind" || page === "vitals") {
    show(page);
  }
}

async function connectWebSerial() {
  if (!('serial' in navigator)) {
    alert("Web Serial API is supported in Chrome, Edge, and Opera.");
    return;
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    setHardwareStatus("USB COM CONNECTED", "Normal");
    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let lines = buffer.split('\n');
      buffer = lines.pop();
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          try { handleHardwarePacket(JSON.parse(line)); } catch (e) {}
        }
      }
    }
  } catch (err) {
    alert("Serial Connection Error: " + err.message);
  }
}

async function connectWebBluetooth() {
  if (!('bluetooth' in navigator)) {
    alert("Web Bluetooth API is supported in Chrome and Edge.");
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [0x180D] }, { namePrefix: 'Astro' }, { namePrefix: 'Bluefruit' }],
      optionalServices: [0x180D]
    });
    setHardwareStatus("BLE CONNECTING...", "Above");
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(0x180D);
    const characteristic = await service.getCharacteristic(0x2A37);
    await characteristic.startNotifications();
    setHardwareStatus("BLE LIVE", "Normal");
    characteristic.addEventListener('characteristicvaluechanged', event => {
      const decoder = new TextDecoder('utf-8');
      const packetStr = decoder.decode(event.target.value).trim();
      if (packetStr.startsWith('{') && packetStr.endsWith('}')) {
        try { handleHardwarePacket(JSON.parse(packetStr)); } catch (e) {}
      }
    });
  } catch (err) {
    alert("Bluetooth Connection Error: " + err.message);
  }
}

// Scenario Trigger
async function setFlightScenario(scen) {
  try {
    await fetch('/api/simulate/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scen })
    });
    // Trigger one tick immediately
    const res = await fetch('/api/simulate/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) {
      const pt = await res.json();
      handleHardwarePacket(pt);
    }
  } catch (e) {}
}

// Background simulation ticker (active when in SIMULATED DATA mode)
setInterval(async () => {
  const hwBadge = document.getElementById("hw-status-badge");
  if (hwBadge && hwBadge.innerText.includes("SIMULATED")) {
    try {
      const res = await fetch('/api/simulate/tick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) {
        const pt = await res.json();
        if (data[crew[0]] && pt.heart_rate) {
          data[crew[0]].hr.push(pt.heart_rate);
          if (data[crew[0]].hr.length > 14) data[crew[0]].hr.shift();
        }
      }
    } catch (e) {}
  }
}, 5000);
