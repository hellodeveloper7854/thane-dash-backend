const express = require('express');
const router = express.Router();
const { queryEmergency112 } = require('./db-emergency112');

// Initialize the emergency112_daily_summary table if it doesn't exist
const initializeTable = async () => {
  try {
    // Check if table exists
    const tableCheck = await queryEmergency112(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'emergency112_daily_summary'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;

    if (tableExists) {
      // Check if the unique constraint on date exists
      const constraintCheck = await queryEmergency112(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'emergency112_daily_summary'
        AND constraint_type = 'UNIQUE';
      `);

      const hasUniqueConstraint = constraintCheck.rows.length > 0;

      if (!hasUniqueConstraint) {
        console.log('Emergency112: Table exists but missing UNIQUE constraint on date, dropping and recreating...');
        await queryEmergency112('DROP TABLE emergency112_daily_summary CASCADE;');
      } else {
        console.log('Emergency112: Table already exists with correct structure');
        return;
      }
    }

    // Create the table with proper UNIQUE constraint
    await queryEmergency112(`
      CREATE TABLE emergency112_daily_summary (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        total_calls INTEGER,
        avg_response_time VARCHAR(50),
        summary_data JSONB,
        calls_data JSONB,
        created_by UUID,
        time_range_from VARCHAR(50),
        time_range_to VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT emergency112_daily_summary_date_key UNIQUE (date)
      )
    `);

    // Create index on date for faster queries
    await queryEmergency112(`
      CREATE INDEX IF NOT EXISTS idx_emergency112_daily_summary_date ON emergency112_daily_summary(date)
    `);

    console.log('Emergency112: Table initialized successfully');
  } catch (error) {
    console.error('Emergency112: Error initializing table:', error);
  }
};

// Initialize table on module load
initializeTable();

// Get emergency data by date
router.get('/data', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const result = await queryEmergency112(
      'SELECT * FROM emergency112_daily_summary WHERE date = $1',
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified date' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Emergency112: Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch emergency data', details: error.message });
  }
});

// Upsert emergency daily summary (insert or update)
router.post('/data', async (req, res) => {
  try {
    const { date, total_calls, avg_response_time, summary_data, calls_data, created_by, time_range_from, time_range_to } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const result = await queryEmergency112(
      `INSERT INTO emergency112_daily_summary (date, total_calls, avg_response_time, summary_data, calls_data, created_by, time_range_from, time_range_to, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT ON CONSTRAINT emergency112_daily_summary_date_key
       DO UPDATE SET total_calls = $2, avg_response_time = $3, summary_data = $4, calls_data = $5, created_by = $6, time_range_from = $7, time_range_to = $8, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [date, total_calls || 0, avg_response_time || null, JSON.stringify(summary_data || {}), JSON.stringify(calls_data || {}), created_by || null, time_range_from || null, time_range_to || null]
    );

    console.log('Emergency112: Daily summary upserted successfully for date:', date);
    res.json({ message: 'Emergency data saved successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Emergency112: Error upserting data:', error);
    res.status(500).json({ error: 'Failed to save emergency data', details: error.message });
  }
});

// Bulk upsert emergency data (for multiple emergency types at once)
// Note: This endpoint is kept for backward compatibility but routes to the single-record structure
router.post('/bulk-data', async (req, res) => {
  try {
    const { date, total_calls, avg_response_time, summary_data, calls_data, created_by, time_range_from, time_range_to } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Use the same logic as POST /data - store all emergency types in a single record
    const result = await queryEmergency112(
      `INSERT INTO emergency112_daily_summary (date, total_calls, avg_response_time, summary_data, calls_data, created_by, time_range_from, time_range_to, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT ON CONSTRAINT emergency112_daily_summary_date_key
       DO UPDATE SET total_calls = $2, avg_response_time = $3, summary_data = $4, calls_data = $5, created_by = $6, time_range_from = $7, time_range_to = $8, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [date, total_calls || 0, avg_response_time || null, JSON.stringify(summary_data || {}), JSON.stringify(calls_data || {}), created_by || null, time_range_from || null, time_range_to || null]
    );

    console.log('Emergency112: Bulk data upserted successfully for date:', date);
    res.json({ message: 'Emergency data saved successfully', data: [result.rows[0]], count: 1 });
  } catch (error) {
    console.error('Emergency112: Error bulk upserting data:', error);
    res.status(500).json({ error: 'Failed to save emergency data', details: error.message });
  }
});

// Delete emergency data by date
router.delete('/data', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const result = await queryEmergency112(
      'DELETE FROM emergency112_daily_summary WHERE date = $1 RETURNING *',
      [date]
    );

    console.log('Emergency112: Data deleted successfully for date:', date);
    res.json({ message: 'Emergency data deleted successfully', deleted: result.rows });
  } catch (error) {
    console.error('Emergency112: Error deleting data:', error);
    res.status(500).json({ error: 'Failed to delete emergency data', details: error.message });
  }
});

// Get latest date with data
router.get('/latest-date', async (req, res) => {
  try {
    const result = await queryEmergency112(
      'SELECT date FROM emergency112_daily_summary ORDER BY date DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ date: null });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Emergency112: Error fetching latest date:', error);
    res.status(500).json({ error: 'Failed to fetch latest date', details: error.message });
  }
});

// Get all available dates
router.get('/dates', async (req, res) => {
  try {
    const result = await queryEmergency112(
      'SELECT DISTINCT date FROM emergency112_daily_summary ORDER BY date DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Emergency112: Error fetching dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates', details: error.message });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await queryEmergency112('SELECT 1');
    res.json({ status: 'healthy', message: 'Emergency112 database connection is working' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', message: 'Emergency112 database connection failed', details: error.message });
  }
});

// ==================== emergency112_calls endpoints ====================

// Initialize the emergency112_calls table if it doesn't exist
const initializeCallsTable = async () => {
  try {
    const tableCheck = await queryEmergency112(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'emergency112_calls'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      await queryEmergency112(`
        CREATE TABLE emergency112_calls (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          date DATE NOT NULL,
          event_id VARCHAR(255),
          region VARCHAR(255),
          zone VARCHAR(255),
          police_station VARCHAR(255),
          incident_type VARCHAR(255),
          do_user_id VARCHAR(255),
          total_response_time INTEGER,
          start_time VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await queryEmergency112(`
        CREATE INDEX IF NOT EXISTS idx_emergency112_calls_date ON emergency112_calls(date)
      `);

      console.log('Emergency112: Calls table initialized successfully');
    }
  } catch (error) {
    console.error('Emergency112: Error initializing calls table:', error);
  }
};

// Initialize calls table
initializeCallsTable();

// Get call events by date
router.get('/calls', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const result = await queryEmergency112(
      'SELECT * FROM emergency112_calls WHERE date = $1 ORDER BY created_at DESC',
      [date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Emergency112: Error fetching call events:', error);
    res.status(500).json({ error: 'Failed to fetch call events', details: error.message });
  }
});

// Create new call event
router.post('/calls', async (req, res) => {
  try {
    const {
      date,
      event_id,
      region,
      zone,
      police_station,
      incident_type,
      do_user_id,
      total_response_time,
      start_time
    } = req.body;

    if (!date || !police_station || !incident_type) {
      return res.status(400).json({ error: 'date, police_station, and incident_type are required' });
    }

    const result = await queryEmergency112(
      `INSERT INTO emergency112_calls (date, event_id, region, zone, police_station, incident_type, do_user_id, total_response_time, start_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [date, event_id || null, region || null, zone || null, police_station, incident_type, do_user_id || null, total_response_time || null, start_time || null]
    );

    console.log('Emergency112: Call event created successfully');
    res.status(201).json({ message: 'Call event created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Emergency112: Error creating call event:', error);
    res.status(500).json({ error: 'Failed to create call event', details: error.message });
  }
});

// Delete call event by ID
router.delete('/calls/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryEmergency112(
      'DELETE FROM emergency112_calls WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call event not found' });
    }

    console.log('Emergency112: Call event deleted successfully');
    res.json({ message: 'Call event deleted successfully' });
  } catch (error) {
    console.error('Emergency112: Error deleting call event:', error);
    res.status(500).json({ error: 'Failed to delete call event', details: error.message });
  }
});

module.exports = router;
