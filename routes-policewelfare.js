const express = require('express');
const router = express.Router();
const { queryPoliceWelfare } = require('./db-policewelfare');
const { asyncHandler } = require('./errorHandler');

// Initialize tables
const initializeTables = async () => {
  try {
    // Create police_welfare_data table
    await queryPoliceWelfare(`
      CREATE TABLE IF NOT EXISTS police_welfare_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        requests INTEGER DEFAULT 0,
        approved INTEGER DEFAULT 0,
        pending INTEGER DEFAULT 0,
        rejected INTEGER DEFAULT 0,
        approved_amount JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on date
    await queryPoliceWelfare(`
      CREATE INDEX IF NOT EXISTS idx_police_welfare_data_date ON police_welfare_data(date)
    `);

    console.log('PoliceWelfare: Tables initialized successfully');
  } catch (error) {
    console.error('PoliceWelfare: Error initializing tables:', error);
  }
};

// Initialize table on module load
initializeTables();

// Get welfare data by date
router.get('/welfare-data', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  const result = await queryPoliceWelfare(
    'SELECT * FROM police_welfare_data WHERE date = $1',
    [date]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No data found for this date' });
  }

  res.json(result.rows[0]);
}));

// Upsert welfare data
router.post('/welfare-data', asyncHandler(async (req, res) => {
  const { date, requests, approved, pending, rejected, approved_amount } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }

  // Validate approved_amount is an array
  const amountData = Array.isArray(approved_amount) ? approved_amount : [];

  const result = await queryPoliceWelfare(
    `INSERT INTO police_welfare_data (date, requests, approved, pending, rejected, approved_amount, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (date)
       DO UPDATE SET requests = $2, approved = $3, pending = $4, rejected = $5, approved_amount = $6, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
    [date, requests || 0, approved || 0, pending || 0, rejected || 0, JSON.stringify(amountData)]
  );

  console.log('PoliceWelfare: Welfare data upserted successfully for date:', date);
  res.json({ message: 'Welfare data saved successfully', data: result.rows[0] });
}));

// Get latest welfare data
router.get('/welfare-data/latest', asyncHandler(async (req, res) => {
  const result = await queryPoliceWelfare(
    'SELECT * FROM police_welfare_data ORDER BY date DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'No welfare data found' });
  }

  res.json(result.rows[0]);
}));

module.exports = router;
