const express = require('express');
const router = express.Router();
const { queryCCTNS } = require('./db-cctns');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Windows Server Configuration - same as IGotELearning
const WINDOWS_SERVER_CONFIG = {
  // Save CCTNS PDFs in the same location as IGotELearning
  uploadPath: process.env.WINDOWS_SERVER_PATH || path.join(__dirname, 'uploads', 'igotlearning'),

  // Public URL base path
  publicUrlBase: process.env.WINDOWS_SERVER_URL || '/api/cctns/files',

  // Local fallback path
  localFallbackPath: path.join(__dirname, 'uploads', 'igotlearning'),

  // Local fallback URL base
  localFallbackUrlBase: '/api/cctns/files',
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

// Initialize the cctns_pdfs table if it doesn't exist
const initializeTable = async () => {
  try {
    await queryCCTNS(`
      CREATE TABLE IF NOT EXISTS cctns_pdfs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        card_key VARCHAR(50) NOT NULL,
        pdf_url TEXT,
        pdf_date DATE NOT NULL,
        uploaded_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(card_key, pdf_date)
      )
    `);

    // Create index on date for faster queries
    await queryCCTNS(`
      CREATE INDEX IF NOT EXISTS idx_cctns_pdfs_date ON cctns_pdfs(pdf_date)
    `);

    console.log('CCTNS: Table initialized successfully');
  } catch (error) {
    console.error('CCTNS: Error initializing table:', error);
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

    const { card_key, pdf_date, uploaded_by } = req.body;

    if (!card_key || !pdf_date) {
      return res.status(400).json({ error: 'card_key and pdf_date are required' });
    }

    // Map card_key to folder-friendly naming
    const cardTypeMap = {
      "sixty-days": "sixtydays",
      "ninety-days": "ninetydays",
      "e-saksha": "esaksha"
    };

    const cardType = cardTypeMap[card_key] || card_key.replace(/-/g, '');
    const filename = `cctns_${cardType}_${pdf_date}_${Date.now()}.pdf`;

    // Save file to Windows server (same location as IGotELearning)
    const pdf_url = await saveToWindowsServer(req.file, filename);

    // Validate uploaded_by UUID - only pass valid UUIDs to database
    const validUploadedBy = uploaded_by && isValidUUID(uploaded_by) ? uploaded_by : null;

    // Save to database
    const result = await queryCCTNS(
      `INSERT INTO cctns_pdfs (card_key, pdf_url, pdf_date, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (card_key, pdf_date)
       DO UPDATE SET pdf_url = $2, uploaded_by = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [card_key, pdf_url, pdf_date, validUploadedBy]
    );

    console.log('CCTNS: PDF uploaded to Windows server and metadata saved for card:', card_key, 'date:', pdf_date);
    res.json({ message: 'PDF uploaded successfully', pdf_url: pdf_url, data: result.rows[0] });
  } catch (error) {
    console.error('CCTNS: Error uploading PDF:', error);
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

    const result = await queryCCTNS(
      'SELECT card_key, pdf_url, pdf_date FROM cctns_pdfs WHERE pdf_date = $1',
      [date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('CCTNS: Error fetching PDFs:', error);
    res.status(500).json({ error: 'Failed to fetch PDFs', details: error.message });
  }
});

// Upsert PDF data (insert or update)
router.post('/pdfs', async (req, res) => {
  try {
    const { card_key, pdf_url, pdf_date, uploaded_by } = req.body;

    if (!card_key || !pdf_url || !pdf_date) {
      return res.status(400).json({ error: 'card_key, pdf_url, and pdf_date are required' });
    }

    // Validate uploaded_by UUID - only pass valid UUIDs to database
    const validUploadedBy = uploaded_by && isValidUUID(uploaded_by) ? uploaded_by : null;

    const result = await queryCCTNS(
      `INSERT INTO cctns_pdfs (card_key, pdf_url, pdf_date, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (card_key, pdf_date)
       DO UPDATE SET pdf_url = $2, uploaded_by = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [card_key, pdf_url, pdf_date, validUploadedBy]
    );

    console.log('CCTNS: PDF data upserted successfully for card:', card_key, 'date:', pdf_date);
    res.json({ message: 'PDF data saved successfully', data: result.rows[0] });
  } catch (error) {
    console.error('CCTNS: Error upserting PDF data:', error);
    res.status(500).json({ error: 'Failed to save PDF data', details: error.message });
  }
});

// Delete PDF by date and card_key
router.delete('/pdfs', async (req, res) => {
  try {
    const { date, card_key } = req.query;

    if (!date || !card_key) {
      return res.status(400).json({ error: 'Date and card_key parameters are required' });
    }

    // First get the PDF record to find the file path
    const pdfRecord = await queryCCTNS(
      'SELECT pdf_url FROM cctns_pdfs WHERE pdf_date = $1 AND card_key = $2',
      [date, card_key]
    );

    if (pdfRecord.rows.length === 0) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const pdfUrl = pdfRecord.rows[0].pdf_url;
    const filename = pdfUrl.split('/').pop();

    // Delete file from storage
    const filePath = path.join(WINDOWS_SERVER_CONFIG.uploadPath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('CCTNS: File deleted from storage:', filePath);
    }

    // Delete from database
    const result = await queryCCTNS(
      'DELETE FROM cctns_pdfs WHERE pdf_date = $1 AND card_key = $2 RETURNING *',
      [date, card_key]
    );

    console.log('CCTNS: PDF deleted successfully for card:', card_key, 'date:', date);
    res.json({ message: 'PDF deleted successfully', deleted: result.rows[0] });
  } catch (error) {
    console.error('CCTNS: Error deleting PDF:', error);
    res.status(500).json({ error: 'Failed to delete PDF', details: error.message });
  }
});

// Get latest date with data
router.get('/latest-date', async (req, res) => {
  try {
    const result = await queryCCTNS(
      'SELECT pdf_date FROM cctns_pdfs ORDER BY pdf_date DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.json({ pdf_date: null });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('CCTNS: Error fetching latest date:', error);
    res.status(500).json({ error: 'Failed to fetch latest date', details: error.message });
  }
});

// Get all available dates
router.get('/dates', async (req, res) => {
  try {
    const result = await queryCCTNS(
      'SELECT DISTINCT pdf_date FROM cctns_pdfs ORDER BY pdf_date DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('CCTNS: Error fetching dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates', details: error.message });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await queryCCTNS('SELECT 1');
    res.json({ status: 'healthy', message: 'CCTNS database connection is working' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', message: 'CCTNS database connection failed', details: error.message });
  }
});

module.exports = router;
