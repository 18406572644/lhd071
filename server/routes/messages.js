const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/', authMiddleware, function (req, res) {
  const messages = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  db.prepare('UPDATE messages SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ messages });
});

router.post('/', authMiddleware, roleCheck('admin'), function (req, res) {
  const { user_id, type, title, content } = req.body;
  if (!user_id || !type || !title || !content) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = db.prepare('INSERT INTO messages (user_id, type, title, content, is_read) VALUES (?, ?, ?, ?, ?)').run(
    user_id, type, title, content, 0
  );
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '发送成功', data: message });
});

router.delete('/:id', authMiddleware, function (req, res) {
  const message = db.prepare('SELECT * FROM messages WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!message) {
    return res.status(404).json({ error: '消息不存在' });
  }
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;
