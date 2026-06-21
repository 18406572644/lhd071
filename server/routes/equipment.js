const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/repairs', authMiddleware, roleCheck('admin'), function (req, res) {
  const repairs = db.prepare(`
    SELECT er.*, e.name as equipment_name, u.username as reporter_name
    FROM equipment_repairs er
    JOIN equipment e ON er.equipment_id = e.id
    JOIN users u ON er.reporter_id = u.id
    ORDER BY er.created_at DESC
  `).all();
  res.json({ repairs });
});

router.put('/repairs/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const repair = db.prepare('SELECT * FROM equipment_repairs WHERE id = ?').get(id);
  if (!repair) {
    return res.status(404).json({ error: '维修记录不存在' });
  }
  const { status, description } = req.body;
  if (status) {
    db.prepare('UPDATE equipment_repairs SET status = ? WHERE id = ?').run(status, id);
    if (status === 'repairing') {
      db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('repairing', repair.equipment_id);
    }
    if (status === 'done') {
      db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('normal', repair.equipment_id);
    }
  }
  if (description) {
    db.prepare('UPDATE equipment_repairs SET description = ? WHERE id = ?').run(description, id);
  }
  const updated = db.prepare('SELECT * FROM equipment_repairs WHERE id = ?').get(id);
  res.json({ message: '更新成功', repair: updated });
});

router.get('/rentals', authMiddleware, roleCheck('admin'), function (req, res) {
  const rentals = db.prepare(`
    SELECT er.*, e.name as equipment_name, u.username as user_name
    FROM equipment_rentals er
    JOIN equipment e ON er.equipment_id = e.id
    JOIN users u ON er.user_id = u.id
    ORDER BY er.created_at DESC
  `).all();
  res.json({ rentals });
});

router.get('/rentals/mine', authMiddleware, function (req, res) {
  const rentals = db.prepare(`
    SELECT er.*, e.name as equipment_name
    FROM equipment_rentals er
    JOIN equipment e ON er.equipment_id = e.id
    WHERE er.user_id = ?
    ORDER BY er.created_at DESC
  `).all(req.user.id);
  res.json({ rentals });
});

router.post('/rentals/:id/return', authMiddleware, function (req, res) {
  const { id } = req.params;
  const rental = db.prepare('SELECT * FROM equipment_rentals WHERE id = ?').get(id);
  if (!rental) {
    return res.status(404).json({ error: '租赁记录不存在' });
  }
  if (rental.status === 'returned') {
    return res.status(400).json({ error: '该器材已归还' });
  }
  db.prepare('UPDATE equipment_rentals SET status = ? WHERE id = ?').run('returned', id);
  db.prepare('UPDATE equipment SET available_count = available_count + ? WHERE id = ?').run(rental.quantity, rental.equipment_id);
  res.json({ message: '归还成功' });
});

router.get('/', function (req, res) {
  const equipment = db.prepare('SELECT * FROM equipment').all();
  res.json({ equipment });
});

router.post('/', authMiddleware, roleCheck('admin'), function (req, res) {
  const { name, type, total_count, rental_price, status } = req.body;
  if (!name || !type || !total_count || !rental_price) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = db.prepare('INSERT INTO equipment (name, type, total_count, available_count, rental_price, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    name, type, total_count, total_count, rental_price, status || 'normal'
  );
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '添加成功', equipment: item });
});

router.put('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: '器材不存在' });
  }
  const { name, type, total_count, rental_price, status } = req.body;
  db.prepare('UPDATE equipment SET name = COALESCE(?, name), type = COALESCE(?, type), total_count = COALESCE(?, total_count), rental_price = COALESCE(?, rental_price), status = COALESCE(?, status) WHERE id = ?').run(
    name || null, type || null, total_count || null, rental_price || null, status || null, id
  );
  const updated = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  res.json({ message: '更新成功', equipment: updated });
});

router.delete('/:id', authMiddleware, roleCheck('admin'), function (req, res) {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: '器材不存在' });
  }
  db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

router.post('/:id/rent', authMiddleware, function (req, res) {
  const { id } = req.params;
  const { quantity, booking_id } = req.body;
  const qty = quantity || 1;
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: '器材不存在' });
  }
  if (item.available_count < qty) {
    return res.status(400).json({ error: '库存不足' });
  }
  const result = db.prepare('INSERT INTO equipment_rentals (user_id, equipment_id, booking_id, quantity, status) VALUES (?, ?, ?, ?, ?)').run(
    req.user.id, id, booking_id || null, qty, 'rented'
  );
  db.prepare('UPDATE equipment SET available_count = available_count - ? WHERE id = ?').run(qty, id);
  const rental = db.prepare('SELECT * FROM equipment_rentals WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '租借成功', rental });
});

router.post('/:id/repair', authMiddleware, function (req, res) {
  const { id } = req.params;
  const { description } = req.body;
  const item = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: '器材不存在' });
  }
  const result = db.prepare('INSERT INTO equipment_repairs (equipment_id, reporter_id, description, status) VALUES (?, ?, ?, ?)').run(
    id, req.user.id, description || null, 'pending'
  );
  db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run('damaged', id);
  const repair = db.prepare('SELECT * FROM equipment_repairs WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '报修成功', repair });
});

module.exports = router;
