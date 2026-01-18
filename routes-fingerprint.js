const express = require('express');
const router = express.Router();
const { queryFingerprint } = require('./db-fingerprint');
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
    try {
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
        const publicUrl = `http://94.249.213.97/thanedashboardassests/${filename}`;
        resolve(publicUrl);
      }
    });
  });
};

// Initialize the fingerprint_pdfs table if it doesn't exist
const initializeTable = async () => {
  try {
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
  } catch (error) {
    console.error('Fingerprint: Error initializing table:', error);
  }
};

// Initialize table on module load
initializeTable();

// Serve static files from the uploads directory
router.use('/files', express.static(path.join(WINDOWS_SERVER_CONFIG.uploadPath)));

// Upload PDF and save metadata
router.post('/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { card_key, pdf_date, start_date, end_date, month, uploaded_by } = req.body;

    if (!card_key || !pdf_date) {
      return res.status(400).json({ error: 'card_key and pdf_date are required' });
    }

    // Normalize dates to YYYY-MM-DD format to handle timezone issues
    const normalizeDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      // Get the date parts in local timezone to avoid UTC conversion
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const normalizedPdfDate = normalizeDate(pdf_date);
    const normalizedStartDate = start_date ? normalizeDate(start_date) : null;
    const normalizedEndDate = end_date ? normalizeDate(end_date) : null;

    // Generate filename
    let filename;
    if (card_key === 'weekly' && normalizedStartDate && normalizedEndDate) {
      filename = `fingerprint_weekly_${normalizedStartDate}_to_${normalizedEndDate}_${Date.now()}.pdf`;
    } else if (card_key === 'monthly' && month) {
      filename = `fingerprint_monthly_${month}_${Date.now()}.pdf`;
    } else {
      filename = `fingerprint_${card_key}_${normalizedPdfDate}_${Date.now()}.pdf`;
    }

    // Save file to Windows server (same location as IGotELearning)
    const pdf_url = await saveToWindowsServer(req.file, filename);

    // Validate uploaded_by UUID - only pass valid UUIDs to database
    const validUploadedBy = uploaded_by && isValidUUID(uploaded_by) ? uploaded_by : null;

    // Save to database
    const result = await queryFingerprint(
      `INSERT INTO fingerprint_pdfs (card_key, pdf_url, pdf_date, start_date, end_date, month, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (card_key, pdf_date)
       DO UPDATE SET pdf_url = $2, start_date = $4, end_date = $5, month = $6, uploaded_by = $7, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [card_key, pdf_url, normalizedPdfDate, normalizedStartDate, normalizedEndDate, month || null, validUploadedBy]
    );

    console.log('Fingerprint: PDF uploaded to Windows server and metadata saved for card:', card_key, 'date:', normalizedPdfDate);
    res.json({ message: 'PDF uploaded successfully', pdf_url: pdf_url, data: result.rows[0] });
  } catch (error) {
    console.error('Fingerprint: Error uploading PDF:', error);
    res.status(500).json({ error: 'Failed to upload PDF', details: error.message });
  }
});

// Get PDFs by date
router.get('/pdfs', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const result = await queryFingerprint(
      'SELECT card_key, pdf_url, start_date, end_date, month, pdf_date FROM fingerprint_pdfs WHERE pdf_date = $1',
      [date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fingerprint: Error fetching PDFs:', error);
    res.status(500).json({ error: 'Failed to fetch PDFs', details: error.message });
  }
});

// Get PDFs by card type and date range
router.get('/pdfs-by-card', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Fingerprint: Error fetching PDFs:', error);
    res.status(500).json({ error: 'Failed to fetch PDFs', details: error.message });
  }
});

// Get PDF by specific conditions (month or date range)
router.get('/pdf-by-conditions', async (req, res) => {
  try {
    const { card_key, month, start_date, end_date } = req.query;

    if (!card_key) {
      return res.status(400).json({ error: 'card_key parameter is required' });
    }

    let query = 'SELECT pdf_url FROM fingerprint_pdfs WHERE card_key = $1';
    const params = [card_key];
    let paramIndex = 2;

    if (month) {
      query += ` AND month = $${paramIndex++}`;
      params.push(month);
    }

    if (start_date && end_date) {
      // Parse dates to handle both ISO strings and YYYY-MM-DD format
      const startDateObj = new Date(start_date as string);
      const endDateObj = new Date(end_date as string);

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
  } catch (error) {
    console.error('Fingerprint: Error fetching PDF:', error);
    res.status(500).json({ error: 'Failed to fetch PDF', details: error.message });
  }
});

// Delete PDF by conditions
router.delete('/pdfs', async (req, res) => {
  try {
    const { card_key, month, start_date, end_date, date } = req.query;

    if (!card_key) {
      return res.status(400).json({ error: 'card_key parameter is required' });
    }

    // First get the PDF record(s) to find the file path(s)
    let query = 'SELECT pdf_url FROM fingerprint_pdfs WHERE card_key = $1';
    const params = [card_key];
    let paramIndex = 2;

    if (month) {
      query += ` AND month = $${paramIndex++}`;
      params.push(month);
    }

    if (start_date && end_date) {
      // Parse dates to handle both ISO strings and YYYY-MM-DD format
      const startDateObj = new Date(start_date as string);
      const endDateObj = new Date(end_date as string);

      // Format to YYYY-MM-DD
      const startDateStr = startDateObj.toISOString().split('T')[0];
      const endDateStr = endDateObj.toISOString().split('T')[0];

      query += ` AND start_date = $${paramIndex++} AND end_date = $${paramIndex++}`;
      params.push(startDateStr, endDateStr);
    } else if (date) {
      // Parse date to handle both ISO strings and YYYY-MM-DD format
      const dateObj = new Date(date as string);
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
  } catch (error) {
    console.error('Fingerprint: Error deleting PDF:', error);
    res.status(500).json({ error: 'Failed to delete PDF', details: error.message });
  }
});

// Get latest date with data
router.get('/latest-date', async (req, res) => {
  try {
    const result = await queryFingerprint(
      'SELECT pdf_date FROM fingerprint_pdfs ORDER BY pdf_date DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ pdf_date: null });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fingerprint: Error fetching latest date:', error);
    res.status(500).json({ error: 'Failed to fetch latest date', details: error.message });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await queryFingerprint('SELECT 1');
    res.json({ status: 'healthy', message: 'Fingerprint database connection is working' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', message: 'Fingerprint database connection failed', details: error.message });
  }
});

module.exports = router;
