const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware, roleCheck, JWT_SECRET } = require('../middleware');

const router = express.Router();

router.post('/register', function (req, res) {
  const { username, password, phone } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password, phone, role, balance, points) VALUES (?, ?, ?, ?, ?, ?)').run(
    username, hashedPassword, phone || null, 'user', 0, 0
  );
  const user = db.prepare('SELECT id, username, phone, role, balance, points, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '注册成功', user });
});

router.post('/login', function (req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const userInfo = {
    id: user.id,
    username: user.username,
    phone: user.phone,
    role: user.role,
    balance: user.balance,
    points: user.points
  };
  res.json({ message: '登录成功', token, user: userInfo });
});

router.get('/profile', authMiddleware, function (req, res) {
  const user = db.prepare('SELECT id, username, phone, role, balance, points, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({ user });
});

router.put('/profile', authMiddleware, function (req, res) {
  const { phone, password } = req.body;
  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ?, phone = COALESCE(?, phone) WHERE id = ?').run(hashedPassword, phone || null, req.user.id);
  } else {
    db.prepare('UPDATE users SET phone = COALESCE(?, phone) WHERE id = ?').run(phone || null, req.user.id);
  }
  const user = db.prepare('SELECT id, username, phone, role, balance, points, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '更新成功', user });
});

router.post('/recharge', authMiddleware, function (req, res) {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '充值金额必须大于0' });
  }
  const points = Math.floor(amount * 0.1);
  db.prepare('UPDATE users SET balance = balance + ?, points = points + ? WHERE id = ?').run(amount, points, req.user.id);
  db.prepare('INSERT INTO payments (booking_id, user_id, amount, type, method, status) VALUES (?, ?, ?, ?, ?, ?)').run(null, req.user.id, amount, 'recharge', 'balance', 'success');
  const user = db.prepare('SELECT id, username, phone, role, balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '充值成功', balance: user.balance, points: user.points });
});

module.exports = router;
