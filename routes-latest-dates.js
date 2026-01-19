const express = require('express');
const router = express.Router();
const { queryATNT } = require('./db-atnt');

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
router.get('/atnt', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error fetching ATNT latest date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest E-Office date
router.get('/eoffice', async (req, res) => {
  try {
    const result = await queryATNT(
      'SELECT date FROM eoffice_data ORDER BY date DESC LIMIT 1'
    );
    res.json({ date: result.rows[0]?.date || null });
  } catch (error) {
    console.error('Error fetching E-Office latest date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest I-Got E-Learning date
router.get('/i-got-e-learning', async (req, res) => {
  try {
    const result = await queryATNT(
      'SELECT pdf_date FROM i_got_e_learning_pdfs ORDER BY pdf_date DESC LIMIT 1'
    );
    res.json({ date: result.rows[0]?.pdf_date || null });
  } catch (error) {
    console.error('Error fetching I-Got E-Learning latest date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest Emergency 112 date
router.get('/emergency112', async (req, res) => {
  try {
    const result = await queryATNT(
      'SELECT date FROM emergency112_daily_summary ORDER BY date DESC LIMIT 1'
    );
    res.json({ date: result.rows[0]?.date || null });
  } catch (error) {
    console.error('Error fetching Emergency 112 latest date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest Police Welfare date
router.get('/police-welfare', async (req, res) => {
  try {
    const result = await queryATNT(
      'SELECT date FROM police_welfare_data ORDER BY date DESC LIMIT 1'
    );
    res.json({ date: result.rows[0]?.date || null });
  } catch (error) {
    console.error('Error fetching Police Welfare latest date:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
