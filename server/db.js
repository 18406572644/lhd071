const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'skatepark.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'coach')),
    balance REAL DEFAULT 0,
    points INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('weekday', 'weekend')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    price REAL NOT NULL,
    session_type TEXT NOT NULL CHECK(session_type IN ('open', 'private'))
  );

  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    specialty TEXT,
    hourly_rate REAL,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    booking_date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('venue', 'private')),
    coach_id INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'checked_in', 'cancelled')),
    payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'refunded')),
    amount REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (slot_id) REFERENCES time_slots(id),
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
  );

  CREATE TABLE IF NOT EXISTS coach_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    slot_id INTEGER NOT NULL,
    available INTEGER DEFAULT 1,
    FOREIGN KEY (coach_id) REFERENCES coaches(id),
    FOREIGN KEY (slot_id) REFERENCES time_slots(id)
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    total_count INTEGER NOT NULL,
    available_count INTEGER NOT NULL,
    rental_price REAL NOT NULL,
    status TEXT DEFAULT 'normal' CHECK(status IN ('normal', 'damaged', 'repairing'))
  );

  CREATE TABLE IF NOT EXISTS equipment_rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    equipment_id INTEGER NOT NULL,
    booking_id INTEGER,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'rented' CHECK(status IN ('rented', 'returned')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  );

  CREATE TABLE IF NOT EXISTS equipment_repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'repairing', 'done')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (reporter_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    check_in_time TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    type TEXT DEFAULT 'payment' CHECK(type IN ('payment', 'recharge', 'refund')),
    method TEXT NOT NULL CHECK(method IN ('balance', 'wechat', 'alipay')),
    status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'refunded')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'admin', hashedPassword, '13800000000', 'admin', 0, 0
  );

  db.prepare('INSERT INTO coaches (name, phone, specialty, hourly_rate, user_id) VALUES (?, ?, ?, ?, ?)').run(
    '张教练', '13800001111', '街式滑板', 200, null
  );
  db.prepare('INSERT INTO coaches (name, phone, specialty, hourly_rate, user_id) VALUES (?, ?, ?, ?, ?)').run(
    '李教练', '13800002222', '碗池滑板', 180, null
  );

  const insertSlot = db.prepare('INSERT INTO time_slots (type, start_time, end_time, capacity, price, session_type) VALUES (?, ?, ?, ?, ?, ?)');

  const weekdaySlots = [
    ['weekday', '09:00', '10:00', 20, 50, 'open'],
    ['weekday', '10:00', '11:00', 20, 50, 'open'],
    ['weekday', '11:00', '12:00', 20, 50, 'open'],
    ['weekday', '13:00', '14:00', 20, 45, 'open'],
    ['weekday', '14:00', '15:00', 20, 45, 'open'],
    ['weekday', '15:00', '16:00', 20, 50, 'open'],
    ['weekday', '16:00', '17:00', 5, 150, 'private'],
    ['weekday', '17:00', '18:00', 5, 150, 'private']
  ];
  for (const s of weekdaySlots) {
    insertSlot.run(...s);
  }

  const weekendSlots = [
    ['weekend', '09:00', '10:00', 25, 80, 'open'],
    ['weekend', '10:00', '11:00', 25, 80, 'open'],
    ['weekend', '11:00', '12:00', 25, 80, 'open'],
    ['weekend', '13:00', '14:00', 25, 70, 'open'],
    ['weekend', '14:00', '15:00', 25, 70, 'open'],
    ['weekend', '15:00', '16:00', 25, 80, 'open'],
    ['weekend', '16:00', '17:00', 5, 200, 'private'],
    ['weekend', '17:00', '18:00', 5, 200, 'private']
  ];
  for (const s of weekendSlots) {
    insertSlot.run(...s);
  }

  const insertEquipment = db.prepare('INSERT INTO equipment (name, type, total_count, available_count, rental_price, status) VALUES (?, ?, ?, ?, ?, ?)');
  const equipments = [
    ['滑板', 'board', 20, 18, 30, 'normal'],
    ['护具套装', 'protection', 15, 13, 20, 'normal'],
    ['头盔', 'helmet', 15, 14, 15, 'normal'],
    ['轮滑鞋', 'roller_skates', 10, 9, 40, 'normal'],
    ['小轮车', 'bmx', 5, 4, 50, 'normal']
  ];
  for (const e of equipments) {
    insertEquipment.run(...e);
  }
}

module.exports = db;
