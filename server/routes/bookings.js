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

function checkTimeConflict(user_id, booking_date, slot_id, exclude_booking_id = null) {
  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(slot_id);
  if (!slot) return null;
  
  let sql = `
    SELECT b.id, ts.start_time, ts.end_time
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.user_id = ? AND b.booking_date = ? AND b.status != 'cancelled'
  `;
  const params = [user_id, booking_date];
  
  if (exclude_booking_id) {
    sql += ' AND b.id != ?';
    params.push(exclude_booking_id);
  }
  
  const existingBookings = db.prepare(sql).all(...params);
  
  for (const booking of existingBookings) {
    const newStart = slot.start_time;
    const newEnd = slot.end_time;
    const existStart = booking.start_time;
    const existEnd = booking.end_time;
    
    if (newStart < existEnd && newEnd > existStart) {
      return { conflict: true, conflictSlot: booking };
    }
  }
  
  return { conflict: false };
}

router.post('/', authMiddleware, function (req, res) {
  const { slot_id, booking_date, type, coach_id } = req.body;
  if (!slot_id || !booking_date || !type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(slot_id);
  if (!slot) {
    return res.status(404).json({ error: '时间段不存在' });
  }
  
  const conflictResult = checkTimeConflict(req.user.id, booking_date, slot_id);
  if (conflictResult && conflictResult.conflict) {
    return res.status(400).json({ 
      error: '时段冲突',
      conflict_info: {
        message: `与您已预约的 ${conflictResult.conflictSlot.start_time}-${conflictResult.conflictSlot.end_time} 时段时间重叠`,
        conflict_time: `${conflictResult.conflictSlot.start_time}-${conflictResult.conflictSlot.end_time}`
      }
    });
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

router.get('/recommend/slots', authMiddleware, function (req, res) {
  const userId = req.user.id;
  
  const historyStats = db.prepare(`
    SELECT 
      CASE WHEN strftime('%w', booking_date) IN ('0', '6') THEN 'weekend' ELSE 'weekday' END as day_type,
      CASE 
        WHEN ts.start_time >= '06:00' AND ts.start_time < '12:00' THEN 'morning'
        WHEN ts.start_time >= '12:00' AND ts.start_time < '18:00' THEN 'afternoon'
        WHEN ts.start_time >= '18:00' AND ts.start_time < '22:00' THEN 'evening'
        ELSE 'night'
      END as time_period,
      COUNT(*) as count
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.user_id = ? AND b.status != 'cancelled'
    GROUP BY day_type, time_period
    ORDER BY count DESC
    LIMIT 5
  `).all(userId);
  
  let preferredDayType = 'weekday';
  let preferredTimePeriod = 'morning';
  
  if (historyStats.length > 0) {
    const topPref = historyStats[0];
    preferredDayType = topPref.day_type;
    preferredTimePeriod = topPref.time_period;
  }
  
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayType = isWeekend ? 'weekend' : 'weekday';
    
    if (dayType === preferredDayType) {
      dates.push(dateStr);
    }
    if (dates.length >= 3) break;
  }
  
  if (dates.length === 0) {
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  
  const recommendedSlots = [];
  const timeRangeMap = {
    morning: { start: '06:00', end: '12:00' },
    afternoon: { start: '12:00', end: '18:00' },
    evening: { start: '18:00', end: '22:00' },
    night: { start: '22:00', end: '06:00' }
  };
  
  const timeRange = timeRangeMap[preferredTimePeriod];
  
  for (const date of dates) {
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const slotType = isWeekend ? 'weekend' : 'weekday';
    
    let slots;
    if (timeRange) {
      slots = db.prepare(`
        SELECT ts.* 
        FROM time_slots ts
        WHERE ts.type = ? 
          AND ts.session_type = 'open'
          AND ts.start_time >= ? 
          AND ts.start_time < ?
        ORDER BY ts.start_time ASC
      `).all(slotType, timeRange.start, timeRange.end);
    } else {
      slots = db.prepare(`
        SELECT ts.* 
        FROM time_slots ts
        WHERE ts.type = ? AND ts.session_type = 'open'
        ORDER BY ts.start_time ASC
      `).all(slotType);
    }
    
    const bookingCountStmt = db.prepare(`
      SELECT COUNT(*) as cnt FROM bookings 
      WHERE slot_id = ? AND booking_date = ? AND status IN ('paid', 'pending', 'checked_in')
    `);
    
    for (const slot of slots) {
      const count = bookingCountStmt.get(slot.id, date).cnt;
      const remaining = slot.capacity - count;
      
      if (remaining > 0) {
        let status = 'plenty';
        if (remaining <= 3) status = 'limited';
        
        recommendedSlots.push({
          ...slot,
          date,
          remaining,
          status,
          day_type: slotType
        });
      }
    }
  }
  
  recommendedSlots.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.start_time.localeCompare(b.start_time);
  });
  
  const topRecommendations = recommendedSlots.slice(0, 6);
  
  res.json({ 
    recommendations: topRecommendations,
    preference: {
      day_type: preferredDayType,
      time_period: preferredTimePeriod
    }
  });
});

router.post('/batch', authMiddleware, function (req, res) {
  const { slot_ids, booking_date, type, coach_id } = req.body;
  
  if (!slot_ids || !Array.isArray(slot_ids) || slot_ids.length < 2 || slot_ids.length > 3) {
    return res.status(400).json({ error: '请选择 2-3 个连续时段' });
  }
  if (!booking_date || !type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  const slots = db.prepare(`
    SELECT * FROM time_slots WHERE id IN (${slot_ids.map(() => '?').join(', ')})
    ORDER BY start_time ASC
  `).all(...slot_ids);
  
  if (slots.length !== slot_ids.length) {
    return res.status(400).json({ error: '部分时段不存在' });
  }
  
  for (let i = 0; i < slots.length - 1; i++) {
    if (slots[i].end_time !== slots[i + 1].start_time) {
      return res.status(400).json({ 
        error: '时段不连续',
        message: `${slots[i].start_time}-${slots[i].end_time} 与 ${slots[i + 1].start_time}-${slots[i + 1].end_time} 不连续`
      });
    }
  }
  
  for (const slot of slots) {
    const conflictResult = checkTimeConflict(req.user.id, booking_date, slot.id);
    if (conflictResult && conflictResult.conflict) {
      return res.status(400).json({ 
        error: '时段冲突',
        conflict_info: {
          message: `${slot.start_time}-${slot.end_time} 与您已预约的 ${conflictResult.conflictSlot.start_time}-${conflictResult.conflictSlot.end_time} 时段时间重叠`,
          conflict_time: `${conflictResult.conflictSlot.start_time}-${conflictResult.conflictSlot.end_time}`
        }
      });
    }
  }
  
  const bookingCountStmt = db.prepare(`
    SELECT COUNT(*) as cnt FROM bookings 
    WHERE slot_id = ? AND booking_date = ? AND status IN ('paid', 'pending', 'checked_in')
  `);
  
  for (const slot of slots) {
    if (type === 'venue' || slot.session_type === 'open') {
      const count = bookingCountStmt.get(slot.id, booking_date).cnt;
      if (count >= slot.capacity) {
        return res.status(400).json({ 
          error: '时段已满',
          slot: `${slot.start_time}-${slot.end_time}`
        });
      }
    }
  }
  
  if (type === 'private' && !coach_id) {
    return res.status(400).json({ error: '私教课必须选择教练' });
  }
  
  const insertBooking = db.prepare(`
    INSERT INTO bookings (user_id, slot_id, booking_date, type, coach_id, status, payment_status, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const totalAmount = slots.reduce((sum, slot) => sum + slot.price, 0);
  const bookingIds = [];
  
  const transaction = db.transaction(() => {
    for (const slot of slots) {
      const result = insertBooking.run(
        req.user.id, slot.id, booking_date, type, coach_id || null, 'pending', 'unpaid', slot.price
      );
      bookingIds.push(result.lastInsertRowid);
    }
  });
  
  try {
    transaction();
  } catch (e) {
    return res.status(500).json({ error: '批量预约失败' });
  }
  
  const bookings = db.prepare(`
    SELECT b.*, ts.start_time, ts.end_time, ts.session_type
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.id IN (${bookingIds.map(() => '?').join(', ')})
    ORDER BY ts.start_time ASC
  `).all(...bookingIds);
  
  res.json({ 
    message: '批量预约成功，请前往支付',
    bookings,
    total_amount: totalAmount
  });
});

module.exports = router;
