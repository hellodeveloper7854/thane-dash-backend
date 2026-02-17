const express = require('express');
const router = express.Router();
const { queryIGotELearning } = require('./db-igotlearning');
const { asyncHandler } = require('./errorHandler');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Windows Server Configuration
// Using existing IIS folder that's already configured and working
const WINDOWS_SERVER_CONFIG = {
  // For Windows network share, use UNC path format with IP address
  // Using existing IIS folder: C:\inetpub\wwwroot\thanedashboardassests
  // This folder is already accessible via: https://cpthanearchive.thanepolice.in
  //
  // IMPORTANT: You need to create a network share for the folder first!
  // See NETWORK_SHARE_SETUP_GUIDE.md for detailed instructions.
  //
  // After creating the network share, use: \\94.249.213.97\thanedashboardassests
  // Do NOT use the administrative share (C$) unless you have admin credentials
  uploadPath: process.env.WINDOWS_SERVER_PATH || path.join(__dirname, 'uploads', 'igotlearning'),

  // Public URL base path (this will be the URL to access files)
  // Using existing IIS virtual directory that's already configured
  publicUrlBase: process.env.WINDOWS_SERVER_URL || '/api/igotlearning/files',

  // Local fallback path (used when network share is not accessible)
  localFallbackPath: path.join(__dirname, 'uploads', 'igotlearning'),

  // Local fallback URL base (used when network share is not accessible)
  localFallbackUrlBase: '/api/igotlearning/files',

  // Server Details:
  // - IP Address: 94.249.213.97
  // - RDP Port: 2297
  // - Username: HOST-3016
  // - Password: 1KR9yx-5F4l8%3
  //
  // Configuration:
  // ✅ Using existing IIS folder: C:\inetpub\wwwroot\thanedashboardassests
  // ✅ Already accessible via: https://cpthanearchive.thanepolice.in
  // ✅ Test PDF working: https://cpthanearchive.thanepolice.in/test.pdf
  // ✅ IIS already configured with proper MIME types
  // ✅ Firewall already allows HTTPS (port 443)
  //
  // ⚠️ ACTION REQUIRED: Create network share on Windows server!
  // Run one of these scripts ON THE WINDOWS SERVER:
  //   - create-thanedashboardassests-share.ps1 (PowerShell - recommended)
  //   - create-thanedashboardassests-share.bat (Batch script)
  // Or follow manual setup in NETWORK_SHARE_SETUP_GUIDE.md
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

// Helper function to save file to local storage
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
        // Return the public URL
        const publicUrl = `${WINDOWS_SERVER_CONFIG.publicUrlBase}/${filename}`;
        resolve(publicUrl);
      }
    });
  });
};

