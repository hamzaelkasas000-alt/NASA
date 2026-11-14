// AstroHealth Live Telemetry & Hardware Connection Engine

let hrChart = null;
let envChart = null;
let liveInterval = null;
let audioAlertsEnabled = false;
let isHardwareConnected = false;

// Web Audio API Synthesizer for NASA tactical alerts
function playBeep(freq = 880, type = 'sine', duration = 0.15) {
  if (!audioAlertsEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {
    console.warn("Audio Context not allowed yet:", e);
  }
}

// Mission Elapsed Time (MET)
function updateMET() {
  const metElem = document.getElementById('met-display');
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

// Chart Initialization
function initCharts() {
  const ctxHr = document.getElementById('chart-hr');
  if (ctxHr) {
    hrChart = new Chart(ctxHr, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Heart Rate (BPM)',
            data: [],
            borderColor: '#ff3366',
            backgroundColor: 'rgba(255, 51, 102, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 2,
            yAxisID: 'y'
          },
          {
            label: 'SpO2 (%)',
            data: [],
            borderColor: '#00f0ff',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.35,
            borderDash: [4, 4],
            pointRadius: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'monospace', size: 10 } }
          },
          y: {
            type: 'linear',
            position: 'left',
            min: 40,
            max: 160,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#ff3366', font: { family: 'monospace' } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 80,
            max: 100,
            grid: { display: false },
            ticks: { color: '#00f0ff', font: { family: 'monospace' } }
          }
        },
        plugins: {
          legend: { labels: { color: '#e2e8f0', font: { family: 'monospace' } } }
        }
      }
    });
  }

  const ctxEnv = document.getElementById('chart-env');
  if (ctxEnv) {
    envChart = new Chart(ctxEnv, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Pressure (hPa)',
            data: [],
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 2,
            yAxisID: 'y'
          },
          {
            label: 'Core Temp (°C)',
            data: [],
            borderColor: '#ffb300',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'monospace', size: 10 } }
          },
          y: {
            position: 'left',
            min: 950,
            max: 1050,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#00e676', font: { family: 'monospace' } }
          },
          y1: {
            position: 'right',
            min: 35.0,
            max: 40.0,
            grid: { display: false },
            ticks: { color: '#ffb300', font: { family: 'monospace' } }
          }
        },
        plugins: {
          legend: { labels: { color: '#e2e8f0', font: { family: 'monospace' } } }
        }
      }
    });
  }
}

// Load initial historical data into charts
async function loadHistory(astroId = 1) {
  try {
    const res = await fetch(`/api/telemetry/history?astronaut_id=${astroId}&limit=15`);
    const history = await res.json();
    if (!Array.isArray(history)) return;

    if (hrChart) {
      hrChart.data.labels = [];
      hrChart.data.datasets[0].data = [];
      hrChart.data.datasets[1].data = [];
    }
    if (envChart) {
      envChart.data.labels = [];
      envChart.data.datasets[0].data = [];
      envChart.data.datasets[1].data = [];
    }

    history.forEach(pt => {
      const timeStr = pt.timestamp.split(' ')[1] || pt.timestamp;
      if (hrChart) {
        hrChart.data.labels.push(timeStr);
        hrChart.data.datasets[0].data.push(pt.heart_rate);
        hrChart.data.datasets[1].data.push(pt.spo2);
      }
      if (envChart) {
        envChart.data.labels.push(timeStr);
        envChart.data.datasets[0].data.push(pt.pressure);
        envChart.data.datasets[1].data.push(pt.temperature);
      }
    });

    if (hrChart) hrChart.update();
    if (envChart) envChart.update();
  } catch(e) {
    console.error("Failed to load history:", e);
  }
}

// Fetch and update DOM elements
function updateVitalsUI(data) {
  const hrEl = document.getElementById('val-hr');
  const spo2El = document.getElementById('val-spo2');
  const tempEl = document.getElementById('val-temp');
  const pressEl = document.getElementById('val-press');
  const altEl = document.getElementById('val-alt');
  const healthEl = document.getElementById('val-health');
  const fatigueEl = document.getElementById('val-fatigue');
  const riskBadge = document.getElementById('badge-risk');
  const recEl = document.getElementById('val-rec');
  const healthProgress = document.getElementById('health-progress-bar');

  if (hrEl) hrEl.innerText = Number(data.heart_rate).toFixed(1);
  if (spo2El) spo2El.innerText = Number(data.spo2).toFixed(1);
  if (tempEl) tempEl.innerText = Number(data.temperature).toFixed(1);
  if (pressEl) pressEl.innerText = Number(data.pressure).toFixed(1);
  if (altEl) altEl.innerText = Number(data.altitude).toFixed(1);
  if (healthEl) healthEl.innerText = Math.round(data.health_score);
  if (fatigueEl) fatigueEl.innerText = Math.round(data.fatigue_index);
  if (recEl) recEl.innerText = data.recommendation || "Nominal";

  if (healthProgress) {
    healthProgress.style.width = `${Math.min(100, Math.max(5, data.health_score))}%`;
    if (data.health_score >= 80) {
      healthProgress.className = 'progress-bar bg-success';
    } else if (data.health_score >= 60) {
      healthProgress.className = 'progress-bar bg-warning';
    } else {
      healthProgress.className = 'progress-bar bg-danger';
    }
  }

  if (riskBadge) {
    riskBadge.innerText = data.risk_level;
    if (data.risk_level === 'LOW') {
      riskBadge.className = 'status-pill status-pill-green';
    } else if (data.risk_level === 'MEDIUM') {
      riskBadge.className = 'status-pill status-pill-amber';
      playBeep(440, 'triangle', 0.2);
    } else {
      riskBadge.className = 'status-pill status-pill-red';
      playBeep(880, 'sawtooth', 0.4);
    }
  }

  // Update Charts
  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  if (hrChart) {
    if (hrChart.data.labels.length > 20) {
      hrChart.data.labels.shift();
      hrChart.data.datasets[0].data.shift();
      hrChart.data.datasets[1].data.shift();
    }
    hrChart.data.labels.push(timeLabel);
    hrChart.data.datasets[0].data.push(data.heart_rate);
    hrChart.data.datasets[1].data.push(data.spo2);
    hrChart.update('none');
  }

  if (envChart) {
    if (envChart.data.labels.length > 20) {
      envChart.data.labels.shift();
      envChart.data.datasets[0].data.shift();
      envChart.data.datasets[1].data.shift();
    }
    envChart.data.labels.push(timeLabel);
    envChart.data.datasets[0].data.push(data.pressure);
    envChart.data.datasets[1].data.push(data.temperature);
    envChart.update('none');
  }
}

