const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

var PRICING = {
  small: { hour: 5, day: 30, month: 200, quarter: 500 },
  medium: { hour: 8, day: 50, month: 350, quarter: 900 },
  large: { hour: 12, day: 80, month: 500, quarter: 1300 }
};

router.get('/', function (req, res) {
  var lockers = db.prepare('SELECT * FROM lockers ORDER BY area, row_num, col_num').all();
  res.json({ lockers: lockers });
});

router.get('/layout', function (req, res) {
  var lockers = db.prepare('SELECT * FROM lockers ORDER BY area, row_num, col_num').all();
  var layout = { A: {}, B: {} };
  for (var i = 0; i < lockers.length; i++) {
    var l = lockers[i];
    if (!layout[l.area]) layout[l.area] = {};
    if (!layout[l.area][l.row_num]) layout[l.area][l.row_num] = {};
    layout[l.area][l.row_num][l.col_num] = l;
  }
  var stats = { total: lockers.length, free: 0, in_use: 0, fault: 0, maintenance: 0 };
  for (var j = 0; j < lockers.length; j++) {
    var lk = lockers[j];
    if (lk.status === 'free') stats.free++;
    else if (lk.status === 'in_use') stats.in_use++;
    else if (lk.status === 'fault') stats.fault++;
    else if (lk.status === 'maintenance') stats.maintenance++;
  }
  res.json({ layout: layout, stats: stats });
});

router.get('/pricing', function (req, res) {
  res.json({ pricing: PRICING });
});

router.post('/', authMiddleware, roleCheck('admin'), function (req, res) {
  var locker_number = req.body.locker_number;
  var store = req.body.store;
  var area = req.body.area;
  var size = req.body.size;
  var status = req.body.status;
  var row_num = req.body.row_num;
  var col_num = req.body.col_num;
  if (!locker_number || !area || !size) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  var existing = db.prepare('SELECT id FROM lockers WHERE locker_number = ?').get(locker_number);
  if (existing) {
    return res.status(400).json({ error: '储物柜编号已存在' });
  }
  var result = db.prepare('INSERT INTO lockers (locker_number, store, area, size, status, row_num, col_num) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    locker_number, store || '主店', area, size, status || 'free', row_num || 0, col_num || 0
  );
  var locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '添加成功', locker: locker });
});

router.put('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  var id = req.params.id;
  var locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(id);
  if (!locker) {
    return res.status(404).json({ error: '储物柜不存在' });
  }
  var locker_number = req.body.locker_number;
  var store = req.body.store;
  var area = req.body.area;
  var size = req.body.size;
  var status = req.body.status;
  var row_num = req.body.row_num;
  var col_num = req.body.col_num;
  db.prepare('UPDATE lockers SET locker_number = COALESCE(?, locker_number), store = COALESCE(?, store), area = COALESCE(?, area), size = COALESCE(?, size), status = COALESCE(?, status), row_num = COALESCE(?, row_num), col_num = COALESCE(?, col_num) WHERE id = ?').run(
    locker_number || null, store || null, area || null, size || null, status || null, row_num != null ? row_num : null, col_num != null ? col_num : null, id
  );
  var updated = db.prepare('SELECT * FROM lockers WHERE id = ?').get(id);
  res.json({ message: '更新成功', locker: updated });
});

