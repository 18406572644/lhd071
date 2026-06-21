const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

function getCoachIdByUserId(userId) {
  const coach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(userId);
  return coach ? coach.id : null;
}

router.get('/me', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const coach = db.prepare(`
    SELECT c.*, u.username, u.phone as user_phone
    FROM coaches c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(coachId);
  res.json({ coach });
});

router.put('/profile', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const { name, phone, specialty, hourly_rate, bio, photos, videos, experience } = req.body;
  db.prepare(`
    UPDATE coaches SET 
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      specialty = COALESCE(?, specialty),
      hourly_rate = COALESCE(?, hourly_rate),
      bio = COALESCE(?, bio),
      photos = COALESCE(?, photos),
      videos = COALESCE(?, videos),
      experience = COALESCE(?, experience)
    WHERE id = ?
  `).run(
    name || null, phone || null, specialty || null, hourly_rate || null,
    bio || null, photos || null, videos || null, experience || null,
    coachId
  );
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(coachId);
  res.json({ message: '更新成功', coach });
});

router.get('/schedule', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const { start, end } = req.query;
  let sql = `
    SELECT b.*, u.username, u.phone, ts.start_time, ts.end_time, ts.session_type
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.coach_id = ? AND b.status IN ('paid', 'checked_in', 'pending')
  `;
  const params = [coachId];
  if (start && end) {
    sql += ' AND b.booking_date >= ? AND b.booking_date <= ?';
    params.push(start, end);
  }
  sql += ' ORDER BY b.booking_date, ts.start_time';
  const schedule = db.prepare(sql).all(...params);
  res.json({ schedule });
});

router.get('/bookings/:id', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const booking = db.prepare(`
    SELECT b.*, u.username, u.phone, ts.start_time, ts.end_time, ts.session_type, cn.note as student_note
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coach_notes cn ON cn.coach_id = b.coach_id AND cn.student_id = b.user_id
    WHERE b.id = ? AND b.coach_id = ?
  `).get(req.params.id, coachId);
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  res.json({ booking });
});

router.put('/bookings/:id/note', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND coach_id = ?').get(req.params.id, coachId);
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  const { coach_note } = req.body;
  db.prepare('UPDATE bookings SET coach_note = ? WHERE id = ?').run(coach_note || null, req.params.id);
  res.json({ message: '备注更新成功' });
});

router.get('/students', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const students = db.prepare(`
    SELECT 
      u.id, u.username, u.phone,
      COUNT(DISTINCT CASE WHEN b.status IN ('paid', 'checked_in') THEN b.id END) as total_lessons,
      MAX(b.booking_date) as last_lesson_date,
      AVG(CASE WHEN b.status IN ('paid', 'checked_in') THEN b.rating END) as avg_rating,
      cn.note
    FROM users u
    JOIN bookings b ON b.user_id = u.id
    LEFT JOIN coach_notes cn ON cn.coach_id = ? AND cn.student_id = u.id
    WHERE b.coach_id = ? AND b.status != 'cancelled'
    GROUP BY u.id, u.username, u.phone, cn.note
    ORDER BY last_lesson_date DESC
  `).all(coachId, coachId);
  res.json({ students });
});

router.get('/students/:id', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const student = db.prepare(`
    SELECT 
      u.id, u.username, u.phone, u.created_at,
      COUNT(DISTINCT b.id) as total_lessons,
      MAX(b.booking_date) as last_lesson_date,
      AVG(b.rating) as avg_rating
    FROM users u
    LEFT JOIN bookings b ON b.user_id = u.id AND b.coach_id = ? AND b.status IN ('paid', 'checked_in')
    WHERE u.id = ?
    GROUP BY u.id, u.username, u.phone, u.created_at
  `).get(coachId, req.params.id);
  if (!student) {
    return res.status(404).json({ error: '学员不存在' });
  }
  const lessons = db.prepare(`
    SELECT b.*, ts.start_time, ts.end_time, ts.session_type
    FROM bookings b
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.user_id = ? AND b.coach_id = ? AND b.status IN ('paid', 'checked_in')
    ORDER BY b.booking_date DESC, ts.start_time DESC
  `).all(req.params.id, coachId);
  const note = db.prepare('SELECT note FROM coach_notes WHERE coach_id = ? AND student_id = ?').get(coachId, req.params.id);
  res.json({ student, lessons, note: note ? note.note : null });
});

router.put('/students/:id/note', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const { note } = req.body;
  const existing = db.prepare('SELECT id FROM coach_notes WHERE coach_id = ? AND student_id = ?').get(coachId, req.params.id);
  if (existing) {
    db.prepare('UPDATE coach_notes SET note = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(note || null, existing.id);
  } else {
    db.prepare('INSERT INTO coach_notes (coach_id, student_id, note) VALUES (?, ?, ?)').run(coachId, req.params.id, note || null);
  }
  res.json({ message: '备注更新成功' });
});

router.get('/stats', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-31`;

  const monthHours = db.prepare(`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE coach_id = ? AND booking_date >= ? AND booking_date <= ? AND status IN ('paid', 'checked_in')
  `).get(coachId, startDate, endDate);

  const totalHours = db.prepare(`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE coach_id = ? AND status IN ('paid', 'checked_in')
  `).get(coachId);

  const monthEarnings = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM bookings
    WHERE coach_id = ? AND booking_date >= ? AND booking_date <= ? AND status IN ('paid', 'checked_in')
  `).get(coachId, startDate, endDate);

  const totalEarnings = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM bookings
    WHERE coach_id = ? AND status IN ('paid', 'checked_in')
  `).get(coachId);

  const dailyStats = db.prepare(`
    SELECT 
      booking_date as date,
      COUNT(*) as lesson_count,
      COALESCE(SUM(amount), 0) as earnings
    FROM bookings
    WHERE coach_id = ? AND booking_date >= ? AND booking_date <= ? AND status IN ('paid', 'checked_in')
    GROUP BY booking_date
    ORDER BY booking_date
  `).all(coachId, startDate, endDate);

  const upcomingLessons = db.prepare(`
    SELECT b.*, u.username, u.phone, ts.start_time, ts.end_time
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.coach_id = ? AND b.booking_date >= date('now', 'localtime') AND b.status IN ('paid', 'pending')
    ORDER BY b.booking_date, ts.start_time
    LIMIT 5
  `).all(coachId);

  const recentStudents = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.phone, MAX(b.booking_date) as last_lesson
    FROM users u
    JOIN bookings b ON b.user_id = u.id
    WHERE b.coach_id = ? AND b.status IN ('paid', 'checked_in')
    GROUP BY u.id, u.username, u.phone
    ORDER BY last_lesson DESC
    LIMIT 5
  `).all(coachId);

  res.json({
    stats: {
      monthHours: monthHours.count,
      totalHours: totalHours.count,
      monthEarnings: monthEarnings.total,
      totalEarnings: totalEarnings.total
    },
    dailyStats,
    upcomingLessons,
    recentStudents
  });
});

router.get('/preferences', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const preferences = db.prepare(`
    SELECT * FROM coach_preferences
    WHERE coach_id = ?
    ORDER BY day_of_week, start_time
  `).all(coachId);
  res.json({ preferences });
});

router.put('/preferences', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const { preferences } = req.body;
  if (!Array.isArray(preferences)) {
    return res.status(400).json({ error: '偏好设置格式错误' });
  }

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM coach_preferences WHERE coach_id = ?').run(coachId);
    const insertStmt = db.prepare(`
      INSERT INTO coach_preferences (coach_id, day_of_week, start_time, end_time, is_available)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const pref of preferences) {
      insertStmt.run(
        coachId,
        pref.day_of_week,
        pref.start_time,
        pref.end_time,
        pref.is_available !== undefined ? pref.is_available : 1
      );
    }
  });

  try {
    transaction();
    const updated = db.prepare(`
      SELECT * FROM coach_preferences
      WHERE coach_id = ?
      ORDER BY day_of_week, start_time
    `).all(coachId);
    res.json({ message: '偏好设置更新成功', preferences: updated });
  } catch (e) {
    return res.status(500).json({ error: '保存失败' });
  }
});

router.get('/dashboard', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const todayLessons = db.prepare(`
    SELECT b.*, u.username, u.phone, ts.start_time, ts.end_time
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    WHERE b.coach_id = ? AND b.booking_date = ? AND b.status IN ('paid', 'pending')
    ORDER BY ts.start_time
  `).all(coachId, today);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-31`;

  const monthHours = db.prepare(`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE coach_id = ? AND booking_date >= ? AND booking_date <= ? AND status IN ('paid', 'checked_in')
  `).get(coachId, startDate, endDate);

  const monthEarnings = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM bookings
    WHERE coach_id = ? AND booking_date >= ? AND booking_date <= ? AND status IN ('paid', 'checked_in')
  `).get(coachId, startDate, endDate);

  const totalStudents = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count
    FROM bookings
    WHERE coach_id = ? AND status IN ('paid', 'checked_in')
  `).get(coachId);

  res.json({
    todayLessons,
    stats: {
      todayLessonsCount: todayLessons.length,
      monthHours: monthHours.count,
      monthEarnings: monthEarnings.total,
      totalStudents: totalStudents.count
    }
  });
});

module.exports = router;
