const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/all', authMiddleware, roleCheck('admin'), function (req, res) {
  const bookings = db.prepare(`
    SELECT b.*, u.username, u.phone, ts.start_time, ts.end_time, ts.session_type, c.name as coach_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coaches c ON b.coach_id = c.id
    ORDER BY b.created_at DESC
  `).all();
  res.json({ bookings });
});

router.post('/', authMiddleware, function (req, res) {
  const { slot_id, booking_date, type, coach_id } = req.body;
  if (!slot_id || !booking_date || !type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(slot_id);
  if (!slot) {
    return res.status(404).json({ error: '时间段不存在' });
  }
  const duplicate = db.prepare('SELECT id FROM bookings WHERE user_id = ? AND slot_id = ? AND booking_date = ? AND status != ?').get(
    req.user.id, slot_id, booking_date, 'cancelled'
  );
  if (duplicate) {
    return res.status(400).json({ error: '您已预约了该日期的此时段' });
  }
  if (type === 'venue' || slot.session_type === 'open') {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM bookings WHERE slot_id = ? AND booking_date = ? AND status IN (?, ?)').get(
      slot_id, booking_date, 'paid', 'checked_in'
    );
    if (count.cnt >= slot.capacity) {
      return res.status(400).json({ error: '该时段已满' });
    }
  }
  if (type === 'private' || slot.session_type === 'private') {
    if (!coach_id) {
      return res.status(400).json({ error: '私教课必须选择教练' });
    }
    const schedule = db.prepare('SELECT * FROM coach_schedules WHERE coach_id = ? AND date = ? AND slot_id = ? AND available = 1').get(
      coach_id, booking_date, slot_id
    );
    if (!schedule) {
      return res.status(400).json({ error: '该教练在此时段不可用' });
    }
  }
  const result = db.prepare('INSERT INTO bookings (user_id, slot_id, booking_date, type, coach_id, status, payment_status, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    req.user.id, slot_id, booking_date, type, coach_id || null, 'pending', 'unpaid', slot.price
  );
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '预约成功', booking });
});

router.get('/', authMiddleware, function (req, res) {
  const { status } = req.query;
  let bookings;
  if (status) {
    bookings = db.prepare(`
      SELECT b.*, ts.start_time, ts.end_time, ts.session_type, c.name as coach_name
      FROM bookings b
      JOIN time_slots ts ON b.slot_id = ts.id
      LEFT JOIN coaches c ON b.coach_id = c.id
      WHERE b.user_id = ? AND b.status = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id, status);
  } else {
    bookings = db.prepare(`
      SELECT b.*, ts.start_time, ts.end_time, ts.session_type, c.name as coach_name
      FROM bookings b
      JOIN time_slots ts ON b.slot_id = ts.id
      LEFT JOIN coaches c ON b.coach_id = c.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);
  }
  res.json({ bookings });
});

router.get('/:id', authMiddleware, function (req, res) {
  const booking = db.prepare(`
    SELECT b.*, ts.start_time, ts.end_time, ts.session_type, ts.type as slot_type, c.name as coach_name
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coaches c ON b.coach_id = c.id
    WHERE b.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  res.json({ booking });
});

router.put('/:id/cancel', authMiddleware, function (req, res) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  if (booking.status !== 'paid') {
    return res.status(400).json({ error: '只能取消已支付的预约' });
  }
  db.prepare('UPDATE bookings SET status = ?, payment_status = ? WHERE id = ?').run('cancelled', 'refunded', booking.id);
  db.prepare('UPDATE users SET balance = balance + ?, points = points + ? WHERE id = ?').run(booking.amount, Math.floor(booking.amount * 0.1), booking.user_id);
  db.prepare('INSERT INTO payments (booking_id, user_id, amount, type, method, status) VALUES (?, ?, ?, ?, ?, ?)').run(booking.id, booking.user_id, booking.amount, 'refund', 'balance', 'refunded');
  res.json({ message: '取消成功，已退款' });
});

router.post('/:id/pay', authMiddleware, function (req, res) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  if (booking.status !== 'pending') {
    return res.status(400).json({ error: '该预约无法支付' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.balance < booking.amount) {
    return res.status(400).json({ error: '余额不足' });
  }
  const points = Math.floor(booking.amount * 0.1);
  db.prepare('UPDATE users SET balance = balance - ?, points = points + ? WHERE id = ?').run(booking.amount, points, req.user.id);
  db.prepare('UPDATE bookings SET status = ?, payment_status = ? WHERE id = ?').run('paid', 'paid', booking.id);
  db.prepare('INSERT INTO payments (booking_id, user_id, amount, type, method, status) VALUES (?, ?, ?, ?, ?, ?)').run(booking.id, req.user.id, booking.amount, 'payment', 'balance', 'success');
  if (booking.type === 'private' && booking.coach_id) {
    db.prepare('UPDATE coach_schedules SET available = 0 WHERE coach_id = ? AND date = ? AND slot_id = ?').run(
      booking.coach_id, booking.booking_date, booking.slot_id
    );
  }
  const updatedBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
  const updatedUser = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '支付成功', booking: updatedBooking, balance: updatedUser.balance, points: updatedUser.points });
});

module.exports = router;
