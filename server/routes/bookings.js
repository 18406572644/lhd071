const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');
const qrcode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'reviews');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'review-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('只支持图片文件'));
  }
});

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

function generateQrToken(bookingId) {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const token = crypto.createHash('sha256')
    .update(`${bookingId}-${timestamp}-${random}`)
    .digest('hex');
  return token;
}

router.get('/:id/qrcode', authMiddleware, async function (req, res) {
  const booking = db.prepare(`
    SELECT b.*, ts.start_time, ts.end_time, ts.session_type, c.name as coach_name
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coaches c ON b.coach_id = c.id
    WHERE b.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  if (booking.status !== 'paid' && booking.status !== 'checked_in') {
    return res.status(400).json({ error: '只有已支付的预约才能生成签到二维码' });
  }
  
  let qrToken = booking.qr_token;
  if (!qrToken) {
    qrToken = generateQrToken(booking.id);
    db.prepare('UPDATE bookings SET qr_token = ? WHERE id = ?').run(qrToken, booking.id);
  }
  
  try {
    const qrData = JSON.stringify({
      booking_id: booking.id,
      token: qrToken,
      type: 'checkin'
    });
    
    const qrCodeUrl = await qrcode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    res.json({
      qrcode: qrCodeUrl,
      booking: {
        id: booking.id,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        type: booking.type,
        coach_name: booking.coach_name,
        status: booking.status
      },
      token: qrToken
    });
  } catch (e) {
    res.status(500).json({ error: '二维码生成失败' });
  }
});

router.get('/qrcode/verify/:token', authMiddleware, roleCheck('admin'), function (req, res) {
  const { token } = req.params;
  
  const booking = db.prepare(`
    SELECT b.*, u.username, u.phone, ts.start_time, ts.end_time, ts.session_type, c.name as coach_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coaches c ON b.coach_id = c.id
    WHERE b.qr_token = ?
  `).get(token);
  
  if (!booking) {
    return res.status(404).json({ error: '无效的二维码' });
  }
  
  const today = new Date().toISOString().slice(0, 10);
  if (booking.booking_date !== today) {
    return res.status(400).json({ 
      error: '非今日预约',
      booking: {
        id: booking.id,
        username: booking.username,
        phone: booking.phone,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        type: booking.type,
        coach_name: booking.coach_name,
        status: booking.status
      }
    });
  }
  
  res.json({
    valid: true,
    booking: {
      id: booking.id,
      username: booking.username,
      phone: booking.phone,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      type: booking.type,
      coach_name: booking.coach_name,
      status: booking.status
    }
  });
});

router.get('/review/tags', authMiddleware, function (req, res) {
  const { type } = req.query;
  let tags;
  if (type) {
    tags = db.prepare('SELECT * FROM review_tags WHERE type = ? ORDER BY id ASC').all(type);
  } else {
    tags = db.prepare('SELECT * FROM review_tags ORDER BY id ASC').all();
  }
  res.json({ tags });
});

router.post('/:id/review/image', authMiddleware, upload.single('image'), function (req, res) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  if (booking.status !== 'checked_in') {
    return res.status(400).json({ error: '只能对已完成的预约进行评价' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: '请选择要上传的图片' });
  }
  
  const imageUrl = `/api/uploads/reviews/${req.file.filename}`;
  
  const imageCount = db.prepare('SELECT COUNT(*) as cnt FROM review_images WHERE booking_id = ?').get(booking.id).cnt;
  
  const result = db.prepare('INSERT INTO review_images (booking_id, image_url, sort_order) VALUES (?, ?, ?)').run(
    booking.id, imageUrl, imageCount
  );
  
  res.json({
    message: '图片上传成功',
    image: {
      id: result.lastInsertRowid,
      image_url: imageUrl,
      sort_order: imageCount
    }
  });
});

router.post('/:id/review', authMiddleware, function (req, res) {
  const { rating, review, tag_ids } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: '请输入有效的评分（1-5星）' });
  }
  
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  if (booking.status !== 'checked_in') {
    return res.status(400).json({ error: '只能对已完成的预约进行评价' });
  }
  
  const transaction = db.transaction(() => {
    db.prepare('UPDATE bookings SET rating = ?, review = ? WHERE id = ?').run(
      rating, review || null, booking.id
    );
    
    db.prepare('DELETE FROM booking_review_tags WHERE booking_id = ?').run(booking.id);
    
    if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO booking_review_tags (booking_id, tag_id) VALUES (?, ?)');
      for (const tagId of tag_ids) {
        insertTag.run(booking.id, tagId);
      }
    }
  });
  
  try {
    transaction();
  } catch (e) {
    return res.status(500).json({ error: '评价提交失败' });
  }
  
  const updatedBooking = db.prepare(`
    SELECT b.*, ts.start_time, ts.end_time, c.name as coach_name
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coaches c ON b.coach_id = c.id
    WHERE b.id = ?
  `).get(booking.id);
  
  const images = db.prepare('SELECT * FROM review_images WHERE booking_id = ? ORDER BY sort_order ASC').all(booking.id);
  const tags = db.prepare(`
    SELECT rt.* FROM review_tags rt
    JOIN booking_review_tags brt ON rt.id = brt.tag_id
    WHERE brt.booking_id = ?
    ORDER BY rt.id ASC
  `).all(booking.id);
  
  res.json({
    message: '评价提交成功',
    booking: {
      ...updatedBooking,
      review_images: images,
      review_tags: tags
    }
  });
});

router.get('/:id/review', authMiddleware, function (req, res) {
  const booking = db.prepare(`
    SELECT b.*, u.username, ts.start_time, ts.end_time, ts.session_type, c.name as coach_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coaches c ON b.coach_id = c.id
    WHERE b.id = ?
  `).get(req.params.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  if (booking.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'coach') {
    return res.status(403).json({ error: '无权查看该评价' });
  }
  
  const images = db.prepare('SELECT * FROM review_images WHERE booking_id = ? ORDER BY sort_order ASC').all(booking.id);
  const tags = db.prepare(`
    SELECT rt.* FROM review_tags rt
    JOIN booking_review_tags brt ON rt.id = brt.tag_id
    WHERE brt.booking_id = ?
    ORDER BY rt.id ASC
  `).all(booking.id);
  
  const reply = db.prepare('SELECT * FROM review_replies WHERE booking_id = ?').get(booking.id);
  
  res.json({
    review: {
      id: booking.id,
      rating: booking.rating,
      review: booking.review,
      is_featured: booking.is_featured,
      created_at: booking.created_at,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      type: booking.type,
      coach_name: booking.coach_name,
      coach_id: booking.coach_id,
      user_id: booking.user_id,
      username: booking.username,
      images,
      tags,
      reply
    }
  });
});

router.post('/:id/review/reply', authMiddleware, function (req, res) {
  const { content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '回复内容不能为空' });
  }
  
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  if (!booking.review) {
    return res.status(400).json({ error: '该预约暂无评价，无法回复' });
  }
  
  let coachId = null;
  
  if (req.user.role === 'coach') {
    const coach = db.prepare('SELECT * FROM coaches WHERE user_id = ?').get(req.user.id);
    if (!coach) {
      return res.status(403).json({ error: '无权回复' });
    }
    coachId = coach.id;
    
    if (booking.coach_id !== coach.id) {
      return res.status(403).json({ error: '只能回复自己课程的评价' });
    }
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权回复' });
  } else {
    coachId = booking.coach_id;
  }
  
  const existingReply = db.prepare('SELECT * FROM review_replies WHERE booking_id = ?').get(booking.id);
  
  if (existingReply) {
    db.prepare('UPDATE review_replies SET content = ?, updated_at = datetime("now", "localtime") WHERE id = ?').run(
      content, existingReply.id
    );
  } else {
    db.prepare('INSERT INTO review_replies (booking_id, coach_id, content) VALUES (?, ?, ?)').run(
      booking.id, coachId, content
    );
  }
  
  const reply = db.prepare('SELECT * FROM review_replies WHERE booking_id = ?').get(booking.id);
  
  res.json({
    message: existingReply ? '回复更新成功' : '回复成功',
    reply
  });
});

router.put('/:id/review/feature', authMiddleware, roleCheck('admin'), function (req, res) {
  const { featured } = req.body;
  
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  if (!booking.review) {
    return res.status(400).json({ error: '该预约暂无评价' });
  }
  
  db.prepare('UPDATE bookings SET is_featured = ? WHERE id = ?').run(
    featured ? 1 : 0, booking.id
  );
  
  res.json({
    message: featured ? '已设为优质评价' : '已取消优质评价',
    is_featured: featured ? 1 : 0
  });
});

router.get('/coach/:coachId/reviews', function (req, res) {
  const { coachId } = req.params;
  const { featured, page = 1, pageSize = 10 } = req.query;
  
  const offset = (page - 1) * pageSize;
  
  let sql = `
    SELECT b.id, b.rating, b.review, b.is_featured, b.booking_date, b.created_at,
           u.username, ts.start_time, ts.end_time
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.coach_id = ? AND b.review IS NOT NULL
  `;
  
  const params = [coachId];
  
  if (featured === 'true') {
    sql += ' AND b.is_featured = 1';
  }
  
  sql += ' ORDER BY b.is_featured DESC, b.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), parseInt(offset));
  
  const reviews = db.prepare(sql).all(...params);
  
  for (const review of reviews) {
    review.images = db.prepare('SELECT * FROM review_images WHERE booking_id = ? ORDER BY sort_order ASC').all(review.id);
    review.tags = db.prepare(`
      SELECT rt.* FROM review_tags rt
      JOIN booking_review_tags brt ON rt.id = brt.tag_id
      WHERE brt.booking_id = ?
      ORDER BY rt.id ASC
    `).all(review.id);
    
    const reply = db.prepare('SELECT * FROM review_replies WHERE booking_id = ?').get(review.id);
    review.reply = reply || null;
  }
  
  let countSql = 'SELECT COUNT(*) as total FROM bookings WHERE coach_id = ? AND review IS NOT NULL';
  const countParams = [coachId];
  if (featured === 'true') {
    countSql += ' AND is_featured = 1';
  }
  const total = db.prepare(countSql).get(...countParams).total;
  
  res.json({
    reviews,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

module.exports = router;
