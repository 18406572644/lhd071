const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

router.get('/balance', authMiddleware, function (req, res) {
  const user = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ balance: user.balance, points: user.points });
});

router.post('/recharge', authMiddleware, function (req, res) {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '充值金额必须大于0' });
  }
  const points = Math.floor(amount);
  db.prepare('UPDATE users SET balance = balance + ?, points = points + ? WHERE id = ?').run(amount, points, req.user.id);
  db.prepare('INSERT INTO payments (booking_id, user_id, amount, type, method, status) VALUES (?, ?, ?, ?, ?, ?)').run(null, req.user.id, amount, 'recharge', 'balance', 'success');
  const user = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '充值成功', balance: user.balance, points: user.points });
});

router.post('/points-exchange', authMiddleware, function (req, res) {
  const { points } = req.body;
  if (!points || points <= 0) {
    return res.status(400).json({ error: '兑换积分必须大于0' });
  }
  const user = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  if (user.points < points) {
    return res.status(400).json({ error: '积分不足' });
  }
  const balanceAmount = Math.floor(points / 100);
  if (balanceAmount <= 0) {
    return res.status(400).json({ error: '兑换积分不足100，无法兑换' });
  }
  const usedPoints = balanceAmount * 100;
  db.prepare('UPDATE users SET balance = balance + ?, points = points - ? WHERE id = ?').run(balanceAmount, usedPoints, req.user.id);
  const updatedUser = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '兑换成功', exchangedPoints: usedPoints, gainedBalance: balanceAmount, balance: updatedUser.balance, points: updatedUser.points });
});

router.get('/history', authMiddleware, function (req, res) {
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ history: payments });
});

module.exports = router;
