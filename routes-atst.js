const express = require('express');
const router = express.Router();
const { queryATST } = require('./db-atst');
const { asyncHandler } = require('./errorHandler');

// Initialize the atst_data table if it doesn't exist
const initializeTable = async () => {
  try {
    await queryATST(`
      CREATE TABLE IF NOT EXISTS atst_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        marshal_data JSONB,
        traffic_data JSONB,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on date for faster queries
    await queryATST(`
      CREATE INDEX IF NOT EXISTS idx_atst_data_date ON atst_data(date)
    `);

    console.log('ATST: Table initialized successfully');
  } catch (error) {
    console.error('ATST: Error initializing table:', error);
  }
};

// Initialize table on module load
initializeTable();

// Get ATST data by date
router.get('/data', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  const result = await queryATST(
    'SELECT date, marshal_data, traffic_data, note FROM atst_data WHERE date = $1',
    [date]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No data found for the specified date' });
  }

  res.json(result.rows[0]);
}));

// Upsert ATST data (insert or update)
router.post('/data', asyncHandler(async (req, res) => {
  const { date, marshal_data, traffic_data, note } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Check if data exists for the date
  const checkExists = await queryATST(
    'SELECT id FROM atst_data WHERE date = $1',
    [date]
  );

  if (checkExists.rows.length > 0) {
    // Update existing record
    const result = await queryATST(
      `UPDATE atst_data
       SET marshal_data = $2, traffic_data = $3, note = $4, updated_at = CURRENT_TIMESTAMP
       WHERE date = $1
       RETURNING *`,
      [JSON.stringify(marshal_data), JSON.stringify(traffic_data), note || null, date]
    );

    console.log('ATST: Data updated successfully for date:', date);
    res.json(result.rows[0]);
  } else {
    // Insert new record
    const result = await queryATST(
      `INSERT INTO atst_data (date, marshal_data, traffic_data, note, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       RETURNING *`,
      [date, JSON.stringify(marshal_data), JSON.stringify(traffic_data), note || null]
    );

    console.log('ATST: Data inserted successfully for date:', date);
    res.json(result.rows[0]);
  }
}));

// Delete ATST data by date
router.delete('/data', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  const result = await queryATST(
    'DELETE FROM atst_data WHERE date = $1 RETURNING *',
    [date]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No data found for the specified date' });
  }

  console.log('ATST: Data deleted successfully for date:', date);
  res.json({ message: 'Data deleted successfully', deleted: result.rows[0] });
}));

// Update note for a specific date
router.patch('/note', asyncHandler(async (req, res) => {
  const { date, note } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  const result = await queryATST(
    `UPDATE atst_data
     SET note = $1, updated_at = CURRENT_TIMESTAMP
     WHERE date = $2
     RETURNING *`,
    [note || null, date]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No data found for the specified date' });
  }

  console.log('ATST: Note updated successfully for date:', date);
  res.json(result.rows[0]);
}));

// Get latest date with data
router.get('/latest-date', asyncHandler(async (req, res) => {
  const result = await queryATST(
    'SELECT date FROM atst_data ORDER BY date DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return res.json({ date: null });
  }

  res.json(result.rows[0]);
}));

// Get all available dates
router.get('/dates', asyncHandler(async (req, res) => {
  const result = await queryATST(
    'SELECT date FROM atst_data ORDER BY date DESC'
  );

  res.json(result.rows);
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  await queryATST('SELECT 1');
  res.json({ status: 'healthy', message: 'ATST database connection is working' });
}));

module.exports = router;
