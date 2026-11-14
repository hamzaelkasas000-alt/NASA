import os
import json
import random
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify
from database import get_db, init_db

app = Flask(__name__)
app.config['SECRET_KEY'] = 'nasa-astra-sparc-2026'

# Initialize database schema
init_db()

# Flight Simulation state
simulation_state = {
    'enabled': True,
    'scenario': 'NORMAL',  # 'NORMAL', 'EVA_EXERTION', 'HYPOXIA', 'WORKOUT', 'FEVER'
    'active_astronaut': 'Cmdr. Rivera'
}

def calculate_derived_health(hr, spo2, temp):
    """Firmware v2.0 matching health algorithm"""
    health_score = 100.0
    fatigue_index = 0.0

    if spo2 <= 92.0:
        health_score -= 30.0
        fatigue_index += 40.0
    elif spo2 <= 94.0:
        health_score -= 20.0
        fatigue_index += 30.0

    if hr > 110.0:
        health_score -= 25.0
        fatigue_index += 35.0
    elif hr > 100.0:
        health_score -= 15.0
        fatigue_index += 20.0
    elif hr < 50.0:
        health_score -= 15.0

    if temp > 37.8:
        health_score -= 15.0
        fatigue_index += 15.0
    elif temp > 37.5:
        fatigue_index += 10.0

    health_score = max(0.0, min(100.0, health_score))
    fatigue_index = max(0.0, min(100.0, fatigue_index))

    if health_score >= 80.0:
        risk_level = "Normal"
        recommendation = "Continue mission monitoring."
    elif health_score >= 60.0:
        risk_level = "Above"
        recommendation = "Rest 15 min and repeat measurements."
    else:
        risk_level = "Critical"
        recommendation = "Notify flight surgeon immediately."

    return health_score, fatigue_index, risk_level, recommendation

# ----------------- WEB PAGES -----------------

@app.route('/')
def astra_home():
    return render_template('index.html')

# ----------------- REST API -----------------

@app.route('/api/crew')
def get_crew():
    conn = get_db()
    rows = conn.execute('SELECT * FROM astronauts').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/telemetry', methods=['POST'])
def receive_telemetry():
    """Ingest live packet from nRF52840 (Web Serial, BLE, or Python bridge)"""
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No JSON payload'}), 400

    astro_name = data.get('astronaut_name', simulation_state['active_astronaut'])
    hr = float(data.get('heart_rate', data.get('hr', 72.0)))
    spo2 = float(data.get('spo2', 98.0))
    temp = float(data.get('temperature', data.get('temp', 36.8)))
    pressure = float(data.get('pressure', 1013.25))
    altitude = float(data.get('altitude', 20.0))

    if 'health_score' in data and 'risk_level' in data:
        health_score = float(data['health_score'])
        fatigue_index = float(data.get('fatigue_index', 0.0))
        risk_level = str(data['risk_level'])
        recommendation = str(data.get('recommendation', ''))
    else:
        health_score, fatigue_index, risk_level, recommendation = calculate_derived_health(hr, spo2, temp)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO telemetry (astronaut_id, heart_rate, spo2, temperature, pressure, altitude, health_score, fatigue_index, risk_level, recommendation)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (hr, spo2, temp, pressure, altitude, health_score, fatigue_index, risk_level, recommendation))

    if risk_level in ['Critical', 'Above']:
        cursor.execute('''
            INSERT INTO alerts (astronaut_id, astronaut_name, indicator, value, severity, message, action, status)
            VALUES (1, ?, 'Cardiopulmonary Telemetry', ?, ?, ?, ?, 'Open')
        ''', (astro_name, f"HR {hr} BPM, SpO2 {spo2}%", risk_level, f"Vitals outside nominal range: HR={hr}, SpO2={spo2}%", recommendation))

    conn.commit()
    conn.close()

    return jsonify({
        'status': 'success',
        'health_score': health_score,
        'fatigue_index': fatigue_index,
        'risk_level': risk_level,
        'recommendation': recommendation
    }), 201

