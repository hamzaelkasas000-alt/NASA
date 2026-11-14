# ASTRA / AstroHealth Wearable Firmware (nRF52840)

Production Arduino C++ firmware for the deep-space biometric wearable monitoring unit, built for the Nordic Semiconductor **nRF52840** microcontroller (e.g., Adafruit Feather nRF52840 Express, Seeed XIAO nRF52840 Sense).

---

## 🛰️ Sensor Specifications & Hardware Pinout

Both sensors communicate via standard 3.3V $I^2C$ bus sharing the SDA and SCL lines:

| Component | Pin Function | nRF52840 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **MAX30102** | VCC | `3.3V` | Pulse Oximeter & PPG Heart Rate Sensor |
| **MAX30102** | GND | `GND` | Ground reference |
| **MAX30102** | SDA | `SDA` (Pin D4 / P0.26) | Shared I2C Data bus |
| **MAX30102** | SCL | `SCL` (Pin D5 / P0.27) | Shared I2C Clock bus |
| **BMP390** | VIN | `3.3V` | Precision Barometric Pressure & Altimeter |
| **BMP390** | GND | `GND` | Ground reference |
| **BMP390** | SDA | `SDA` (Pin D4 / P0.26) | Shared I2C Data bus |
| **BMP390** | SCL | `SCL` (Pin D5 / P0.27) | Shared I2C Clock bus |

---

## 📦 Required Arduino Libraries

Install the following libraries via the Arduino IDE Library Manager:
1. **SparkFun MAX3010x Pulse and Proximity Sensor Library** (by SparkFun Electronics)
2. **Adafruit BMP3XX Library** (by Adafruit)
3. **Adafruit Unified Sensor** (dependency for BMP3XX)
4. **Adafruit Bluefruit nRF52 Libraries** (included with the Adafruit nRF52 board package)

---

## 📡 Wireless & Serial Telemetry Protocols

### 1. Bluetooth Low Energy (BLE)
- **Device Advertised Name:** `AstroHealth`
- **Primary Service UUID:** `0x180D` (Standard Heart Rate Service)
- **Telemetry Characteristic UUID:** `0x2A37` (Read + Notify, buffer size 256 bytes)

### 2. USB Serial (Web Serial API)
- **Baud Rate:** `115200` baud
- **Format:** Turn-by-turn newline-delimited JSON streaming at 1 Hz (1000 ms non-blocking interval)

### 3. Telemetry JSON Packet Schema
```json
{
  "heart_rate": 74.2,
  "spo2": 98.4,
  "temperature": 36.7,
  "pressure": 1013.25,
  "altitude": 18.4,
  "health_score": 96.0,
  "fatigue_index": 12.0,
  "risk_level": "Normal",
  "recommendation": "Continue mission monitoring."
}
```

---

## ⚡ Key Firmware Features
- **Signal Quality & Finger Detection:** Monitors infrared baseline (`irValue < 50000`). If no finger contact is present, heart rate gracefully drops to 0 rather than reporting false harmonics.
- **Dynamic SpO2 Ratio Formulation:** $R = \frac{\text{Red}}{\text{IR}}$, $\text{SpO}_2 \approx 110 - 25 \times R$.
- **Clinical Triage Thresholds:** Real-time calculation of overall astronaut health score (0-100), fatigue index, and 3-tier risk triage (`Normal`, `Above`, `Critical`).
