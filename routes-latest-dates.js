const express = require('express');
const router = express.Router();
const { queryATNT } = require('./db-atnt');
const { asyncHandler } = require('./errorHandler');

// Helper function to get latest date from a table
const getLatestDate = async (tableName, dateColumn) => {
  try {
    const result = await queryATNT(
      `SELECT ${dateColumn} FROM ${tableName} ORDER BY ${dateColumn} DESC LIMIT 1`
    );
    return result.rows[0]?.[dateColumn] || null;
  } catch (error) {
    console.error(`Error fetching latest date from ${tableName}:`, error);
    return null;
  }
};

// Get latest ATNT date
router.get('/atnt', asyncHandler(async (req, res) => {
  // Get latest date from both ATNT tables
  const dailyResult = await queryATNT(
    'SELECT date::text as date FROM atnt_daily_summary ORDER BY date DESC LIMIT 1'
  );
  const offenseResult = await queryATNT(
    'SELECT date::text as date FROM atnt_offense_summary ORDER BY date DESC LIMIT 1'
  );

  const dates = [];
  if (dailyResult.rows[0]?.date) dates.push(new Date(dailyResult.rows[0].date));
  if (offenseResult.rows[0]?.date) dates.push(new Date(offenseResult.rows[0].date));

  // Return the latest date
  dates.sort((a, b) => a - b);
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

  res.json({ date: latestDate });
}));

// Get latest E-Office date
router.get('/eoffice', asyncHandler(async (req, res) => {
  const result = await queryATNT(
    'SELECT date FROM eoffice_data ORDER BY date DESC LIMIT 1'
  );
  res.json({ date: result.rows[0]?.date || null });
}));

// Get latest I-Got E-Learning date
router.get('/i-got-e-learning', asyncHandler(async (req, res) => {
  const result = await queryATNT(
    'SELECT pdf_date FROM i_got_e_learning_pdfs ORDER BY pdf_date DESC LIMIT 1'
  );
  res.json({ date: result.rows[0]?.pdf_date || null });
}));

// Get latest Emergency 112 date
router.get('/emergency112', asyncHandler(async (req, res) => {
  const result = await queryATNT(
    'SELECT date FROM emergency112_daily_summary ORDER BY date DESC LIMIT 1'
  );
  res.json({ date: result.rows[0]?.date || null });
}));

// Get latest Police Welfare date
router.get('/police-welfare', asyncHandler(async (req, res) => {
  const result = await queryATNT(
    'SELECT date FROM police_welfare_data ORDER BY date DESC LIMIT 1'
  );
  res.json({ date: result.rows[0]?.date || null });
}));

module.exports = router;