// Alternative: Using smb-share package for proper Windows authentication
// Uncomment and use this if you need explicit Windows credentials
/*
const { SmbShare } = require('smb-share');

const saveToWindowsServerWithAuth = async (file, filename) => {
    const share = new SmbShare({
      serverName: 'your-server-name',
      shareName: 'igotlearning',
      domain: 'WORKGROUP', // or your domain
      username: process.env.WINDOWS_SERVER_USER,
      password: process.env.WINDOWS_SERVER_PASSWORD
    });

    const uploadPath = `/${filename}`;
    await share.putFile(uploadPath, file.buffer);

    return `${WINDOWS_SERVER_CONFIG.publicUrlBase}/${filename}`;
    
    // Send file
    res.sendFile(filePath);
  ));;

// Upload PDF and save metadata
router.post('/upload-pdf', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { card_key, pdf_date, uploaded_by } = req.body;

    if (!card_key || !pdf_date) {
      return res.status(400).json({ error: 'card_key and pdf_date are required' });
    }

    // Generate unique filename
    const cardTypeMap = {
      "old-i-got": "igotold",
      "new-i-got": "igotnew",
      "e-learning": "elearning",
      "e-learning-new-act": "elearningnewact",
      "police-training": "policetraining"
    };
    const cardType = cardTypeMap[card_key] || card_key;
    const filename = `${cardType}_${pdf_date}_${Date.now()}.pdf`;

    // Save file to Windows server
    const pdf_url = await saveToWindowsServer(req.file, filename);

    // Validate uploaded_by UUID - only pass valid UUIDs to database
    const validUploadedBy = uploaded_by && isValidUUID(uploaded_by) ? uploaded_by : null;

    // Save to database
    const result = await queryIGotELearning(
      `INSERT INTO i_got_e_learning_pdfs (card_key, pdf_url, pdf_date, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (card_key, pdf_date)
       DO UPDATE SET pdf_url = $2, uploaded_by = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [card_key, pdf_url, pdf_date, validUploadedBy]
    );

    console.log('IGotELearning: PDF uploaded to Windows server and metadata saved for card:', card_key, 'date:', pdf_date);
    res.json({ message: 'PDF uploaded successfully', pdf_url: pdf_url, data: result.rows[0] });
  ));;

// Get PDF data by date
router.get('/pdfs', asyncHandler(async (req, res) => {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const result = await queryIGotELearning(
      'SELECT card_key, pdf_url, pdf_date FROM i_got_e_learning_pdfs WHERE pdf_date = $1',
      [date]
    );

    res.json(result.rows);
  ));;

// Upsert PDF data (insert or update)
router.post('/pdfs', asyncHandler(async (req, res) => {
    const { card_key, pdf_url, pdf_date, uploaded_by } = req.body;

    if (!card_key || !pdf_url || !pdf_date) {
      return res.status(400).json({ error: 'card_key, pdf_url, and pdf_date are required' });
    }

    // Validate uploaded_by UUID - only pass valid UUIDs to database
    const validUploadedBy = uploaded_by && isValidUUID(uploaded_by) ? uploaded_by : null;

    const result = await queryIGotELearning(
      `INSERT INTO i_got_e_learning_pdfs (card_key, pdf_url, pdf_date, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (card_key, pdf_date)
       DO UPDATE SET pdf_url = $2, uploaded_by = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [card_key, pdf_url, pdf_date, validUploadedBy]
    );

    console.log('IGotELearning: PDF data upserted successfully for card:', card_key, 'date:', pdf_date);
    res.json(result.rows[0]);
  ));;

// Delete PDF data
router.delete('/pdfs', asyncHandler(async (req, res) => {
    const { card_key, pdf_date } = req.query;

    if (!card_key || !pdf_date) {
      return res.status(400).json({ error: 'card_key and pdf_date are required' });
    }

    const result = await queryIGotELearning(
      'DELETE FROM i_got_e_learning_pdfs WHERE card_key = $1 AND pdf_date = $2 RETURNING *',
      [card_key, pdf_date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No PDF data found for the specified card_key and date' });
    }

    console.log('IGotELearning: PDF data deleted successfully for card:', card_key, 'date:', pdf_date);
    res.json({ message: 'PDF data deleted successfully', deleted_record: result.rows[0] });
  ));;

// Initialize the police_training_data table if it doesn't exist
const initializePoliceTrainingTable = async () => {
    // Check if table exists and has the correct structure
    const tableCheck = await queryIGotELearning(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'police_training_data'
      );
    `);

    if (tableCheck.rows[0].exists) {
      // Check if id column exists
      const columnCheck = await queryIGotELearning(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'police_training_data'
          AND column_name = 'id'
        );
      `);

      if (!columnCheck.rows[0].exists) {
        // Table exists but doesn't have id column - need to recreate
        console.log('IGotELearning: Recreating police_training_data table with correct structure...');
        await queryIGotELearning(`DROP TABLE IF EXISTS police_training_data CASCADE`);
      }
    }

    await queryIGotELearning(`
      CREATE TABLE IF NOT EXISTS police_training_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        month_year VARCHAR(7) NOT NULL UNIQUE,
        training_data JSONB,
        uploaded_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure training_data column exists (for backwards compatibility)
      await queryIGotELearning(`
        ALTER TABLE police_training_data
        ADD COLUMN IF NOT EXISTS training_data JSONB
      `);
      console.log('IGotELearning: training_data column verified');
    } catch (alterError) {
      console.warn('IGotELearning: Could not add training_data column (may already exist):', alterError.message);
    }

    // Ensure uploaded_by column exists (for backwards compatibility)
      await queryIGotELearning(`
        ALTER TABLE police_training_data
        ADD COLUMN IF NOT EXISTS uploaded_by UUID
      `);
      console.log('IGotELearning: uploaded_by column verified');
    } catch (alterError) {
      console.warn('IGotELearning: Could not add uploaded_by column (may already exist):', alterError.message);
    }

    // Create index on month_year for faster queries
    await queryIGotELearning(`
      CREATE INDEX IF NOT EXISTS idx_police_training_data_month_year ON police_training_data(month_year)
    `);

    console.log('IGotELearning: Police Training table initialized successfully');

    const result = await queryIGotELearning(
      'SELECT id FROM police_training_data WHERE month_year = $1 LIMIT 1',
      [month_year]
    );

    res.json({ exists: result.rows.length > 0 });
  ));;

// Get police training data by month_year
router.get('/police-training', asyncHandler(async (req, res) => {
    const { month_year } = req.query;

    if (!month_year) {
      return res.status(400).json({ error: 'month_year parameter is required (format: YYYY-MM)' });
    }

    const result = await queryIGotELearning(
      'SELECT month_year, training_data FROM police_training_data WHERE month_year = $1',
      [month_year]
    );

    // Return data with empty array if no records found (not an error)
    if (result.rows.length === 0) {
      return res.json({
        month_year: month_year,
        training_data: []
      });
    }

    res.json(result.rows[0]);
  ));;

// Upsert police training data
router.post('/police-training', asyncHandler(async (req, res) => {
    const { month_year, training_data, uploaded_by } = req.body;

    if (!month_year || !training_data) {
      return res.status(400).json({ error: 'month_year and training_data are required' });
    }

    // Validate uploaded_by UUID - only pass valid UUIDs to database
    const validUploadedBy = uploaded_by && isValidUUID(uploaded_by) ? uploaded_by : null;

    const result = await queryIGotELearning(
      `INSERT INTO police_training_data (month_year, training_data, uploaded_by, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (month_year)
       DO UPDATE SET training_data = $2, uploaded_by = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [month_year, JSON.stringify(training_data), validUploadedBy]
    );

    console.log('IGotELearning: Police training data upserted successfully for month_year:', month_year);
    res.json(result.rows[0]);
  ));;

// Delete police training data
router.delete('/police-training', asyncHandler(async (req, res) => {
    const { month_year } = req.query;

    if (!month_year) {
      return res.status(400).json({ error: 'month_year parameter is required' });
    }

    const result = await queryIGotELearning(
      'DELETE FROM police_training_data WHERE month_year = $1 RETURNING *',
      [month_year]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified month_year' });
    }

    console.log('IGotELearning: Police training data deleted successfully for month_year:', month_year);
    res.json({ message: 'Police training data deleted successfully', deleted_record: result.rows[0] });
  ));;

module.exports = router;
