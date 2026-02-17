const express = require('express');
const router = express.Router();
const { queryPoliceMitra } = require('./db-policemitra');
const { asyncHandler } = require('./errorHandler');

// Get all station names
router.get('/stations', asyncHandler(async (req, res) => {
  const result = await queryPoliceMitra(
    'SELECT DISTINCT station_name FROM police_station_users WHERE station_name IS NOT NULL ORDER BY station_name'
  );
  res.json(result.rows);
}));

// Get registrations summary with filters
router.get('/registrations', asyncHandler(async (req, res) => {
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
}));

// Get registration counts for dashboard
router.get('/dashboard/counts', asyncHandler(async (req, res) => {
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
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  console.log('🔍 [Backend] Dashboard counts query:', query);
  console.log('🔍 [Backend] Params:', params);

  const result = await queryPoliceMitra(query, params);

  console.log('📊 [Backend] Dashboard raw rows:', result.rowCount);

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

  console.log('📊 [Backend] Dashboard aggregated counts:', counts);

  res.json(counts);
}));

// Get station-wise registration data
router.get('/stations/data', asyncHandler(async (req, res) => {
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
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  console.log('🔍 [Backend] Station-wise data query:', query);
  console.log('🔍 [Backend] Params:', params);

  const result = await queryPoliceMitra(query, params);

  console.log('📊 [Backend] Station-wise raw rows:', result.rowCount);

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

  const stationData = Array.from(stationMap.values());
  console.log('📊 [Backend] Station-wise aggregated data:', stationData);

  res.json(stationData);
}));

// Get active users count
router.get('/active-users', asyncHandler(async (req, res) => {
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
}));

// Get assigned services count for today
router.get('/assigned-services', asyncHandler(async (req, res) => {
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
  `;
  const params = [startOfToday, endOfToday];
  let paramIndex = 3;

  // Apply station filter
  if (stations) {
    const stationList = Array.isArray(stations) ? stations : [stations];
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  const result = await queryPoliceMitra(query, params);
  res.json({ count: parseInt(result.rows[0].count) || 0 });
}));

// Get feedbacks count
router.get('/feedbacks', asyncHandler(async (req, res) => {
  const { endDate, stations } = req.query;

  let query = `
    SELECT COUNT(*) as count
    FROM feedbacks
  `;
  const params = [];
  let paramIndex = 1;

  // Apply date filter - use submitted_at instead of created_at
  if (endDate) {
    query += ` WHERE submitted_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  // Apply station filter
  if (stations) {
    const stationList = Array.isArray(stations) ? stations : [stations];
    if (stationList.length > 0) {
      query += `${paramIndex === 1 ? ' WHERE' : ' AND'} police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  const result = await queryPoliceMitra(query, params);
  res.json({ count: parseInt(result.rows[0].count) || 0 });
}));

// Drill down: Get detailed registration data by status
router.get('/drilldown/registrations', asyncHandler(async (req, res) => {
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
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  query += ` ORDER BY registration_date DESC`;

  const result = await queryPoliceMitra(query, params);
  res.json(result.rows);
}));

// Drill down: Get active users details
router.get('/drilldown/active-users', asyncHandler(async (req, res) => {
  const { stations } = req.query;

  let query = `
    SELECT
      al.id,
      al.user_email,
      al.police_station,
      al.created_at as start_time,
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
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND al.police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  query += ` ORDER BY al.created_at DESC`;

  console.log('🔍 [Backend] Drilldown active-users query:', query);
  console.log('🔍 [Backend] Params:', params);

  const result = await queryPoliceMitra(query, params);
  res.json(result.rows);
}));

// Drill down: Get assigned services details
router.get('/drilldown/assigned-services', asyncHandler(async (req, res) => {
  const { stations } = req.query;

  // Get today's date range
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  let query = `
    SELECT
      id,
      user_id,
      service_name,
      participation_area,
      status,
      assigned_date,
      user_email,
      police_station,
      location,
      created_at
    FROM assigned_services
    WHERE assigned_date >= $1
      AND assigned_date <= $2
  `;
  const params = [startOfToday, endOfToday];
  let paramIndex = 3;

  // Apply station filter
  if (stations) {
    const stationList = Array.isArray(stations) ? stations : [stations];
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  query += ` ORDER BY assigned_date DESC`;

  console.log('🔍 [Backend] Drilldown assigned-services query:', query);
  console.log('🔍 [Backend] Params:', params);

  const result = await queryPoliceMitra(query, params);
  res.json(result.rows);
}));

// Drill down: Get feedbacks details
router.get('/drilldown/feedbacks', asyncHandler(async (req, res) => {
  const { endDate, stations } = req.query;

  let query = `
    SELECT
      id,
      police_station,
      rating,
      comment,
      submitted_at,
      created_at,
      reply,
      replied_at
    FROM feedbacks
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  // Apply date filter
  if (endDate) {
    query += ` AND submitted_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  // Apply station filter
  if (stations) {
    const stationList = Array.isArray(stations) ? stations : [stations];
    // Only apply filter if stationList is not empty
    if (stationList.length > 0) {
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }
  }

  query += ` ORDER BY submitted_at DESC`;

  console.log('🔍 [Backend] Drilldown feedbacks query:', query);
  console.log('🔍 [Backend] Params:', params);

  const result = await queryPoliceMitra(query, params);
  res.json(result.rows);
}));

module.exports = router;
