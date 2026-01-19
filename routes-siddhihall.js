const express = require('express');
const router = express.Router();
const { queryPoliceWelfare } = require('./db-policewelfare');

// Get bookings metrics
router.get('/metrics', async (req, res) => {
  try {
    // Total bookings
    const totalResult = await queryPoliceWelfare(
      'SELECT COUNT(*) as count FROM bookings'
    );

    // Upcoming bookings: start_date > today and booking_status != 'cancelled'
    const upcomingResult = await queryPoliceWelfare(
      `SELECT COUNT(*) as count FROM bookings
       WHERE start_date > CURRENT_DATE AND booking_status != 'cancelled'`
    );

    // Cancelled bookings
    const cancelledResult = await queryPoliceWelfare(
      `SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'cancelled'`
    );

    // Rejected bookings
    const rejectedResult = await queryPoliceWelfare(
      `SELECT COUNT(*) as count FROM bookings WHERE booking_status = 'rejected'`
    );

    // Total revenue: sum total_amount where payment_status == 'completed'
    const revenueResult = await queryPoliceWelfare(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue FROM bookings WHERE payment_status = 'completed'`
    );

    // Pending payments: sum total_amount where payment_status == 'pending'
    const pendingResult = await queryPoliceWelfare(
      `SELECT COALESCE(SUM(total_amount), 0) as pending FROM bookings WHERE payment_status = 'pending'`
    );

    // Total registrations
    const registrationsResult = await queryPoliceWelfare(
      'SELECT COUNT(*) as count FROM profiles'
    );

    res.json({
      totalBookings: parseInt(totalResult.rows[0].count),
      upcomingBookings: parseInt(upcomingResult.rows[0].count),
      cancelledBookings: parseInt(cancelledResult.rows[0].count),
      rejectedBookings: parseInt(rejectedResult.rows[0].count),
      totalRevenue: parseFloat(revenueResult.rows[0].revenue),
      pendingPayments: parseFloat(pendingResult.rows[0].pending),
      totalRegistrations: parseInt(registrationsResult.rows[0].count)
    });
  } catch (error) {
    console.error('SiddhiHall: Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics', details: error.message });
  }
});

// Get bookings by type with drill-down data
router.get('/bookings', async (req, res) => {
  try {
    const { type } = req.query;

    let query = '';
    let params = [];

    switch (type) {
      case 'upcoming':
        query = `
          SELECT b.*, p.name as full_name, p.email, p.mobile as phone
          FROM bookings b
          LEFT JOIN profiles p ON b.user_id = p.id
          WHERE b.start_date > CURRENT_DATE AND b.booking_status != 'cancelled'
          ORDER BY b.start_date ASC
        `;
        break;
      case 'cancelled':
        query = `
          SELECT b.*, p.name as full_name, p.email, p.mobile as phone
          FROM bookings b
          LEFT JOIN profiles p ON b.user_id = p.id
          WHERE b.booking_status = 'cancelled'
          ORDER BY b.created_at DESC
        `;
        break;
      case 'rejected':
        query = `
          SELECT b.*, p.name as full_name, p.email, p.mobile as phone
          FROM bookings b
          LEFT JOIN profiles p ON b.user_id = p.id
          WHERE b.booking_status = 'rejected'
          ORDER BY b.created_at DESC
        `;
        break;
      case 'total':
      default:
        query = `
          SELECT b.*, p.name as full_name, p.email, p.mobile as phone
          FROM bookings b
          LEFT JOIN profiles p ON b.user_id = p.id
          ORDER BY b.created_at DESC
        `;
        break;
    }

    const result = await queryPoliceWelfare(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('SiddhiHall: Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings', details: error.message });
  }
});

module.exports = router;