// Tick Simulation (when no physical hardware connected)
async function tickSimulation() {
  if (isHardwareConnected) return; // Physical board takes precedence!
  try {
    const res = await fetch('/api/simulate/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      updateVitalsUI(data);
    }
  } catch(e) {
    console.error("Simulation tick failed:", e);
  }
}

// Set Scenario
async function setScenario(scenarioName) {
  try {
    const res = await fetch('/api/simulate/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenarioName })
    });
    if (res.ok) {
      const btns = document.querySelectorAll('.btn-scenario');
      btns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline-secondary');
      });
      const activeBtn = document.getElementById(`btn-scen-${scenarioName.toLowerCase()}`);
      if (activeBtn) {
        activeBtn.classList.remove('btn-outline-secondary');
        activeBtn.classList.add('btn-primary');
      }
      tickSimulation();
    }
  } catch(e) {
    console.error("Scenario update error:", e);
  }
}

// Toggle Audio Alerts
function toggleAudio() {
  audioAlertsEnabled = !audioAlertsEnabled;
  const btn = document.getElementById('btn-audio-toggle');
  if (btn) {
    btn.innerHTML = audioAlertsEnabled 
      ? '<i class="fas fa-volume-up me-1"></i> Audio ON' 
      : '<i class="fas fa-volume-mute me-1"></i> Audio OFF';
    btn.className = audioAlertsEnabled ? 'btn btn-sm btn-outline-info' : 'btn btn-sm btn-outline-secondary';
  }
  if (audioAlertsEnabled) playBeep(660, 'sine', 0.1);
}

// -------------------------------------------------------------
// HARDWARE CONNECTION HANDLERS (Web Serial & Web Bluetooth)
// -------------------------------------------------------------

function setHardwareStatus(statusText, badgeClass) {
  isHardwareConnected = true;
  if (liveInterval) clearInterval(liveInterval); // Stop fake simulator data

  const statusBadge = document.getElementById('hw-status-badge');
  if (statusBadge) {
    statusBadge.innerText = statusText;
    statusBadge.className = `badge ${badgeClass} font-monospace`;
  }
}

// Process incoming line or packet from nRF52840
function handleHardwareJsonPacket(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    updateVitalsUI(data);

    // Forward to backend database via REST API
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(err) {
    // Incomplete JSON fragment or debug string
  }
}

// Method 1: Web Serial API (Plug nRF52840 into USB-C)
async function connectWebSerial() {
  if (!('serial' in navigator)) {
    alert("Web Serial API is supported in Chrome, Edge, and Opera. Please use a Chromium browser.");
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    setHardwareStatus("USB COM CONNECTED", "bg-success");

    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let lines = buffer.split('\n');
      buffer = lines.pop(); // keep partial line

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          handleHardwareJsonPacket(line);
        }
      }
    }
  } catch (err) {
    console.error("Serial connection error:", err);
    alert("Serial Connection Error: " + err.message);
  }
}

// Method 2: Web Bluetooth API (Connect wirelessly via BLE)
async function connectWebBluetooth() {
  if (!('bluetooth' in navigator)) {
    alert("Web Bluetooth API is supported in Chrome and Edge. Please make sure Bluetooth is enabled on your PC.");
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [0x180D] }, // Standard Heart Rate Service
        { namePrefix: 'Astro' },
        { namePrefix: 'Bluefruit' }
      ],
      optionalServices: [0x180D]
    });

    setHardwareStatus("BLE CONNECTING...", "bg-warning text-dark");

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(0x180D);
    const characteristic = await service.getCharacteristic(0x2A37);

    await characteristic.startNotifications();
    setHardwareStatus("BLE WIRELESS LIVE", "bg-success");

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const decoder = new TextDecoder('utf-8');
      const packetStr = decoder.decode(event.target.value).trim();
      if (packetStr.startsWith('{') && packetStr.endsWith('}')) {
        handleHardwareJsonPacket(packetStr);
      }
    });

    device.addEventListener('gattserverdisconnected', () => {
      setHardwareStatus("BLE DISCONNECTED", "bg-danger");
      isHardwareConnected = false;
      liveInterval = setInterval(tickSimulation, 2000); // Resume simulation
    });

  } catch (err) {
    console.error("BLE connection error:", err);
    alert("Bluetooth Connection Error: " + err.message);
  }
}

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setInterval(updateMET, 1000);
  initCharts();
  loadHistory(1);

  // Poll / simulate telemetry every 2 seconds until physical board connects
  liveInterval = setInterval(tickSimulation, 2000);
});