@app.route('/api/telemetry/latest')
def get_latest_telemetry():
    conn = get_db()
    row = conn.execute('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1').fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'No telemetry found'}), 404
    return jsonify(dict(row))

@app.route('/api/telemetry/export.csv')
def export_telemetry_csv():
    import csv
    import io
    from flask import Response

    conn = get_db()
    rows = conn.execute('''
        SELECT t.timestamp, a.name as astronaut, t.heart_rate, t.spo2, t.temperature, t.pressure, t.altitude, t.health_score, t.fatigue_index, t.risk_level, t.recommendation
        FROM telemetry t
        LEFT JOIN astronauts a ON t.astronaut_id = a.id
        ORDER BY t.timestamp DESC
    ''').fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Timestamp', 'Astronaut', 'Heart Rate (BPM)', 'SpO2 (%)', 'Temperature (C)', 'Pressure (hPa)', 'Altitude (m)', 'Health Score', 'Fatigue Index', 'Risk Level', 'Recommendation'])
    for r in rows:
        writer.writerow([r['timestamp'], r['astronaut'], r['heart_rate'], r['spo2'], r['temperature'], r['pressure'], r['altitude'], r['health_score'], r['fatigue_index'], r['risk_level'], r['recommendation']])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=ASTRA_Mission_Telemetry.csv"}
    )

@app.route('/api/alerts')
def get_alerts():
    conn = get_db()
    rows = conn.execute('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 30').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/alerts/action', methods=['POST'])
def alert_action():
    data = request.get_json(force=True)
    alert_id = data.get('alert_id')
    new_status = data.get('status', 'Acknowledged') # 'Acknowledged' or 'Resolved'
    conn = get_db()
    conn.execute('UPDATE alerts SET status = ?, acknowledged = 1 WHERE id = ?', (new_status, alert_id))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

@app.route('/api/prescriptions', methods=['GET', 'POST'])
def manage_prescriptions():
    conn = get_db()
    if request.method == 'POST':
        data = request.get_json(force=True)
        conn.execute('''
            INSERT INTO prescriptions (astronaut_name, indicator_key, medication, dose, time_due, frequency, instructions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (data['astronaut_name'], data['indicator_key'], data['medication'], data['dose'], data['time_due'], data['frequency'], data.get('instructions', '')))
        conn.commit()
        conn.close()
        return jsonify({'status': 'created'}), 201
    else:
        rows = conn.execute('SELECT * FROM prescriptions ORDER BY id DESC').fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])

@app.route('/api/prescriptions/confirm', methods=['POST'])
def confirm_prescription():
    data = request.get_json(force=True)
    rx_id = data.get('prescription_id')
    astro_name = data.get('astronaut_name')
    date_str = datetime.now().strftime('%Y-%m-%d')
    conn = get_db()
    conn.execute('''
        INSERT INTO prescription_logs (prescription_id, astronaut_name, date_str)
        VALUES (?, ?, ?)
    ''', (rx_id, astro_name, date_str))
    conn.commit()
    conn.close()
    return jsonify({'status': 'confirmed'})

@app.route('/api/cognitive', methods=['GET', 'POST'])
def manage_cognitive():
    conn = get_db()
    if request.method == 'POST':
        data = request.get_json(force=True)
        conn.execute('''
            INSERT INTO cognitive_tests (astronaut_id, astronaut_name, game_id, game_name, score, reaction_time_ms, accuracy_pct, mistakes, difficulty, readiness_rating)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data.get('astronaut_name', 'Cmdr. Rivera'), data.get('game_id', 1), data.get('game_name', 'Reaction'), data.get('score', 0), data.get('rt', 250), data.get('acc', 100), data.get('mist', 0), data.get('diff', 'Fixed'), data.get('rating', 'Nominal')))
        conn.commit()
        conn.close()
        return jsonify({'status': 'saved'}), 201
    else:
        rows = conn.execute('SELECT * FROM cognitive_tests ORDER BY timestamp DESC LIMIT 25').fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])

