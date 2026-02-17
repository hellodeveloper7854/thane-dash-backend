const express = require('express');
const router = express.Router();
const { querySeniorCitizen } = require('./db-seniorcitizen');
const { asyncHandler } = require('./errorHandler');

console.log('Senior Citizen routes loaded');

// Hardcoded station names for Senior Citizen (same as used in frontend ZONE_MAPPING)
const SENIOR_CITIZEN_STATIONS = [
  'KALWA POLICE STATION',
  'MUMBRA POLICE STATION',
  'NAUPADA POLICE STATION',
  'RABODI POLICE STATION',
  'SHIL DAIGHAR POLICE STATION',
  'THANENAGAR POLICE STATION',
  'BHIWANDI POLICE STATION',
  'BHOIWADA POLICE STATION',
  'KONGAON POLICE STATION',
  'NARPOLI POLICE STATION',
  'NIZAMPURA POLICE STATION',
  'SHANTINAGAR POLICE STATION',
  'BAZARPETH POLICE STATION',
  'DOMBIWALI POLICE STATION',
  'KHADAKPADA POLICE STATION',
  'KOLSHEWADI POLICE STATION',
  'MAHATMA PHULE CHOUK POLICE STATION',
  'MANPADA POLICE STATION',
  'TILAKNAGAR POLICE STATION',
  'VISHNUNAGAR POLICE STATION',
  'AMBARNATH POLICE STATION',
  'BADALAPUR EAST POLICE STATION',
  'BADALAPUR WEST POLICE STATION',
  'CETRAL POLICE STATION',
  'HILLLINE POLICE STATION',
  'SHIVAJINAGAR POLICE STATION',
  'ULHASNAGAR POLICE STATION',
  'VITTHALWADI POLICE STATION',
  'CHITALSAR POLICE STATION',
  'KAPURBAWADI POLICE STATION',
  'KASARWADAWALI POLICE STATION',
  'KOPARI POLICE STATION',
  'SHRINAGAR POLICE STATION',
  'VARTAKNAGAR POLICE STATION',
  'WAGALE ESTATE POLICE STATION'
];

// Get all station names
router.get('/stations', asyncHandler(async (req, res) => {
  // Return hardcoded stations for Senior Citizen
  const stations = SENIOR_CITIZEN_STATIONS.map(station_name => ({ station_name }));
  res.json(stations);
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
      status,
      created_at
    FROM registrations
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  // Apply date filters
  if (startDate && endDate) {
    query += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
    params.push(startDate, endDate);
  }

  // Apply station filter
  if (stations) {
    const stationList = Array.isArray(stations) ? stations : [stations];
    query += ` AND police_station = ANY($${paramIndex++})`;
    params.push(stationList);
  }

  // Add ordering and pagination
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(parseInt(limit), parseInt(offset));

  const result = await querySeniorCitizen(query, params);
  res.json(result.rows);
}));

// Get registration counts for dashboard
router.get('/dashboard/counts', asyncHandler(async (req, res) => {
  const { startDate, endDate, stations } = req.query;

  let query = `
    SELECT
      police_station,
      status,
      created_at
    FROM registrations
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  // Apply date filters
  if (startDate && endDate) {
    query += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
    params.push(startDate, endDate);
  }

  // Apply station filter
  if (stations) {
    const stationList = Array.isArray(stations) ? stations : [stations];
    query += ` AND police_station = ANY($${paramIndex++})`;
    params.push(stationList);
  }

  const result = await querySeniorCitizen(query, params);

  // Calculate counts
  const counts = {
    total: result.rows.length,
    pending: 0,
    verified: 0,
    rejected: 0
  };

  result.rows.forEach(row => {
    if (row.status === 'pending') counts.pending++;
    else if (row.status === 'verified') counts.verified++;
    else if (row.status === 'rejected') counts.rejected++;
  });

  res.json(counts);
}));

// Get station-wise registration data
router.get('/stations/data', asyncHandler(async (req, res) => {
    const { startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        UPPER(TRIM(police_station)) as station,
        status,
        created_at
      FROM registrations
      WHERE police_station IS NOT NULL
    `;
    const params = [];
    let paramIndex = 1;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await querySeniorCitizen(query, params);

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
      if (row.status === 'pending') data.pending++;
      else if (row.status === 'verified') data.verified++;
      else if (row.status === 'rejected') data.rejected++;
    });

    res.json(Array.from(stationMap.values()));
  ));;

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

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

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

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

