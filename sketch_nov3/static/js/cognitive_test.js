// NASA Psychomotor Vigilance Task (PVT) Cognitive Assessment

let pvtState = 'IDLE'; // IDLE, WAITING, GO, DONE
let pvtTimer = null;
let startTime = 0;
let trials = [];
const TOTAL_TRIALS = 3;

const pvtBox = document.getElementById('pvt-interactive-box');
const pvtPrompt = document.getElementById('pvt-prompt');
const pvtResultBox = document.getElementById('pvt-result-box');

function resetPVT() {
  pvtState = 'IDLE';
  if (pvtTimer) clearTimeout(pvtTimer);
  trials = [];
  if (pvtBox) {
    pvtBox.className = 'pvt-box pvt-waiting';
    pvtPrompt.innerText = 'CLICK HERE TO BEGIN COGNITIVE TEST';
  }
  if (pvtResultBox) pvtResultBox.classList.add('d-none');
}

function startTrial() {
  pvtState = 'WAITING';
  pvtBox.className = 'pvt-box pvt-ready';
  pvtPrompt.innerHTML = `<i class="fas fa-eye me-2"></i> WAIT FOR GREEN TARGET...<br><small class="text-white-50" style="font-size:0.9rem">Trial ${trials.length + 1} of ${TOTAL_TRIALS}</small>`;

  const randomDelay = Math.floor(Math.random() * 2500) + 1500; // 1.5s - 4s
  pvtTimer = setTimeout(() => {
    pvtState = 'GO';
    startTime = performance.now();
    pvtBox.className = 'pvt-box pvt-go';
    pvtPrompt.innerHTML = '<i class="fas fa-bolt me-2"></i> CLICK NOW!';
  }, randomDelay);
}

function handlePVTClick() {
  if (pvtState === 'IDLE') {
    startTrial();
  } else if (pvtState === 'WAITING') {
    // False start!
    clearTimeout(pvtTimer);
    pvtState = 'IDLE';
    pvtBox.className = 'pvt-box pvt-ready';
    pvtPrompt.innerHTML = '<span class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i> FALSE START! Too early. Click to retry.</span>';
  } else if (pvtState === 'GO') {
    const reactionTime = Math.round(performance.now() - startTime);
    trials.push(reactionTime);

    if (trials.length < TOTAL_TRIALS) {
      pvtPrompt.innerHTML = `<strong>${reactionTime} ms</strong><br><small>Great! Get ready for next trial...</small>`;
      setTimeout(startTrial, 1200);
    } else {
      finishPVT();
    }
  }
}

async function finishPVT() {
  pvtState = 'DONE';
  const sum = trials.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / trials.length);

  let readiness = "NOMINAL";
  let badgeClass = "text-success";
  if (avg < 260) {
    readiness = "EXCELLENT - FLIGHT READY";
    badgeClass = "text-info";
  } else if (avg <= 350) {
    readiness = "NOMINAL COGNITIVE STATE";
    badgeClass = "text-success";
  } else if (avg <= 480) {
    readiness = "MILD SLOWING / FATIGUE DETECTED";
    badgeClass = "text-warning";
  } else {
    readiness = "SIGNIFICANT REACTION DELAY - REST REQUIRED";
    badgeClass = "text-danger";
  }

  pvtBox.className = 'pvt-box pvt-waiting';
  pvtPrompt.innerHTML = `<i class="fas fa-check-circle text-success me-2"></i> TEST COMPLETE<br><small>Average Reaction Time: ${avg} ms</small>`;

  if (pvtResultBox) {
    pvtResultBox.classList.remove('d-none');
    document.getElementById('pvt-avg-time').innerText = `${avg} ms`;
    document.getElementById('pvt-readiness-label').innerText = readiness;
    document.getElementById('pvt-readiness-label').className = `fw-bold ${badgeClass}`;
  }

  // Submit to backend
  try {
    await fetch('/api/cognitive/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reaction_time_ms: avg,
        accuracy_pct: 100.0
      })
    });
  } catch(e) {
    console.error("Failed to record cognitive test:", e);
  }
}

if (pvtBox) {
  pvtBox.addEventListener('click', handlePVTClick);
}
