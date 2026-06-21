const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/', function (req, res) {
  const { type } = req.query;
  let slots;
  if (type) {
    slots = db.prepare('SELECT * FROM time_slots WHERE type = ?').all(type);
  } else {
    slots = db.prepare('SELECT * FROM time_slots').all();
  }
  res.json({ slots });
});

router.post('/', authMiddleware, roleCheck('admin'), function (req, res) {
  const { type, start_time, end_time, capacity, price, session_type } = req.body;
  if (!type || !start_time || !end_time || !capacity || !price || !session_type) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = db.prepare('INSERT INTO time_slots (type, start_time, end_time, capacity, price, session_type) VALUES (?, ?, ?, ?, ?, ?)').run(
    type, start_time, end_time, capacity, price, session_type
  );
  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '创建成功', slot });
});

router.put('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(id);
  if (!slot) {
    return res.status(404).json({ error: '时间段不存在' });
  }
  const { type, start_time, end_time, capacity, price, session_type } = req.body;
  db.prepare('UPDATE time_slots SET type = COALESCE(?, type), start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time), capacity = COALESCE(?, capacity), price = COALESCE(?, price), session_type = COALESCE(?, session_type) WHERE id = ?').run(
    type || null, start_time || null, end_time || null, capacity || null, price || null, session_type || null, id
  );
  const updated = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(id);
  res.json({ message: '更新成功', slot: updated });
});

router.delete('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const slot = db.prepare('SELECT * FROM time_slots WHERE id = ?').get(id);
  if (!slot) {
    return res.status(404).json({ error: '时间段不存在' });
  }
  db.prepare('DELETE FROM time_slots WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

module.exports = router;
