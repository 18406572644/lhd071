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
  
  const existing = db.prepare('SELECT * FROM coaches WHERE id = ?').get(coachId);
  
  db.prepare(`
    UPDATE coaches SET 
      name = ?,
      phone = ?,
      specialty = ?,
      hourly_rate = ?,
      bio = ?,
      photos = ?,
      videos = ?,
      experience = ?
    WHERE id = ?
  `).run(
    name !== undefined ? (name || null) : existing.name,
    phone !== undefined ? (phone || null) : existing.phone,
    specialty !== undefined ? (specialty || null) : existing.specialty,
    hourly_rate !== undefined ? hourly_rate : existing.hourly_rate,
    bio !== undefined ? (bio || null) : existing.bio,
    photos !== undefined ? photos : existing.photos,
    videos !== undefined ? videos : existing.videos,
    experience !== undefined ? experience : existing.experience,
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
    SELECT 
      b.*, 
      u.username, 
      u.phone, 
      u.created_at as user_created_at,
      ts.start_time, 
      ts.end_time, 
      ts.session_type, 
      cn.note as student_note,
      (SELECT COUNT(DISTINCT b2.id) FROM bookings b2 
       WHERE b2.user_id = b.user_id AND b2.coach_id = ? AND b2.status IN ('paid', 'checked_in')) as total_lessons,
      (SELECT MAX(b2.booking_date) FROM bookings b2 
       WHERE b2.user_id = b.user_id AND b2.coach_id = ? AND b2.status IN ('paid', 'checked_in')) as last_lesson_date,
      (SELECT AVG(b2.rating) FROM bookings b2 
       WHERE b2.user_id = b.user_id AND b2.coach_id = ? AND b2.status IN ('paid', 'checked_in') AND b2.rating IS NOT NULL) as avg_rating
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN time_slots ts ON b.slot_id = ts.id
    LEFT JOIN coach_notes cn ON cn.coach_id = ? AND cn.student_id = b.user_id
    WHERE b.id = ? AND b.coach_id = ?
  `).get(coachId, coachId, coachId, coachId, req.params.id, coachId);
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
      u.id, u.username, u.phone, u.created_at,
      COUNT(DISTINCT CASE WHEN b.status IN ('paid', 'checked_in') THEN b.id END) as total_lessons,
      MAX(b.booking_date) as last_lesson_date,
      AVG(CASE WHEN b.status IN ('paid', 'checked_in') AND b.rating IS NOT NULL THEN b.rating END) as avg_rating,
      cn.note
    FROM users u
    JOIN bookings b ON b.user_id = u.id
    LEFT JOIN coach_notes cn ON cn.coach_id = ? AND cn.student_id = u.id
    WHERE b.coach_id = ? AND b.status != 'cancelled'
    GROUP BY u.id, u.username, u.phone, u.created_at, cn.note
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
      COUNT(DISTINCT CASE WHEN b.status IN ('paid', 'checked_in') THEN b.id END) as total_lessons,
      MAX(b.booking_date) as last_lesson_date,
      AVG(CASE WHEN b.status IN ('paid', 'checked_in') AND b.rating IS NOT NULL THEN b.rating END) as avg_rating
    FROM users u
    LEFT JOIN bookings b ON b.user_id = u.id AND b.coach_id = ?
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

function generateScheduleForCoach(coachId, weeks = 2, startDate = null) {
  const preferences = db.prepare(`
    SELECT * FROM coach_preferences
    WHERE coach_id = ? AND is_available = 1
    ORDER BY day_of_week, start_time
  `).all(coachId);

  if (preferences.length === 0) {
    return { generated: 0, message: '未设置可用时间偏好' };
  }

  const exceptions = db.prepare(`
    SELECT date, type FROM coach_schedule_exceptions
    WHERE coach_id = ?
  `).all(coachId);
  const offDates = new Set(exceptions.filter(e => e.type === 'off').map(e => e.date));

  const allPrivateSlots = db.prepare(`
    SELECT * FROM time_slots WHERE session_type = 'private'
    ORDER BY start_time
  `).all();

  const today = new Date();
  const start = startDate ? new Date(startDate) : new Date(today);
  start.setHours(0, 0, 0, 0);

  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + weeks * 7 - 1);

  const insertSchedule = db.prepare(`
    INSERT INTO coach_schedules (coach_id, date, slot_id, available, source)
    VALUES (?, ?, ?, ?, 'auto')
  `);

  const updateAuto = db.prepare(`
    UPDATE coach_schedules SET available = 1, source = 'auto'
    WHERE coach_id = ? AND date = ? AND slot_id = ? AND source = 'auto'
  `);

  let generatedCount = 0;
  let skippedManualCount = 0;
  const skippedDates = [];

  const transaction = db.transaction(() => {
    for (let d = new Date(start); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();

      if (offDates.has(dateStr)) {
        skippedDates.push({ date: dateStr, reason: '例外日期-休息' });
        continue;
      }

      const dayPrefs = preferences.filter(p => p.day_of_week === dayOfWeek);
      if (dayPrefs.length === 0) {
        continue;
      }

      for (const slot of allPrivateSlots) {
        const slotStart = slot.start_time;
        const slotEnd = slot.end_time;

        let isAvailable = false;
        for (const pref of dayPrefs) {
          if (slotStart >= pref.start_time && slotEnd <= pref.end_time) {
            isAvailable = true;
            break;
          }
        }

        if (isAvailable) {
          const existing = db.prepare(`
            SELECT * FROM coach_schedules
            WHERE coach_id = ? AND date = ? AND slot_id = ?
          `).get(coachId, dateStr, slot.id);

          if (existing) {
            if (existing.source === 'manual' || existing.source === 'exception') {
              skippedManualCount++;
            } else {
              updateAuto.run(coachId, dateStr, slot.id);
              generatedCount++;
            }
          } else {
            try {
              insertSchedule.run(coachId, dateStr, slot.id, 1);
              generatedCount++;
            } catch (e) {
              if (e.message && e.message.includes('UNIQUE')) {
                skippedManualCount++;
              } else {
                throw e;
              }
            }
          }
        }
      }
    }
  });

  try {
    transaction();
    return {
      generated: generatedCount,
      skipped_manual: skippedManualCount,
      weeks,
      start_date: start.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      skipped_dates: skippedDates
    };
  } catch (e) {
    throw e;
  }
}

router.post('/schedule/generate', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }

  const { weeks = 2, start_date } = req.body;

  if (weeks < 1 || weeks > 4) {
    return res.status(400).json({ error: '周数必须在 1-4 周之间' });
  }

  try {
    const result = generateScheduleForCoach(coachId, weeks, start_date);
    res.json({
      message: `成功生成 ${result.generated} 个可预约时段`,
      ...result
    });
  } catch (e) {
    console.error('生成排班失败:', e);
    res.status(500).json({ error: '生成排班失败' });
  }
});

router.get('/schedule/overview', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }

  const { start, end } = req.query;

  let sql = `
    SELECT cs.*, ts.start_time, ts.end_time
    FROM coach_schedules cs
    JOIN time_slots ts ON cs.slot_id = ts.id
    WHERE cs.coach_id = ?
  `;
  const params = [coachId];

  if (start) {
    sql += ' AND cs.date >= ?';
    params.push(start);
  }
  if (end) {
    sql += ' AND cs.date <= ?';
    params.push(end);
  }

  sql += ' ORDER BY cs.date, ts.start_time';

  const schedule = db.prepare(sql).all(...params);

  const exceptions = db.prepare(`
    SELECT * FROM coach_schedule_exceptions
    WHERE coach_id = ?
  `).all(coachId);

  res.json({ schedule, exceptions });
});

router.post('/schedule/batch-adjust', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }

  const { date_range, day_of_week, time_range, action, new_start_time, new_end_time } = req.body;

  if (!date_range || !date_range.start || !date_range.end) {
    return res.status(400).json({ error: '请提供日期范围' });
  }

  if (!action) {
    return res.status(400).json({ error: '请提供调整操作' });
  }

  let sql = `
    SELECT cs.*, ts.start_time, ts.end_time
    FROM coach_schedules cs
    JOIN time_slots ts ON cs.slot_id = ts.id
    WHERE cs.coach_id = ? AND cs.date >= ? AND cs.date <= ?
  `;
  const params = [coachId, date_range.start, date_range.end];

  if (day_of_week !== undefined && day_of_week !== null) {
    sql += " AND strftime('%w', cs.date) = ?";
    params.push(String(day_of_week));
  }

  if (time_range && time_range.start && time_range.end) {
    sql += ' AND ts.start_time >= ? AND ts.end_time <= ?';
    params.push(time_range.start, time_range.end);
  }

  const schedules = db.prepare(sql).all(...params);

  if (schedules.length === 0) {
    return res.json({ message: '没有匹配的时段', updated: 0 });
  }

  const updateStmt = db.prepare(`
    UPDATE coach_schedules SET available = ?, source = 'manual'
    WHERE id = ?
  `);

  let updatedCount = 0;

  const transaction = db.transaction(() => {
    for (const sched of schedules) {
      let available = sched.available;

      if (action === 'enable') {
        available = 1;
      } else if (action === 'disable') {
        available = 0;
      } else if (action === 'toggle') {
        available = sched.available ? 0 : 1;
      }

      if (available !== sched.available) {
        updateStmt.run(available, sched.id);
        updatedCount++;
      }
    }
  });

  try {
    transaction();
    res.json({
      message: `成功调整 ${updatedCount} 个时段`,
      updated: updatedCount,
      total_matched: schedules.length
    });
  } catch (e) {
    console.error('批量调整失败:', e);
    res.status(500).json({ error: '批量调整失败' });
  }
});

router.get('/schedule/exceptions', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }

  const exceptions = db.prepare(`
    SELECT * FROM coach_schedule_exceptions
    WHERE coach_id = ?
    ORDER BY date
  `).all(coachId);

  res.json({ exceptions });
});

router.post('/schedule/exceptions', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }

  const { date, type, reason } = req.body;

  if (!date || !type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  if (!['off', 'custom'].includes(type)) {
    return res.status(400).json({ error: '类型无效' });
  }

  const existing = db.prepare(`
    SELECT * FROM coach_schedule_exceptions
    WHERE coach_id = ? AND date = ?
  `).get(coachId, date);

  let result;
  if (existing) {
    result = db.prepare(`
      UPDATE coach_schedule_exceptions SET type = ?, reason = ?
      WHERE id = ?
    `).run(type, reason || null, existing.id);
  } else {
    result = db.prepare(`
      INSERT INTO coach_schedule_exceptions (coach_id, date, type, reason)
      VALUES (?, ?, ?, ?)
    `).run(coachId, date, type, reason || null);
  }

  if (type === 'off') {
    db.prepare(`
      UPDATE coach_schedules
      SET available = 0, source = 'exception'
      WHERE coach_id = ? AND date = ?
    `).run(coachId, date);
  }

  const exception = db.prepare(`
    SELECT * FROM coach_schedule_exceptions WHERE id = ?
  `).get(existing ? existing.id : result.lastInsertRowid);

  res.json({ message: existing ? '更新成功' : '添加成功', exception });
});

router.delete('/schedule/exceptions/:id', authMiddleware, roleCheck('coach'), function (req, res) {
  const coachId = getCoachIdByUserId(req.user.id);
  if (!coachId) {
    return res.status(404).json({ error: '教练信息不存在' });
  }

  const exception = db.prepare(`
    SELECT * FROM coach_schedule_exceptions WHERE id = ? AND coach_id = ?
  `).get(req.params.id, coachId);

  if (!exception) {
    return res.status(404).json({ error: '例外日期不存在' });
  }

  const date = exception.date;

  db.prepare('DELETE FROM coach_schedule_exceptions WHERE id = ?').run(req.params.id);

  if (exception.type === 'off') {
    const prefs = db.prepare(`
      SELECT * FROM coach_preferences
      WHERE coach_id = ? AND is_available = 1 AND day_of_week = strftime('%w', ?)
    `).all(coachId, date);

    if (prefs.length > 0) {
      const slots = db.prepare(`
        SELECT ts.* FROM time_slots ts
        WHERE ts.session_type = 'private'
        ORDER BY ts.start_time
      `).all();

      for (const slot of slots) {
        for (const pref of prefs) {
          if (slot.start_time >= pref.start_time && slot.end_time <= pref.end_time) {
            const existing = db.prepare(`
              SELECT * FROM coach_schedules
              WHERE coach_id = ? AND date = ? AND slot_id = ?
            `).get(coachId, date, slot.id);

            if (existing && existing.source === 'exception') {
              db.prepare(`
                UPDATE coach_schedules SET available = 1, source = 'auto'
                WHERE id = ?
              `).run(existing.id);
            }
            break;
          }
        }
      }
    }
  }

  res.json({ message: '删除成功' });
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
module.exports.generateScheduleForCoach = generateScheduleForCoach;
