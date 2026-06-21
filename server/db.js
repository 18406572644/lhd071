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
    bio TEXT,
    photos TEXT,
    videos TEXT,
    experience INTEGER DEFAULT 0,
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
    review TEXT,
    rating INTEGER,
    coach_note TEXT,
    qr_token TEXT,
    is_featured INTEGER DEFAULT 0,
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
    source TEXT DEFAULT 'manual' CHECK(source IN ('auto', 'manual', 'exception')),
    FOREIGN KEY (coach_id) REFERENCES coaches(id),
    FOREIGN KEY (slot_id) REFERENCES time_slots(id),
    UNIQUE(coach_id, date, slot_id)
  );

  CREATE TABLE IF NOT EXISTS coach_schedule_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('off', 'custom')),
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
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

  CREATE TABLE IF NOT EXISTS lockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locker_number TEXT NOT NULL,
    store TEXT DEFAULT '主店',
    area TEXT NOT NULL CHECK(area IN ('A', 'B')),
    size TEXT NOT NULL CHECK(size IN ('small', 'medium', 'large')),
    status TEXT DEFAULT 'free' CHECK(status IN ('free', 'in_use', 'fault', 'maintenance')),
    row_num INTEGER DEFAULT 0,
    col_num INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS locker_rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locker_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rental_type TEXT NOT NULL CHECK(rental_type IN ('temporary', 'long_term')),
    billing_cycle TEXT CHECK(billing_cycle IN ('hour', 'day', 'month', 'quarter')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    amount REAL NOT NULL,
    booking_id INTEGER,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (locker_id) REFERENCES lockers(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
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

  CREATE TABLE IF NOT EXISTS coach_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_available INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
  );

  CREATE TABLE IF NOT EXISTS coach_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (coach_id) REFERENCES coaches(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE(coach_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS review_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  );

  CREATE TABLE IF NOT EXISTS review_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('venue', 'coach', 'general')),
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS booking_review_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (tag_id) REFERENCES review_tags(id),
    UNIQUE(booking_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS review_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL UNIQUE,
    coach_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
  );
`);

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'admin', hashedPassword, '13800000000', 'admin', 0, 0
  );

  const coach1Password = bcrypt.hashSync('coach123', 10);
  const coach1UserId = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'coach1', coach1Password, '13800001111', 'coach', 0, 0
  ).lastInsertRowid;
  
  const coach2Password = bcrypt.hashSync('coach123', 10);
  const coach2UserId = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'coach2', coach2Password, '13800002222', 'coach', 0, 0
  ).lastInsertRowid;

  db.prepare('INSERT INTO coaches (name, phone, specialty, hourly_rate, user_id, bio, experience) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    '张教练', '13800001111', '街式滑板', 200, coach1UserId, '从事滑板教学8年，擅长街式动作教学，教学风格耐心细致，深受学员喜爱。', 8
  );
  db.prepare('INSERT INTO coaches (name, phone, specialty, hourly_rate, user_id, bio, experience) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    '李教练', '13800002222', '碗池滑板', 180, coach2UserId, '国家一级滑板运动员，擅长碗池、U池技巧教学，曾获多项国内赛事奖项。', 6
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

  const insertLocker = db.prepare('INSERT INTO lockers (locker_number, store, area, size, status, row_num, col_num) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const lockerData = [
    ['A-01', '主店', 'A', 'small', 'free', 0, 0],
    ['A-02', '主店', 'A', 'small', 'free', 0, 1],
    ['A-03', '主店', 'A', 'small', 'free', 0, 2],
    ['A-04', '主店', 'A', 'small', 'free', 0, 3],
    ['A-05', '主店', 'A', 'medium', 'free', 1, 0],
    ['A-06', '主店', 'A', 'medium', 'free', 1, 1],
    ['A-07', '主店', 'A', 'medium', 'free', 1, 2],
    ['A-08', '主店', 'A', 'medium', 'free', 1, 3],
    ['A-09', '主店', 'A', 'large', 'free', 2, 0],
    ['A-10', '主店', 'A', 'large', 'free', 2, 1],
    ['A-11', '主店', 'A', 'large', 'free', 2, 2],
    ['A-12', '主店', 'A', 'large', 'free', 2, 3],
    ['B-01', '主店', 'B', 'small', 'free', 0, 0],
    ['B-02', '主店', 'B', 'small', 'free', 0, 1],
    ['B-03', '主店', 'B', 'small', 'free', 0, 2],
    ['B-04', '主店', 'B', 'small', 'free', 0, 3],
    ['B-05', '主店', 'B', 'medium', 'free', 1, 0],
    ['B-06', '主店', 'B', 'medium', 'free', 1, 1],
    ['B-07', '主店', 'B', 'medium', 'free', 1, 2],
    ['B-08', '主店', 'B', 'medium', 'free', 1, 3],
    ['B-09', '主店', 'B', 'large', 'free', 2, 0],
    ['B-10', '主店', 'B', 'large', 'free', 2, 1],
    ['B-11', '主店', 'B', 'large', 'free', 2, 2],
    ['B-12', '主店', 'B', 'large', 'free', 2, 3]
  ];
  for (const l of lockerData) {
    insertLocker.run(...l);
  }

  const userPassword = bcrypt.hashSync('user123', 10);
  const student1Id = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'student1', userPassword, '13900001111', 'user', 500, 100
  ).lastInsertRowid;
  const student2Id = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'student2', userPassword, '13900002222', 'user', 300, 50
  ).lastInsertRowid;
  const student3Id = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'student3', userPassword, '13900003333', 'user', 800, 200
  ).lastInsertRowid;
  const student4Id = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    'student4', userPassword, '13900004444', 'user', 200, 30
  ).lastInsertRowid;

  const coach1Id = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(coach1UserId).id;
  const coach2Id = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(coach2UserId).id;

  const privateSlotIds = db.prepare('SELECT id FROM time_slots WHERE session_type = ? ORDER BY id').all('private').map(s => s.id);

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const getDateStr = (daysOffset) => {
    const d = new Date(today.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const insertBooking = db.prepare(`INSERT INTO bookings 
    (user_id, coach_id, slot_id, booking_date, type, status, payment_status, amount, rating, review, coach_note) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const bookingData = [
    [student1Id, coach1Id, privateSlotIds[0] || 7, getDateStr(-10), 'private', 'checked_in', 'paid', 150, 5, '张教练教得非常耐心，动作讲解很细致，第一次上课就学会了基础滑行！', '基础滑行掌握良好，下次练习转弯'],
    [student1Id, coach1Id, privateSlotIds[1] || 8, getDateStr(-7), 'private', 'checked_in', 'paid', 150, 4, '整体不错，就是练习时间有点短', '转弯动作有进步，需要多加练习'],
    [student2Id, coach1Id, privateSlotIds[0] || 7, getDateStr(-5), 'private', 'checked_in', 'paid', 150, 5, '张教练特别有耐心，零基础也完全不用担心', '胆小的学员，需要多鼓励'],
    [student3Id, coach1Id, privateSlotIds[1] || 8, getDateStr(-3), 'private', 'paid', 'paid', 150, null, null, null],
    [student1Id, coach1Id, privateSlotIds[0] || 7, getDateStr(0), 'private', 'paid', 'paid', 150, null, null, null],
    [student2Id, coach1Id, privateSlotIds[1] || 8, getDateStr(1), 'private', 'pending', 'unpaid', 150, null, null, null],
    [student4Id, coach1Id, privateSlotIds[0] || 7, getDateStr(2), 'private', 'pending', 'unpaid', 150, null, null, null],
    [student1Id, coach1Id, privateSlotIds[1] || 8, getDateStr(3), 'private', 'paid', 'paid', 150, null, null, null],
    [student3Id, coach2Id, privateSlotIds[2] || 15, getDateStr(-8), 'private', 'checked_in', 'paid', 180, 5, '李教练碗池技巧太厉害了，学到了很多专业知识', '有基础，适合进阶技巧训练'],
    [student4Id, coach2Id, privateSlotIds[3] || 16, getDateStr(-6), 'private', 'checked_in', 'paid', 180, 4, '李教练要求比较严格，但进步很快', '爆发力不错，注意安全防护'],
    [student3Id, coach2Id, privateSlotIds[2] || 15, getDateStr(-1), 'private', 'paid', 'paid', 180, null, null, null],
    [student4Id, coach2Id, privateSlotIds[3] || 16, getDateStr(1), 'private', 'pending', 'unpaid', 180, null, null, null],
    [student2Id, coach2Id, privateSlotIds[2] || 15, getDateStr(4), 'private', 'pending', 'unpaid', 180, null, null, null],
  ];

  for (const b of bookingData) {
    insertBooking.run(...b);
  }

  db.prepare('INSERT INTO coach_notes (coach_id, student_id, note) VALUES (?, ?, ?)').run(
    coach1Id, student1Id, '学习态度认真，进步很快，建议增加练习频率'
  );
  db.prepare('INSERT INTO coach_notes (coach_id, student_id, note) VALUES (?, ?, ?)').run(
    coach1Id, student2Id, '胆子较小，需要循序渐进，多鼓励'
  );
  db.prepare('INSERT INTO coach_notes (coach_id, student_id, note) VALUES (?, ?, ?)').run(
    coach2Id, student3Id, '有滑板基础，目标明确，适合进阶训练'
  );

  const insertReviewTag = db.prepare('INSERT OR IGNORE INTO review_tags (name, type) VALUES (?, ?)');
  const defaultTags = [
    ['教练耐心', 'coach'],
    ['教练专业', 'coach'],
    ['讲解细致', 'coach'],
    ['场地干净', 'venue'],
    ['设施完善', 'venue'],
    ['环境舒适', 'venue'],
    ['性价比高', 'general'],
    ['体验很棒', 'general'],
    ['值得推荐', 'general'],
    ['服务周到', 'general']
  ];
  for (const tag of defaultTags) {
    insertReviewTag.run(...tag);
  }
}

function addColumnIfNotExists(table, column, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = columns.some(col => col.name === column);
    if (!exists) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  } catch (e) {
    console.log(`迁移列 ${table}.${column} 时出错:`, e.message);
  }
}

addColumnIfNotExists('bookings', 'qr_token', 'TEXT');
addColumnIfNotExists('bookings', 'is_featured', 'INTEGER DEFAULT 0');

addColumnIfNotExists('coach_schedules', 'source', "TEXT DEFAULT 'manual'");

db.exec(`
  CREATE TABLE IF NOT EXISTS coach_schedule_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('off', 'custom')),
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (coach_id) REFERENCES coaches(id)
  );
`);

module.exports = db;
