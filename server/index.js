const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/api/uploads', express.static(uploadsDir));

const routesDir = path.join(__dirname, 'routes');
if (fs.existsSync(routesDir)) {
  const routeFiles = fs.readdirSync(routesDir).filter(function (f) { return f.endsWith('.js'); });
  for (const file of routeFiles) {
    const routePath = '/api/' + file.replace('.js', '');
    const router = require(path.join(routesDir, file));
    app.use(routePath, router);
  }
}

cron.schedule('0 * * * *', function () {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const dateStr = oneHourLater.toISOString().slice(0, 10);
  const hourStr = oneHourLater.toTimeString().slice(0, 5);

  const bookings = db.prepare(`
    SELECT b.id, b.user_id, u.username, ts.start_time, ts.end_time, b.booking_date
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.booking_date = ? AND ts.start_time = ? AND b.status IN ('paid', 'pending')
  `).all(dateStr, hourStr);

  const insertMessage = db.prepare('INSERT INTO messages (user_id, type, title, content, is_read) VALUES (?, ?, ?, ?, ?)');
  for (const b of bookings) {
    insertMessage.run(
      b.user_id,
      'reminder',
      '预约提醒',
      '您在 ' + b.booking_date + ' ' + b.start_time + '-' + b.end_time + ' 的滑场预约即将开始，请准时到场。',
      0
    );
  }
});

cron.schedule('0 * * * *', function () {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const dateStr = twoHoursLater.toISOString().slice(0, 10);
  const hourStr = twoHoursLater.toTimeString().slice(0, 5);

  const coachBookings = db.prepare(`
    SELECT 
      b.id, b.coach_id, b.user_id,
      u.username as student_name, u.phone as student_phone,
      ts.start_time, ts.end_time, b.booking_date,
      c.user_id as coach_user_id
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    JOIN coaches c ON c.id = b.coach_id
    WHERE b.booking_date = ? AND ts.start_time = ? 
      AND b.status IN ('paid', 'pending') 
      AND b.coach_id IS NOT NULL
  `).all(dateStr, hourStr);

  const insertMessage = db.prepare('INSERT INTO messages (user_id, type, title, content, is_read) VALUES (?, ?, ?, ?, ?)');
  for (const b of coachBookings) {
    if (b.coach_user_id) {
      insertMessage.run(
        b.coach_user_id,
        'reminder',
        '课程提醒',
        '您在 ' + b.booking_date + ' ' + b.start_time + '-' + b.end_time + 
        ' 有一节私教课，学员：' + b.student_name + 
        '，联系电话：' + (b.student_phone || '未提供') + '，请提前做好准备。',
        0
      );
    }
  }
});

const PORT = process.env.PORT || 6071;
app.listen(PORT, function () {
  console.log('滑板公园预约系统服务器运行在端口 ' + PORT);
});

module.exports = app;
