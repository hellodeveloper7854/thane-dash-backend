const express = require('express');
const router = express.Router();
const { queryFingerprint } = require('./db-fingerprint');
const { asyncHandler } = require('./errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Windows Server Configuration - same as IGotELearning and CCTNS
const WINDOWS_SERVER_CONFIG = {
  // Save Fingerprint PDFs in the same location as IGotELearning
  uploadPath: process.env.WINDOWS_SERVER_PATH || path.join(__dirname, 'uploads', 'igotlearning'),

  // Public URL base path
  publicUrlBase: process.env.WINDOWS_SERVER_URL || '/api/fingerprint/files',

  // Local fallback path
  localFallbackPath: path.join(__dirname, 'uploads', 'igotlearning'),

  // Local fallback URL base
  localFallbackUrlBase: '/api/fingerprint/files',
};

// Configure storage for PDF uploads - use memory storage first
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Helper function to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Helper function to save file to local storage (same as IGotELearning)
const saveToWindowsServer = async (file, filename) => {
  return new Promise((resolve, reject) => {
    const uploadPath = path.join(WINDOWS_SERVER_CONFIG.uploadPath, filename);

    console.log('Saving file to local storage:', uploadPath);

    // Ensure directory exists
    const dir = path.dirname(uploadPath);
      if (!fs.existsSync(dir)) {
        console.log('Creating directory:', dir);
        fs.mkdirSync(dir, { recursive: true });
        console.log('Directory created successfully:', dir);
      }
    } catch (mkdirError) {
      console.error('Error creating directory:', dir, mkdirError);
      reject(new Error(`Failed to create directory: ${mkdirError.message}`));
      return;
    }

    // Write file to storage
    fs.writeFile(uploadPath, file.buffer, (err) => {
      if (err) {
        console.error('Error saving file:', err);
        reject(new Error(`Failed to save file: ${err.message}`));
      } else {
        console.log('File saved successfully:', uploadPath);
        // Return the public URL - using the same base as IGotELearning
        const publicUrl = `https://cpthanearchive.thanepolice.in/${filename}`;
        resolve(publicUrl);
      }
    });
  });
};

// Initialize the fingerprint_pdfs table if it doesn't exist
const initializeTable = async () => {
    await queryFingerprint(`
      CREATE TABLE IF NOT EXISTS fingerprint_pdfs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        card_key VARCHAR(50) NOT NULL,
        pdf_url TEXT,
        pdf_date DATE NOT NULL,
        start_date DATE,
        end_date DATE,
        month VARCHAR(7), -- Format: YYYY-MM
        uploaded_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(card_key, pdf_date)
      )
    `);

    // Create indexes for faster queries
    await queryFingerprint(`
      CREATE INDEX IF NOT EXISTS idx_fingerprint_pdfs_date ON fingerprint_pdfs(pdf_date)
    `);

    await queryFingerprint(`
      CREATE INDEX IF NOT EXISTS idx_fingerprint_pdfs_month ON fingerprint_pdfs(month)
    `);

    await queryFingerprint(`
      CREATE INDEX IF NOT EXISTS idx_fingerprint_pdfs_card_key ON fingerprint_pdfs(card_key)
    `);

    console.log('Fingerprint: Table initialized successfully');

    const result = await queryFingerprint(
      'SELECT card_key, pdf_url, start_date, end_date, month, pdf_date FROM fingerprint_pdfs WHERE pdf_date = $1',
      [date]
    );

    res.json(result.rows);
  ));;

