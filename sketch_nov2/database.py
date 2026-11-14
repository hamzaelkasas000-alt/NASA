import sqlite3
import os
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'astrohealth.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. Astronauts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS astronauts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            callsign TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            mission TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#00f0ff',
            blood_type TEXT DEFAULT 'O+',
            baseline_hr REAL DEFAULT 65.0,
            status TEXT DEFAULT 'NORMAL'
        )
    ''')

    # 2. Telemetry logs (Real-time vitals & environment from MAX30102 + BMP390)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_id INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            heart_rate REAL NOT NULL,
            spo2 REAL NOT NULL,
            temperature REAL NOT NULL,
            pressure REAL NOT NULL,
            altitude REAL NOT NULL,
            health_score REAL NOT NULL,
            fatigue_index REAL NOT NULL,
            risk_level TEXT NOT NULL,
            recommendation TEXT,
            FOREIGN KEY (astronaut_id) REFERENCES astronauts (id)
        )
    ''')

    # 3. Medical & Mission Alerts table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_id INTEGER NOT NULL,
            astronaut_name TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            indicator TEXT,
            value TEXT,
            severity TEXT NOT NULL, -- Normal, Below, Above, Critical
            message TEXT NOT NULL,
            action TEXT,
            acknowledged INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Open',
            FOREIGN KEY (astronaut_id) REFERENCES astronauts (id)
        )
    ''')

    # 4. Cognitive Performance / PVT Tests
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cognitive_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_id INTEGER NOT NULL,
            astronaut_name TEXT,
            game_id INTEGER DEFAULT 1,
            game_name TEXT DEFAULT 'Reaction',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            score INTEGER DEFAULT 0,
            reaction_time_ms REAL NOT NULL,
            accuracy_pct REAL NOT NULL,
            mistakes INTEGER DEFAULT 0,
            difficulty TEXT DEFAULT 'Fixed',
            readiness_rating TEXT NOT NULL,
            FOREIGN KEY (astronaut_id) REFERENCES astronauts (id)
        )
    ''')

    # 5. Spacecraft Environmental Systems (ECLSS)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS eclss_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            cabin_pressure_kpa REAL DEFAULT 101.3,
            cabin_temp_c REAL DEFAULT 22.0,
            oxygen_pct REAL DEFAULT 21.0,
            co2_pct REAL DEFAULT 0.35,
            humidity_pct REAL DEFAULT 45.0,
            radiation_usv_hr REAL DEFAULT 14.5,
            scrubber_status TEXT DEFAULT 'OPTIMAL',
            water_recovery_pct REAL DEFAULT 96.5,
            mode TEXT DEFAULT 'spacecraft'
        )
    ''')

    # 6. Prescriptions and Adherence (ASTRA med module)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_name TEXT NOT NULL,
            indicator_key TEXT NOT NULL,
            medication TEXT NOT NULL,
            dose TEXT NOT NULL,
            time_due TEXT NOT NULL,
            frequency TEXT NOT NULL,
            instructions TEXT,
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prescription_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prescription_id INTEGER NOT NULL,
            astronaut_name TEXT NOT NULL,
            date_str TEXT NOT NULL,
            taken_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 7. Earth Support Delayed Messaging
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS support_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_name TEXT NOT NULL,
            direction TEXT NOT NULL, -- 'up' (astro to earth) or 'down' (earth to astro)
            message_text TEXT NOT NULL,
            delay_minutes REAL DEFAULT 1.2,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            delivered_at DATETIME
        )
    ''')

    # 8. Mental Health Check-Ins
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mental_health_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_name TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            mood INTEGER DEFAULT 5,
            stress INTEGER DEFAULT 5,
            anxiety INTEGER DEFAULT 5,
            loneliness INTEGER DEFAULT 5,
            family INTEGER DEFAULT 5,
            sleep_diff INTEGER DEFAULT 5,
            motivation INTEGER DEFAULT 5,
            unsafe_flag INTEGER DEFAULT 0,
            risk_flag INTEGER DEFAULT 0,
            specialist_req INTEGER DEFAULT 0,
            support_req INTEGER DEFAULT 0,
            concern_index REAL DEFAULT 5.0,
            classification TEXT DEFAULT 'Normal'
        )
    ''')

    # 9. Private Journals
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS private_journals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            astronaut_name TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            entry_text TEXT NOT NULL
        )
    ''')

    # Seed astronauts if empty
    cursor.execute('SELECT COUNT(*) FROM astronauts')
    if cursor.fetchone()[0] == 0:
        crew = [
            ('AST-001', 'Cmdr. Rivera', 'Mission Commander', 'ASTRA-1 Deep Space Expedition', '#39A9F5', 'O+', 68.0, 'Normal'),
            ('AST-002', 'Dr. Okafor', 'Flight Surgeon & Science Officer', 'ASTRA-1 Deep Space Expedition', '#23D5F5', 'A+', 74.0, 'Normal'),
            ('AST-003', 'Eng. Tanaka', 'Systems Engineer', 'ASTRA-1 Deep Space Expedition', '#6955D9', 'B+', 80.0, 'Normal'),
            ('AST-004', 'Spec. Haddad', 'Payload Specialist', 'ASTRA-1 Deep Space Expedition', '#e8a20c', 'AB+', 86.0, 'Needs attention'),
            ('AST-005', 'Hamza (Commander)', 'Lead Pilot & Hardware Test Lead', 'ASTRA-1 Deep Space Expedition', '#00f0ff', 'O+', 65.0, 'Normal')
        ]
        cursor.executemany('''
            INSERT INTO astronauts (callsign, name, role, mission, avatar_color, blood_type, baseline_hr, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', crew)

        # Seed initial ECLSS status
        cursor.execute('''
            INSERT INTO eclss_status (cabin_pressure_kpa, cabin_temp_c, oxygen_pct, co2_pct, humidity_pct, radiation_usv_hr, scrubber_status, water_recovery_pct, mode)
            VALUES (101.32, 22.4, 20.9, 0.32, 45.0, 14.2, 'OPTIMAL', 96.8, 'spacecraft')
        ''')

        # Seed initial prescriptions
        rx_seed = [
            ('Cmdr. Rivera', 'bone', 'Vitamin D3 & Calcium', '1000 IU', '08:00', 'Daily', 'Take with morning meal'),
            ('Cmdr. Rivera', 'sleep', 'Melatonin Controlled-Release', '3 mg', '21:30', 'As needed', 'Take 30 min before sleep period'),
            ('Spec. Haddad', 'hr', 'Electrolyte Balance Fluid Pack', '500 mL', '11:00', 'Twice daily', 'Maintain cardiovascular hydration')
        ]
        cursor.executemany('''
            INSERT INTO prescriptions (astronaut_name, indicator_key, medication, dose, time_due, frequency, instructions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', rx_seed)

        # Seed initial telemetry for Cmdr. Rivera
        base_time = datetime.now() - timedelta(minutes=30)
        telemetry_samples = []
        for i in range(15):
            t_time = base_time + timedelta(minutes=i*2)
            hr = round(68.0 + random.uniform(-3, 5), 1)
            spo2 = round(98.0 + random.uniform(-0.5, 0.5), 1)
            temp = round(36.7 + random.uniform(-0.2, 0.2), 1)
            pressure = round(1013.25 + random.uniform(-0.5, 0.5), 1)
            altitude = round(20.0 + random.uniform(-1, 1), 1)
            health = 96.0
            fatigue = round(8.0 + (i * 0.4), 1)
            risk = "Normal"
            rec = "Continue monitoring."
            telemetry_samples.append((1, t_time.strftime('%Y-%m-%d %H:%M:%S'), hr, spo2, temp, pressure, altitude, health, fatigue, risk, rec))

        cursor.executemany('''
            INSERT INTO telemetry (astronaut_id, timestamp, heart_rate, spo2, temperature, pressure, altitude, health_score, fatigue_index, risk_level, recommendation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', telemetry_samples)

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database updated with ASTRA tables at:", DB_PATH)