@app.route('/api/eclss')
def get_eclss():
    conn = get_db()
    row = conn.execute('SELECT * FROM eclss_status ORDER BY timestamp DESC LIMIT 1').fetchone()
    conn.close()
    return jsonify(dict(row) if row else {})

@app.route('/api/simulate/scenario', methods=['POST'])
def set_scenario():
    data = request.get_json(force=True)
    scenario = data.get('scenario', 'NORMAL')
    simulation_state['scenario'] = scenario
    return jsonify({'status': 'success', 'scenario': scenario})

@app.route('/api/simulate/tick', methods=['POST'])
def simulate_tick():
    scenario = simulation_state['scenario']
    if scenario == 'NORMAL':
        hr = round(68.0 + random.uniform(-4, 5), 1)
        spo2 = round(98.0 + random.uniform(-0.5, 0.5), 1)
        temp = round(36.8 + random.uniform(-0.2, 0.2), 1)
        pressure = round(1013.25 + random.uniform(-0.4, 0.4), 1)
        altitude = round(20.0 + random.uniform(-0.8, 0.8), 1)
    elif scenario == 'EVA_EXERTION':
        hr = round(115.0 + random.uniform(-6, 8), 1)
        spo2 = round(96.0 + random.uniform(-1, 0.5), 1)
        temp = round(37.4 + random.uniform(-0.1, 0.3), 1)
        pressure = round(1012.0 + random.uniform(-1, 1), 1)
        altitude = round(25.0 + random.uniform(-1, 1), 1)
    elif scenario == 'HYPOXIA':
        hr = round(122.0 + random.uniform(-5, 9), 1)
        spo2 = round(89.0 + random.uniform(-2, 1), 1)
        temp = round(36.6 + random.uniform(-0.2, 0.2), 1)
        pressure = round(980.0 + random.uniform(-5, 5), 1)
        altitude = round(280.0 + random.uniform(-10, 10), 1)
    elif scenario == 'WORKOUT':
        hr = round(135.0 + random.uniform(-5, 10), 1)
        spo2 = round(97.0 + random.uniform(-0.5, 0.5), 1)
        temp = round(37.6 + random.uniform(-0.1, 0.2), 1)
        pressure = round(1013.0 + random.uniform(-0.5, 0.5), 1)
        altitude = round(20.0 + random.uniform(-0.5, 0.5), 1)
    elif scenario == 'FEVER':
        hr = round(98.0 + random.uniform(-3, 6), 1)
        spo2 = round(95.0 + random.uniform(-1, 0.5), 1)
        temp = round(38.6 + random.uniform(-0.2, 0.3), 1)
        pressure = round(1013.25 + random.uniform(-0.2, 0.2), 1)
        altitude = round(20.0 + random.uniform(-0.5, 0.5), 1)
    else:
        hr = 70.0; spo2 = 98.0; temp = 36.8; pressure = 1013.25; altitude = 20.0

    health_score, fatigue_index, risk_level, recommendation = calculate_derived_health(hr, spo2, temp)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO telemetry (astronaut_id, heart_rate, spo2, temperature, pressure, altitude, health_score, fatigue_index, risk_level, recommendation)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (hr, spo2, temp, pressure, altitude, health_score, fatigue_index, risk_level, recommendation))
    conn.commit()
    conn.close()

    return jsonify({
        'status': 'tick_recorded',
        'heart_rate': hr,
        'spo2': spo2,
        'temperature': temp,
        'pressure': pressure,
        'altitude': altitude,
        'health_score': health_score,
        'fatigue_index': fatigue_index,
        'risk_level': risk_level,
        'recommendation': recommendation
    })

if __name__ == '__main__':
    print("Starting ASTRA NASA Web Platform on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
