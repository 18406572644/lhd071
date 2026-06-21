const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/', function (req, res) {
  const coaches = db.prepare('SELECT * FROM coaches').all();
  res.json({ coaches });
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
    db.prepare('UPDATE coach_schedules SET available = ? WHERE id = ?').run(available !== undefined ? available : 1, existing.id);
  } else {
    db.prepare('INSERT INTO coach_schedules (coach_id, date, slot_id, available) VALUES (?, ?, ?, ?)').run(
      id, date, slot_id, available !== undefined ? available : 1
    );
  }
  const schedule = db.prepare('SELECT cs.*, ts.start_time, ts.end_time FROM coach_schedules cs JOIN time_slots ts ON cs.slot_id = ts.id WHERE cs.coach_id = ? AND cs.date = ?').all(id, date);
  res.json({ message: '排班设置成功', schedule });
});

module.exports = router;
