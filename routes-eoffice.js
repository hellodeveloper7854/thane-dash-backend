const express = require('express');
const router = express.Router();
const { queryEOffice } = require('./db-eoffice');
const { asyncHandler } = require('./errorHandler');

// Initialize the eoffice_data table if it doesn't exist
const initializeTable = async () => {
  try {
    await queryEOffice(`
      CREATE TABLE IF NOT EXISTS eoffice_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        sections JSONB,
        total_users INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on date for faster queries
    await queryEOffice(`
      CREATE INDEX IF NOT EXISTS idx_eoffice_data_date ON eoffice_data(date)
    `);

    console.log('EOffice: Table initialized successfully');
  } catch (error) {
    console.error('EOffice: Error initializing table:', error);
  }
};

// Initialize table on module load
initializeTable();

// Get EOffice data by date
router.get('/data', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  const result = await queryEOffice(
    'SELECT date, sections, total_users FROM eoffice_data WHERE date = $1',
    [date]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No data found for the specified date' });
  }

  res.json(result.rows[0]);
}));

// Get EOffice data for a date range (for historical data calculations)
router.get('/data-range', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date parameters are required' });
  }

  const result = await queryEOffice(
    'SELECT date, sections, total_users FROM eoffice_data WHERE date >= $1 AND date <= $2 ORDER BY date',
    [startDate, endDate]
  );

  res.json(result.rows);
}));

// Upsert EOffice data (insert or update)
router.post('/data', asyncHandler(async (req, res) => {
  const { date, sections, total_users } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Check if data exists for the date
  const checkExists = await queryEOffice(
    'SELECT id FROM eoffice_data WHERE date = $1',
    [date]
  );

  if (checkExists.rows.length > 0) {
    // Update existing record
    const result = await queryEOffice(
      `UPDATE eoffice_data
       SET sections = $2, total_users = $3, updated_at = CURRENT_TIMESTAMP
       WHERE date = $1
       RETURNING *`,
      [date, JSON.stringify(sections), total_users || 0]
    );

    console.log('EOffice: Data updated successfully for date:', date);
    res.json(result.rows[0]);
  } else {
    // Insert new record
    const result = await queryEOffice(
      `INSERT INTO eoffice_data (date, sections, total_users, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING *`,
      [date, JSON.stringify(sections), total_users || 0]
    );

    console.log('EOffice: Data inserted successfully for date:', date);
    res.json(result.rows[0]);
  }
}));

// Delete EOffice data by date
router.delete('/data', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  const result = await queryEOffice(
    'DELETE FROM eoffice_data WHERE date = $1 RETURNING *',
    [date]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No data found for the specified date' });
  }

  console.log('EOffice: Data deleted successfully for date:', date);
  res.json({ message: 'Data deleted successfully', deleted: result.rows[0] });
}));

// Get latest date with data
router.get('/latest-date', asyncHandler(async (req, res) => {
  const result = await queryEOffice(
    'SELECT date FROM eoffice_data ORDER BY date DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return res.json({ date: null });
  }

  res.json(result.rows[0]);
}));

// Get all available dates
router.get('/dates', asyncHandler(async (req, res) => {
  const result = await queryEOffice(
    'SELECT date FROM eoffice_data ORDER BY date DESC'
  );

  res.json(result.rows);
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  await queryEOffice('SELECT 1');
  res.json({ status: 'healthy', message: 'EOffice database connection is working' });
}));

module.exports = router;