// Get feedbacks count
router.get('/feedbacks', asyncHandler(async (req, res) => {
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
      query += ` ${paramIndex === 1 ? ' WHERE' : ' AND'} police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

// Drill down: Get detailed registration data by status
router.get('/drilldown/registrations', asyncHandler(async (req, res) => {
    const { status, startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        status,
        created_at,
        full_name,
        contact_number
      FROM registrations
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply status filter
    if (status && status !== 'all' && status !== 'active_users' && status !== 'active_services') {
      if (status === 'verified') {
        query += ` AND status = $${paramIndex++}`;
        params.push('verified');
      } else if (status === 'pending') {
        query += ` AND status = $${paramIndex++}`;
        params.push('pending');
      } else if (status === 'rejected') {
        query += ` AND status = $${paramIndex++}`;
        params.push('rejected');
      }
    }

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await querySeniorCitizen(query, params);
    res.json(result.rows);
  ));;

// Drill down: Get active users details
router.get('/drilldown/active-users', asyncHandler(async (req, res) => {
    const { stations } = req.query;

    let query = `
      SELECT
        al.id,
        al.user_email,
        al.police_station,
        al.start_time,
        r.full_name,
        r.contact_number
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

    const result = await querySeniorCitizen(query, params);
    res.json(result.rows);
  ));;

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

    const result = await querySeniorCitizen(query, params);
    res.json(result.rows);
  ));;

// Drill down: Get feedbacks details
router.get('/drilldown/feedbacks', asyncHandler(async (req, res) => {
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

    const result = await querySeniorCitizen(query, params);
    res.json(result.rows);
  ));;

// Get SOS alerts count for a specific date
router.get('/sos-count', asyncHandler(async (req, res) => {
    const { startDate, endDate, stations } = req.query;

    let query = `SELECT COUNT(*) as count FROM sos_alerts WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND alert_timestamp >= $${paramIndex++} AND alert_timestamp <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

// Get voice recordings count
router.get('/voice-count', asyncHandler(async (req, res) => {
    const { stations } = req.query;

    let query = `SELECT COUNT(*) as count FROM audio_recordings WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

// Get complaints count
router.get('/complaints-count', asyncHandler(async (req, res) => {
    const { stations } = req.query;

    let query = `SELECT COUNT(*) as count FROM complaints WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

// Get user feedback count
router.get('/user-feedback-count', asyncHandler(async (req, res) => {
    const { startDate, endDate, stations } = req.query;

    let query = `SELECT COUNT(*) as count FROM user_feedback WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    const result = await querySeniorCitizen(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  ));;

// Drill down: Get SOS alerts details
router.get('/drilldown/sos', asyncHandler(async (req, res) => {
    console.log('SOS drilldown request:', req.query);
    const { startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        alert_timestamp,
        user_id,
        user_name,
        status,
        resolved_at,
        location_address,
        latitude,
        longitude,
        emergency_contacts,
        resolved_by,
        notes
      FROM sos_alerts
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND alert_timestamp >= $${paramIndex++} AND alert_timestamp <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY alert_timestamp DESC`;

    console.log('SOS Query:', query);
    console.log('SOS Params:', params);

    const result = await querySeniorCitizen(query, params);
    console.log('SOS Result rows:', result.rows.length);

    // Log first row for debugging
    if (result.rows.length > 0) {
      console.log('Sample SOS data:', JSON.stringify(result.rows[0], null, 2));
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching SOS drilldown data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch SOS drilldown data', details: error.message });
  }
});

// Drill down: Get voice recordings details
router.get('/drilldown/voice', asyncHandler(async (req, res) => {
    console.log('Voice drilldown request:', req.query);
    const { stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        user_phone,
        audio_url,
        status,
        recorded_at,
        created_at,
        resolved_at
      FROM audio_recordings
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY created_at DESC`;

    console.log('Voice query:', query);
    console.log('Voice params:', params);

    const result = await querySeniorCitizen(query, params);
    console.log('Voice result rows:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching voice drilldown data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch voice drilldown data', details: error.message });
  }
});

// Drill down: Get complaints details
router.get('/drilldown/complaints', asyncHandler(async (req, res) => {
    console.log('Complaints drilldown request:', req.query);
    const { stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        user_phone,
        title,
        description,
        status,
        incident_date,
        incident_time,
        location,
        submitted_at,
        updated_at,
        resolved_at
      FROM complaints
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY submitted_at DESC`;

    console.log('Complaints query:', query);
    console.log('Complaints params:', params);

    const result = await querySeniorCitizen(query, params);
    console.log('Complaints result rows:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching complaints drilldown data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch complaints drilldown data', details: error.message });
  }
});

// Drill down: Get user feedback details
router.get('/drilldown/user-feedback', asyncHandler(async (req, res) => {
    console.log('User feedback drilldown request:', req.query);
    const { startDate, endDate, stations } = req.query;

    let query = `
      SELECT
        id,
        police_station,
        user_phone,
        rating,
        feedback,
        reply,
        replied_by,
        submitted_at,
        created_at,
        resolved_at,
        replied_at
      FROM user_feedback
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Apply date filters
    if (startDate && endDate) {
      query += ` AND submitted_at >= $${paramIndex++} AND submitted_at <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    // Apply station filter
    if (stations) {
      const stationList = Array.isArray(stations) ? stations : [stations];
      query += ` AND police_station = ANY($${paramIndex++})`;
      params.push(stationList);
    }

    query += ` ORDER BY submitted_at DESC`;

    console.log('User feedback query:', query);
    console.log('User feedback params:', params);

    const result = await querySeniorCitizen(query, params);
    console.log('User feedback result rows:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user feedback drilldown data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch user feedback drilldown data', details: error.message });
  }
});

module.exports = router;
