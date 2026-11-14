#include <Wire.h>
#include <MAX30105.h>
#include "heartRate.h"
#include <Adafruit_BMP3XX.h>
#include <bluefruit.h>

#define SEALEVELPRESSURE_HPA 1013.25

MAX30105 max30102;
Adafruit_BMP3XX bmp;

BLEService astroService("180D");
BLECharacteristic dataChar(
    "2A37",
    CHR_PROPS_NOTIFY | CHR_PROPS_READ,
    256
);

float heartRate = 0.0;
float spo2 = 98.0;
float healthScore = 100.0;
float fatigueIndex = 0.0;

long lastBeat = 0;
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 1000;

String riskLevel = "Normal";
String recommendation = "Continue mission monitoring.";

void calculateDerivedHealth(float temp)
{
    healthScore = 100.0;
    fatigueIndex = 0.0;

    if (spo2 <= 92.0 && spo2 > 0) {
        healthScore -= 30.0;
        fatigueIndex += 40.0;
    } else if (spo2 <= 94.0 && spo2 > 0) {
        healthScore -= 20.0;
        fatigueIndex += 30.0;
    }

    if (heartRate > 110.0) {
        healthScore -= 25.0;
        fatigueIndex += 35.0;
    } else if (heartRate > 100.0) {
        healthScore -= 15.0;
        fatigueIndex += 20.0;
    } else if (heartRate < 60.0 && heartRate > 0) {
        healthScore -= 15.0;
    }

    if (temp > 37.8) {
        healthScore -= 15.0;
        fatigueIndex += 15.0;
    } else if (temp > 37.5) {
        fatigueIndex += 10.0;
    }

    healthScore = max(0.0, min(100.0, healthScore));
    fatigueIndex = max(0.0, min(100.0, fatigueIndex));

    if (healthScore >= 80.0) {
        riskLevel = "Normal";
        recommendation = "Continue mission monitoring.";
    } else if (healthScore >= 60.0) {
        riskLevel = "Above";
        recommendation = "Rest 15 min and repeat measurements.";
    } else {
        riskLevel = "Critical";
        recommendation = "Notify flight surgeon immediately.";
    }
}

void setupBLE()
{
    Bluefruit.begin();
    Bluefruit.setTxPower(4);
    Bluefruit.setName("AstroHealth");
    astroService.begin();
    dataChar.begin();
    Bluefruit.Advertising.addService(astroService);
    Bluefruit.Advertising.addName();
    Bluefruit.Advertising.restartOnDisconnect(true);
    Bluefruit.Advertising.start();
}

void setup()
{
    Serial.begin(115200);
    delay(2000);
    Wire.begin();

    if (!max30102.begin(Wire)) {
        Serial.println("MAX30102 Not Found");
        while (1);
    }
    max30102.setup();

    if (!bmp.begin_I2C()) {
        Serial.println("BMP390 Not Found");
        while (1);
    }

    bmp.setTemperatureOversampling(BMP3_OVERSAMPLING_8X);
    bmp.setPressureOversampling(BMP3_OVERSAMPLING_4X);
    bmp.setIIRFilterCoeff(BMP3_IIR_FILTER_COEFF_3);

    setupBLE();
    Serial.println("AstroHealth Ready");
}

void loop()
{
    long irValue = max30102.getIR();

    if (irValue < 50000) {
        heartRate = 0.0;
        spo2 = 0.0;
    } else {
        if (checkForBeat(irValue)) {
            long delta = millis() - lastBeat;
            if (lastBeat > 0 && delta > 300) {
                float bpm = 60.0 / (delta / 1000.0);
                if (bpm > 40 && bpm < 220) {
                    heartRate = bpm;
                }
            }
            lastBeat = millis();
        }

        long redValue = max30102.getRed();
        if (irValue > 0 && redValue > 0) {
            float ratio = (float)redValue / (float)irValue;
            float estSpo2 = 110.0 - (25.0 * ratio);
            if (estSpo2 >= 85.0 && estSpo2 <= 100.0) {
                spo2 = estSpo2;
            }
        }
    }

    if (millis() - lastSendTime >= sendInterval) {
        lastSendTime = millis();

        float temperature = 0.0;
        float pressure = 0.0;
        float altitude = 0.0;

        if (bmp.performReading()) {
            temperature = bmp.temperature;
            pressure = bmp.pressure / 100.0;
            altitude = bmp.readAltitude(SEALEVELPRESSURE_HPA);
        }

        calculateDerivedHealth(temperature);

        String json = "{";
        json += "\"heart_rate\":" + String(heartRate, 1);
        json += ",\"spo2\":" + String(spo2, 1);
        json += ",\"temperature\":" + String(temperature, 1);
        json += ",\"pressure\":" + String(pressure, 1);
        json += ",\"altitude\":" + String(altitude, 1);
        json += ",\"health_score\":" + String(healthScore, 1);
        json += ",\"fatigue_index\":" + String(fatigueIndex, 1);
        json += ",\"risk_level\":\"" + riskLevel + "\"";
        json += ",\"recommendation\":\"" + recommendation + "\"";
        json += "}";

        Serial.println(json);
        dataChar.write(json.c_str(), json.length());
        dataChar.notify(json.c_str(), json.length());
    }
}