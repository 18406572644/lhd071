const express = require('express');
const db = require('../db');
const { authMiddleware, roleCheck } = require('../middleware');

const router = express.Router();

router.get('/dashboard', authMiddleware, roleCheck('admin'), function (req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const todayBookings = db.prepare('SELECT COUNT(*) as count FROM bookings WHERE booking_date = ?').get(today).count;
  const todayRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as revenue FROM payments WHERE date(created_at) = ? AND status = 'success'").get(today).revenue;
  const totalMembers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get().count;
  const totalSlots = db.prepare('SELECT COALESCE(SUM(capacity), 0) as total FROM time_slots').get().total;
  const usedSlots = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE booking_date = ? AND status IN ('paid', 'checked_in')").get(today).count;
  const occupancyRate = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
  res.json({
    todayBookings,
    todayRevenue,
    totalMembers,
    occupancyRate
  });
});

router.get('/monthly', authMiddleware, roleCheck('admin'), function (req, res) {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: '请提供年份和月份' });
  }
  const startDate = year + '-' + month.padStart(2, '0') + '-01';
  const endDate = year + '-' + month.padStart(2, '0') + '-31';
  const dailyStats = db.prepare(`
    SELECT booking_date as date, COUNT(*) as booking_count, COALESCE(SUM(CASE WHEN status IN ('paid', 'checked_in') THEN amount ELSE 0 END), 0) as revenue
    FROM bookings
    WHERE booking_date >= ? AND booking_date <= ?
    GROUP BY booking_date
    ORDER BY booking_date
  `).all(startDate, endDate);
  res.json({ dailyStats });
});

router.get('/coach-hours', authMiddleware, roleCheck('admin'), function (req, res) {
  const { coach_id, year, month } = req.query;
  if (!coach_id || !year || !month) {
    return res.status(400).json({ error: '请提供教练ID、年份和月份' });
  }
  const startDate = year + '-' + month.padStart(2, '0') + '-01';
  const endDate = year + '-' + month.padStart(2, '0') + '-31';
  const hours = db.prepare(`
    SELECT COUNT(*) as session_count
    FROM bookings
    WHERE coach_id = ? AND booking_date >= ? AND booking_date <= ? AND status IN ('paid', 'checked_in')
  `).get(coach_id, startDate, endDate);
  res.json({ coach_id: Number(coach_id), sessionCount: hours.session_count, teachingHours: hours.session_count });
});

router.get('/traffic', authMiddleware, roleCheck('admin'), function (req, res) {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: '请提供年份和月份' });
  }
  const startDate = year + '-' + month.padStart(2, '0') + '-01';
  const endDate = year + '-' + month.padStart(2, '0') + '-31';
  const dailyTraffic = db.prepare(`
    SELECT b.booking_date as date, COUNT(DISTINCT ci.id) as checkin_count
    FROM bookings b
    LEFT JOIN check_ins ci ON ci.booking_id = b.id
    WHERE b.booking_date >= ? AND b.booking_date <= ?
    GROUP BY b.booking_date
    ORDER BY b.booking_date
  `).all(startDate, endDate);
  res.json({ dailyTraffic });
});

module.exports = router;
