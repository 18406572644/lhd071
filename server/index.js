const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 6071;
app.listen(PORT, function () {
  console.log('滑板公园预约系统服务器运行在端口 ' + PORT);
});

module.exports = app;
