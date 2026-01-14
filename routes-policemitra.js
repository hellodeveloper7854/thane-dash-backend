const express = require('express');
const router = express.Router();
const { queryPoliceMitra } = require('./db-policemitra');

// Get all station names
router.get('/stations', async (req, res) => {
  try {
    const result = await queryPoliceMitra(
      'SELECT DISTINCT station_name FROM police_station_users WHERE station_name IS NOT NULL ORDER BY station_name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// Get registrations summary with filters
router.get('/registrations', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      stations,
      email,
      limit = 1000,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        police_station,
        verification_status,
        registration_date,
        created_at
      FROM registrations
      WHERE email != $1
    `;
    const params = ['test_cogent@gmail.com'];
    let paramIndex = 2;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND registration_date >= $${paramIndex++} AND registration_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    // Add ordering and pagination
    query += ` ORDER BY registration_date DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await queryPoliceMitra(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Get registration counts for dashboard
router.get('/dashboard/counts', async (req, res) => {
  try {
    const { startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        police_station,
        verification_status,
        registration_date,
        created_at
      FROM registrations
      WHERE email != $1
    `;
    const params = ['test_cogent@gmail.com'];
    let paramIndex = 2;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND registration_date >= $${paramIndex++} AND registration_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await queryPoliceMitra(query, params);

    // Calculate counts
    const counts = {
      total: result.rows.length,
      pending: 0,
      verified: 0,
      rejected: 0
    };

    result.rows.forEach(row => {
      if (row.verification_status === 'pending') counts.pending++;
      else if (row.verification_status === 'verified') counts.verified++;
      else if (row.verification_status === 'rejected') counts.rejected++;
    });

    res.json(counts);
  } catch (error) {
    console.error('Error fetching dashboard counts:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard counts' });
  }
});

// Get station-wise registration data
router.get('/stations/data', async (req, res) => {
  try {
    const { startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        UPPER(TRIM(police_station)) as station,
        verification_status,
        registration_date,
        created_at
      FROM registrations
      WHERE police_station IS NOT NULL
        AND email != $1
    `;
    const params = ['test_cogent@gmail.com'];
    let paramIndex = 2;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND registration_date >= $${paramIndex++} AND registration_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await queryPoliceMitra(query, params);

    // Group by station
    const stationMap = new Map();

    result.rows.forEach(row => {
      const station = row.station || 'Unknown';
      if (!stationMap.has(station)) {
        stationMap.set(station, {
          station,
          total: 0,
          pending: 0,
          verified: 0,
          rejected: 0
        });
      }
      const data = stationMap.get(station);
      data.total++;
      if (row.verification_status === 'pending') data.pending++;
      else if (row.verification_status === 'verified') data.verified++;
      else if (row.verification_status === 'rejected') data.rejected++;
    });

    res.json(Array.from(stationMap.values()));
  } catch (error) {
    console.error('Error fetching station data:', error);
    res.status(500).json({ error: 'Failed to fetch station data' });
  }
});

// Get active users count
router.get('/active-users', async (req, res) => {
  try {
    const { stations } = req.query;

    let query = `
      SELECT COUNT(DISTINCT user_email) as count
      FROM availability_logs
      WHERE end_time IS NULL
    `;
    const params = [];
    let paramIndex = 1;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await queryPoliceMitra(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

// Get assigned services count for today
router.get('/assigned-services', async (req, res) => {
  try {
    const { stations } = req.query;

    // Get today's date range
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    let query = `
      SELECT COUNT(*) as count
      FROM assigned_services
      WHERE assigned_date >= $1
        AND assigned_date <= $2
        AND status = 'assigned'
    `;
    const params = [startOfToday, endOfToday];
    let paramIndex = 3;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await queryPoliceMitra(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (error) {
    console.error('Error fetching assigned services:', error);
    res.status(500).json({ error: 'Failed to fetch assigned services' });
  }
});

// Get feedbacks count
router.get('/feedbacks', async (req, res) => {
  try {
    const { endDate, stations } = req.query;

    let query = `
      SELECT COUNT(*) as count
      FROM feedbacks
    `;
    const params = [];
    let paramIndex = 1;

    // Apply date filter
    if (endDate) {
      query += ` WHERE created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += `${paramIndex === 1 ? ' WHERE' : ' AND'} police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await queryPoliceMitra(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
});

// Drill down: Get detailed registration data by status
router.get('/drilldown/registrations', async (req, res) => {
  try {
    const { status, startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        verification_status,
        registration_date,
        created_at,
        full_name,
        email,
        mobile_number
      FROM registrations
      WHERE email != 'test_cogent@gmail.com'
    `;
    const params = [];
    let paramIndex = 1;

    // Apply status filter
    if (status && status !== 'all' && status !== 'active_users' && status !== 'active_services') {
      if (status === 'verified') {
        query += ` AND verification_status = $${paramIndex++}`;
        params.push('verified');
      } else if (status === 'pending') {
        query += ` AND verification_status = $${paramIndex++}`;
        params.push('pending');
      } else if (status === 'rejected') {
        query += ` AND verification_status = $${paramIndex++}`;
        params.push('rejected');
      }
    }

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND registration_date >= $${paramIndex++} AND registration_date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY registration_date DESC`;

    const result = await queryPoliceMitra(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching drilldown data:', error);
    res.status(500).json({ error: 'Failed to fetch drilldown data' });
  }
});

// Drill down: Get active users details
router.get('/drilldown/active-users', async (req, res) => {
  try {
    const { stations } = req.query;

    let query = `
      SELECT
        al.id,
        al.user_email,
        al.police_station,
        al.start_time,
        r.full_name,
        r.mobile_number
      FROM availability_logs al
      LEFT JOIN registrations r ON al.user_email = r.email
      WHERE al.end_time IS NULL
    `;
    const params = [];
    let paramIndex = 1;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND al.police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY al.start_time DESC`;

    const result = await queryPoliceMitra(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching active users details:', error);
    res.status(500).json({ error: 'Failed to fetch active users details' });
  }
});

// Drill down: Get assigned services details
router.get('/drilldown/assigned-services', async (req, res) => {
  try {
    const { stations } = req.query;

    // Get today's date range
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    let query = `
      SELECT
        id,
        police_station,
        service_type,
        assigned_date,
        status,
        volunteer_email
      FROM assigned_services
      WHERE assigned_date >= $1
        AND assigned_date <= $2
        AND status = 'assigned'
    `;
    const params = [startOfToday, endOfToday];
    let paramIndex = 3;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY assigned_date DESC`;

    const result = await queryPoliceMitra(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assigned services details:', error);
    res.status(500).json({ error: 'Failed to fetch assigned services details' });
  }
});

// Drill down: Get feedbacks details
router.get('/drilldown/feedbacks', async (req, res) => {
  try {
    const { endDate, stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        rating,
        feedback,
        created_at
      FROM feedbacks
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply date filter
    if (endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await queryPoliceMitra(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching feedbacks details:', error);
    res.status(500).json({ error: 'Failed to fetch feedbacks details' });
  }
});

module.exports = router;