// Get PDFs by card type and date range
router.get('/pdfs-by-card', asyncHandler(async (req, res) => {
    const { card_key } = req.query;

    if (!card_key) {
      return res.status(400).json({ error: 'card_key parameter is required' });
    }

    const result = await queryFingerprint(
      `SELECT card_key, pdf_url, start_date, end_date, month, pdf_date
       FROM fingerprint_pdfs
       WHERE card_key = $1
       ORDER BY pdf_date DESC`,
      [card_key]
    );

    res.json(result.rows);
  ));;

// Get PDF by specific conditions (month or date range)
router.get('/pdf-by-conditions', asyncHandler(async (req, res) => {
    const { card_key, month, start_date, end_date } = req.query;

    if (!card_key) {
      return res.status(400).json({ error: 'card_key parameter is required' });
    }

    let query = 'SELECT pdf_url FROM fingerprint_pdfs WHERE card_key = $1';
    const params = [typeof card_key === 'string' ? card_key : card_key[0]];
    let paramIndex = 2;

    if (month) {
      const monthValue = typeof month === 'string' ? month : month[0];
      query += ` AND month = $${paramIndex++}`;
      params.push(monthValue);
    }

    if (start_date && end_date) {
      // Parse dates to handle both ISO strings and YYYY-MM-DD format
      const startDateValue = typeof start_date === 'string' ? start_date : start_date[0];
      const endDateValue = typeof end_date === 'string' ? end_date : end_date[0];

      const startDateObj = new Date(startDateValue);
      const endDateObj = new Date(endDateValue);

      // Format to YYYY-MM-DD
      const startDateStr = startDateObj.toISOString().split('T')[0];
      const endDateStr = endDateObj.toISOString().split('T')[0];

      query += ` AND start_date = $${paramIndex++} AND end_date = $${paramIndex++}`;
      params.push(startDateStr, endDateStr);
    }

    const result = await queryFingerprint(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No PDF found for the specified conditions' });
    }

    res.json(result.rows[0]);
  ));;

// Delete PDF by conditions
router.delete('/pdfs', asyncHandler(async (req, res) => {
    const { card_key, month, start_date, end_date, date } = req.query;

    if (!card_key) {
      return res.status(400).json({ error: 'card_key parameter is required' });
    }

    // First get the PDF record(s) to find the file path(s)
    let query = 'SELECT pdf_url FROM fingerprint_pdfs WHERE card_key = $1';
    const params = [typeof card_key === 'string' ? card_key : card_key[0]];
    let paramIndex = 2;

    if (month) {
      const monthValue = typeof month === 'string' ? month : month[0];
      query += ` AND month = $${paramIndex++}`;
      params.push(monthValue);
    }

    if (start_date && end_date) {
      // Parse dates to handle both ISO strings and YYYY-MM-DD format
      const startDateValue = typeof start_date === 'string' ? start_date : start_date[0];
      const endDateValue = typeof end_date === 'string' ? end_date : end_date[0];

      const startDateObj = new Date(startDateValue);
      const endDateObj = new Date(endDateValue);

      // Format to YYYY-MM-DD
      const startDateStr = startDateObj.toISOString().split('T')[0];
      const endDateStr = endDateObj.toISOString().split('T')[0];

      query += ` AND start_date = $${paramIndex++} AND end_date = $${paramIndex++}`;
      params.push(startDateStr, endDateStr);
    } else if (date) {
      // Parse date to handle both ISO strings and YYYY-MM-DD format
      const dateValue = typeof date === 'string' ? date : date[0];
      const dateObj = new Date(dateValue);
      const dateStr = dateObj.toISOString().split('T')[0];

      query += ` AND pdf_date = $${paramIndex++}`;
      params.push(dateStr);
    }

    const pdfRecords = await queryFingerprint(query, params);

    if (pdfRecords.rows.length === 0) {
      return res.status(404).json({ error: 'PDF(s) not found' });
    }

    // Delete files from storage
    for (const record of pdfRecords.rows) {
      const filename = record.pdf_url.split('/').pop();
      const filePath = path.join(WINDOWS_SERVER_CONFIG.uploadPath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Fingerprint: File deleted from storage:', filePath);
      }
    }

    // Delete from database
    const deleteResult = await queryFingerprint(
      query + ' RETURNING *',
      params
    );

    console.log('Fingerprint: PDF(s) deleted successfully for card:', card_key);
    res.json({ message: 'PDF(s) deleted successfully', deleted: deleteResult.rows });
  ));;

// Get latest date with data
router.get('/latest-date', asyncHandler(async (req, res) => {
    const result = await queryFingerprint(
      'SELECT pdf_date FROM fingerprint_pdfs ORDER BY pdf_date DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ pdf_date: null });
    }

    res.json(result.rows[0]);
  ));;

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
    await queryFingerprint('SELECT 1');
    res.json({ status: 'healthy', message: 'Fingerprint database connection is working' });