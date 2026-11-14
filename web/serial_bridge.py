import serial
import serial.tools.list_ports
import requests
import json
import time
import argparse

API_URL = "http://127.0.0.1:5000/api/telemetry"

def find_serial_port():
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("No serial COM ports detected. Please connect your nRF52840.")
        return None
    print("Available COM Ports:")
    for p in ports:
        print(f"  - {p.device}: {p.description}")
    # Return first available port if multiple
    return ports[0].device

def run_bridge(port=None, baud=115200):
    if not port:
        port = find_serial_port()
        if not port:
            return

    print(f"\n=======================================================")
    print(f" AstroHealth nRF52840 Serial Bridge")
    print(f" Connecting to: {port} @ {baud} baud")
    print(f" Forwarding to: {API_URL}")
    print(f"=======================================================\n")

    try:
        ser = serial.Serial(port, baud, timeout=1.5)
        time.sleep(2) # Wait for MCU reset
        print(f"Connected to {port}. Awaiting telemetry packets...\n")

        while True:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if not line:
                    continue

                if line.startswith('{') and line.endswith('}'):
                    data = json.loads(line)
                    hr = data.get('heart_rate', data.get('hr', '--'))
                    spo2 = data.get('spo2', '--')
                    temp = data.get('temperature', data.get('temp', '--'))
                    press = data.get('pressure', '--')
                    health = data.get('health_score', '--')
                    risk = data.get('risk_level', '--')

                    print(f"[PACKET] HR: {hr} BPM | SpO2: {spo2}% | Temp: {temp}C | Pressure: {press} hPa | Health: {health} | Risk: {risk}")

                    # Forward to Flask REST API
                    try:
                        res = requests.post(API_URL, json=data, timeout=1)
                        if res.status_code == 201:
                            print("  -> Synced with Mission Dashboard (201 OK)")
                    except Exception as e:
                        print(f"  -> Flask POST error: {e}")
                else:
                    # Debug output from firmware
                    print(f"[DEBUG] {line}")

            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"[WARN] Read error: {e}")

    except serial.SerialException as e:
        print(f"[ERROR] Failed to open {port}: {e}")
    except KeyboardInterrupt:
        print("\nBridge stopped by user.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="AstroHealth nRF52840 Serial to Flask Bridge")
    parser.add_argument('--port', help="Serial COM Port (e.g., COM3, COM4)")
    parser.add_argument('--baud', type=int, default=115200, help="Baud rate (default 115200)")
    args = parser.parse_args()

    run_bridge(args.port, args.baud)