router.delete('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  var id = req.params.id;
  var locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(id);
  if (!locker) {
    return res.status(404).json({ error: '储物柜不存在' });
  }
  if (locker.status === 'in_use') {
    return res.status(400).json({ error: '使用中的储物柜无法删除' });
  }
  db.prepare('DELETE FROM lockers WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

router.get('/rentals', authMiddleware, roleCheck('admin'), function (req, res) {
  var rentals = db.prepare(`
    SELECT lr.*, l.locker_number, l.area, l.size, l.store, u.username
    FROM locker_rentals lr
    JOIN lockers l ON lr.locker_id = l.id
    JOIN users u ON lr.user_id = u.id
    ORDER BY lr.created_at DESC
  `).all();
  res.json({ rentals: rentals });
});

router.get('/rentals/mine', authMiddleware, function (req, res) {
  var rentals = db.prepare(`
    SELECT lr.*, l.locker_number, l.area, l.size, l.store
    FROM locker_rentals lr
    JOIN lockers l ON lr.locker_id = l.id
    WHERE lr.user_id = ?
    ORDER BY lr.created_at DESC
  `).all(req.user.id);
  res.json({ rentals: rentals });
});

router.post('/:id/rent', authMiddleware, function (req, res) {
  var id = req.params.id;
  var rental_type = req.body.rental_type;
  var billing_cycle = req.body.billing_cycle;
  var booking_id = req.body.booking_id;
  var locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(id);
  if (!locker) {
    return res.status(404).json({ error: '储物柜不存在' });
  }
  if (locker.status !== 'free') {
    return res.status(400).json({ error: '该储物柜不可租用' });
  }
  if (!rental_type || !billing_cycle) {
    return res.status(400).json({ error: '缺少租用类型和计费周期' });
  }
  var now = new Date();
  var startTime = now.toISOString().slice(0, 19).replace('T', ' ');
  var endTime;
  var amount = PRICING[locker.size] ? PRICING[locker.size][billing_cycle] : 0;
  if (!amount) {
    return res.status(400).json({ error: '无效的计费周期' });
  }
  if (billing_cycle === 'hour') {
    var endH = new Date(now.getTime() + 60 * 60 * 1000);
    endTime = endH.toISOString().slice(0, 19).replace('T', ' ');
  } else if (billing_cycle === 'day') {
    var endD = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    endTime = endD.toISOString().slice(0, 19).replace('T', ' ');
  } else if (billing_cycle === 'month') {
    var endM = new Date(now);
    endM.setMonth(endM.getMonth() + 1);
    endTime = endM.toISOString().slice(0, 19).replace('T', ' ');
  } else if (billing_cycle === 'quarter') {
    var endQ = new Date(now);
    endQ.setMonth(endQ.getMonth() + 3);
    endTime = endQ.toISOString().slice(0, 19).replace('T', ' ');
  }
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.balance < amount) {
    return res.status(400).json({ error: '余额不足' });
  }
  var result = db.prepare('INSERT INTO locker_rentals (locker_id, user_id, rental_type, billing_cycle, start_time, end_time, amount, booking_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.user.id, rental_type, billing_cycle, startTime, endTime, amount, booking_id || null, 'active'
  );
  db.prepare('UPDATE lockers SET status = ? WHERE id = ?').run('in_use', id);
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, req.user.id);
  db.prepare('INSERT INTO payments (booking_id, user_id, amount, type, method, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    null, req.user.id, amount, 'payment', 'balance', 'success'
  );
  var rental = db.prepare('SELECT * FROM locker_rentals WHERE id = ?').get(result.lastInsertRowid);
  var updatedUser = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '租用成功', rental: rental, balance: updatedUser.balance, points: updatedUser.points });
});

router.post('/rentals/:id/renew', authMiddleware, function (req, res) {
  var id = req.params.id;
  var rental = db.prepare('SELECT * FROM locker_rentals WHERE id = ?').get(id);
  if (!rental) {
    return res.status(404).json({ error: '租用记录不存在' });
  }
  if (rental.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作' });
  }
  if (rental.status !== 'active') {
    return res.status(400).json({ error: '只能续租有效租约' });
  }
  var locker = db.prepare('SELECT * FROM lockers WHERE id = ?').get(rental.locker_id);
  var amount = PRICING[locker.size] ? PRICING[locker.size][rental.billing_cycle] : 0;
  if (!amount) {
    return res.status(400).json({ error: '计费异常' });
  }
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.balance < amount) {
    return res.status(400).json({ error: '余额不足' });
  }
  var currentEnd = new Date(rental.end_time);
  var newEnd;
  if (rental.billing_cycle === 'hour') {
    newEnd = new Date(currentEnd.getTime() + 60 * 60 * 1000);
  } else if (rental.billing_cycle === 'day') {
    newEnd = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);
  } else if (rental.billing_cycle === 'month') {
    newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);
  } else if (rental.billing_cycle === 'quarter') {
    newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 3);
  }
  db.prepare('UPDATE locker_rentals SET end_time = ?, amount = amount + ? WHERE id = ?').run(
    newEnd.toISOString().slice(0, 19).replace('T', ' '), amount, id
  );
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, req.user.id);
  db.prepare('INSERT INTO payments (booking_id, user_id, amount, type, method, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    null, req.user.id, amount, 'payment', 'balance', 'success'
  );
  var updatedRental = db.prepare('SELECT * FROM locker_rentals WHERE id = ?').get(id);
  var updatedUser = db.prepare('SELECT balance, points FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: '续租成功', rental: updatedRental, balance: updatedUser.balance, points: updatedUser.points });
});

router.post('/rentals/:id/return', authMiddleware, function (req, res) {
  var id = req.params.id;
  var rental = db.prepare('SELECT * FROM locker_rentals WHERE id = ?').get(id);
  if (!rental) {
    return res.status(404).json({ error: '租用记录不存在' });
  }
  if (rental.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权操作' });
  }
  if (rental.status !== 'active') {
    return res.status(400).json({ error: '该租约已失效' });
  }
  db.prepare('UPDATE locker_rentals SET status = ? WHERE id = ?').run('cancelled', id);
  db.prepare('UPDATE lockers SET status = ? WHERE id = ?').run('free', rental.locker_id);
  res.json({ message: '退租成功' });
});

router.put('/pricing', authMiddleware, roleCheck('admin'), function (req, res) {
  var newPricing = req.body.pricing;
  if (newPricing) {
    PRICING = newPricing;
  }
  res.json({ message: '价格更新成功', pricing: PRICING });
});

module.exports = router;
