const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.post('/', authMiddleware, function (req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const { booking_id } = req.body;
  let booking;
  if (booking_id) {
    booking = db.prepare('SELECT b.*, ts.start_time, ts.end_time FROM bookings b JOIN time_slots ts ON b.slot_id = ts.id WHERE b.id = ? AND b.user_id = ? AND b.status = ?').get(booking_id, req.user.id, 'paid');
  } else {
    booking = db.prepare('SELECT b.*, ts.start_time, ts.end_time FROM bookings b JOIN time_slots ts ON b.slot_id = ts.id WHERE b.user_id = ? AND b.booking_date = ? AND b.status = ?').get(req.user.id, today, 'paid');
  }
  if (!booking) {
    return res.status(400).json({ error: '没有可签到的已支付预约' });
  }
  const existing = db.prepare('SELECT id FROM check_ins WHERE booking_id = ?').get(booking.id);
  if (existing) {
    return res.status(400).json({ error: '该预约已签到' });
  }
  db.prepare('INSERT INTO check_ins (booking_id, user_id) VALUES (?, ?)').run(booking.id, req.user.id);
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('checked_in', booking.id);
  res.json({ message: '签到成功', booking_id: booking.id });
});

router.post('/qrcode', authMiddleware, roleCheck('admin'), function (req, res) {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: '缺少签到令牌' });
  }
  
  const booking = db.prepare(`
    SELECT b.*, u.username, u.phone
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.qr_token = ?
  `).get(token);
  
  if (!booking) {
    return res.status(404).json({ error: '无效的二维码' });
  }
  
  if (booking.status === 'checked_in') {
    return res.status(400).json({ error: '该预约已签到', booking_id: booking.id });
  }
  
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: '该预约状态不可签到', status: booking.status });
  }
  
  const today = new Date().toISOString().slice(0, 10);
  if (booking.booking_date !== today) {
    return res.status(400).json({ error: '非今日预约，无法签到' });
  }
  
  const existing = db.prepare('SELECT id FROM check_ins WHERE booking_id = ?').get(booking.id);
  if (existing) {
    return res.status(400).json({ error: '该预约已签到' });
  }
  
  db.prepare('INSERT INTO check_ins (booking_id, user_id) VALUES (?, ?)').run(booking.id, booking.user_id);
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('checked_in', booking.id);
  
  const checkin = db.prepare(`
    SELECT ci.*, u.username, u.phone, b.booking_date, ts.start_time, ts.end_time
    FROM check_ins ci
    JOIN users u ON ci.user_id = u.id
    JOIN bookings b ON ci.booking_id = b.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE ci.booking_id = ?
  `).get(booking.id);
  
  res.json({ 
    message: '签到成功', 
    checkin,
    booking: {
      id: booking.id,
      username: booking.username,
      phone: booking.phone
    }
  });
});

router.get('/', authMiddleware, roleCheck('admin'), function (req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const checkins = db.prepare(`
    SELECT ci.*, u.username, b.booking_date, ts.start_time, ts.end_time
    FROM check_ins ci
    JOIN users u ON ci.user_id = u.id
    JOIN bookings b ON ci.booking_id = b.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.booking_date = ?
    ORDER BY ci.check_in_time DESC
  `).all(today);
  res.json({ checkins });
});

module.exports = router;
