const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/', function (req, res) {
  const coaches = db.prepare('SELECT * FROM coaches').all();
  res.json({ coaches });
});

router.get('/:id', function (req, res) {
  const { id } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
  }
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as review_count,
      AVG(b.rating) as avg_rating
    FROM bookings b
    WHERE b.coach_id = ? AND b.review IS NOT NULL
  `).get(id);
  
  coach.review_count = stats.review_count || 0;
  coach.avg_rating = stats.avg_rating || null;
  
  res.json({ coach });
});

router.post('/', authMiddleware, roleCheck('admin'), function (req, res) {
  const { name, phone, specialty, hourly_rate, user_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: '教练姓名不能为空' });
  }
  const result = db.prepare('INSERT INTO coaches (name, phone, specialty, hourly_rate, user_id) VALUES (?, ?, ?, ?, ?)').run(
    name, phone || null, specialty || null, hourly_rate || null, user_id || null
  );
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '创建成功', coach });
});

router.put('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
  }
  const { name, phone, specialty, hourly_rate, user_id } = req.body;
  db.prepare('UPDATE coaches SET name = COALESCE(?, name), phone = COALESCE(?, phone), specialty = COALESCE(?, specialty), hourly_rate = COALESCE(?, hourly_rate), user_id = COALESCE(?, user_id) WHERE id = ?').run(
    name || null, phone || null, specialty || null, hourly_rate || null, user_id || null, id
  );
  const updated = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  res.json({ message: '更新成功', coach: updated });
});

router.delete('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
  }
  db.prepare('DELETE FROM coaches WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

router.get('/:id/schedule', function (req, res) {
  const { id } = req.params;
  const { start, end } = req.query;
  let schedule;
  if (start && end) {
    schedule = db.prepare('SELECT cs.*, ts.start_time, ts.end_time FROM coach_schedules cs JOIN time_slots ts ON cs.slot_id = ts.id WHERE cs.coach_id = ? AND cs.date >= ? AND cs.date <= ?').all(id, start, end);
  } else {
    schedule = db.prepare('SELECT cs.*, ts.start_time, ts.end_time FROM coach_schedules cs JOIN time_slots ts ON cs.slot_id = ts.id WHERE cs.coach_id = ?').all(id);
  }
  res.json({ schedule });
});

router.post('/:id/schedule', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const { date, slot_id, available } = req.body;
  if (!date || !slot_id) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const existing = db.prepare('SELECT * FROM coach_schedules WHERE coach_id = ? AND date = ? AND slot_id = ?').get(id, date, slot_id);
  if (existing) {
    db.prepare('UPDATE coach_schedules SET available = ?, source = ? WHERE id = ?').run(
      available !== undefined ? available : 1,
      'manual',
      existing.id
    );
  } else {
    db.prepare('INSERT INTO coach_schedules (coach_id, date, slot_id, available, source) VALUES (?, ?, ?, ?, ?)').run(
      id, date, slot_id, available !== undefined ? available : 1, 'manual'
    );
  }
  const schedule = db.prepare('SELECT cs.*, ts.start_time, ts.end_time FROM coach_schedules cs JOIN time_slots ts ON cs.slot_id = ts.id WHERE cs.coach_id = ? AND cs.date = ?').all(id, date);
  res.json({ message: '排班设置成功', schedule });
});

const { generateScheduleForCoach } = require('./coach');

router.post('/:id/schedule/generate', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
  }

  const { weeks = 2, start_date } = req.body;

  if (weeks < 1 || weeks > 4) {
    return res.status(400).json({ error: '周数必须在 1-4 周之间' });
  }

  try {
    const result = generateScheduleForCoach(id, weeks, start_date);
    res.json({
      message: `成功生成 ${result.generated} 个可预约时段`,
      ...result
    });
  } catch (e) {
    console.error('生成排班失败:', e);
    res.status(500).json({ error: '生成排班失败' });
  }
});

router.get('/:id/schedule/exceptions', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
  }

  const exceptions = db.prepare(`
    SELECT * FROM coach_schedule_exceptions
    WHERE coach_id = ?
    ORDER BY date
  `).all(id);

  res.json({ exceptions });
});

router.post('/:id/schedule/exceptions', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
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
  `).get(id, date);

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
    `).run(id, date, type, reason || null);
  }

  if (type === 'off') {
    db.prepare(`
      UPDATE coach_schedules
      SET available = 0, source = 'exception'
      WHERE coach_id = ? AND date = ?
    `).run(id, date);
  }

  const exception = db.prepare(`
    SELECT * FROM coach_schedule_exceptions WHERE id = ?
  `).get(existing ? existing.id : result.lastInsertRowid);

  res.json({ message: existing ? '更新成功' : '添加成功', exception });
});

router.delete('/:id/schedule/exceptions/:exceptionId', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id, exceptionId } = req.params;
  const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
  if (!coach) {
    return res.status(404).json({ error: '教练不存在' });
  }

  const exception = db.prepare(`
    SELECT * FROM coach_schedule_exceptions WHERE id = ? AND coach_id = ?
  `).get(exceptionId, id);

  if (!exception) {
    return res.status(404).json({ error: '例外日期不存在' });
  }

  const date = exception.date;

  db.prepare('DELETE FROM coach_schedule_exceptions WHERE id = ?').run(exceptionId);

  if (exception.type === 'off') {
    const prefs = db.prepare(`
      SELECT * FROM coach_preferences
      WHERE coach_id = ? AND is_available = 1 AND day_of_week = strftime('%w', ?)
    `).all(id, date);

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
            `).get(id, date, slot.id);

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

module.exports = router;
