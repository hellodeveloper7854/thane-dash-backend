const express = require('express');
const router = express.Router();
const { queryATNT } = require('./db-atnt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Windows Server Configuration - Same as IGotELearning
const WINDOWS_SERVER_CONFIG = {
  // Using existing IIS folder: C:\inetpub\wwwroot\thanedashboardassests
  uploadPath: process.env.WINDOWS_SERVER_PATH || path.join(__dirname, 'uploads', 'atnt'),

  // Public URL base path (accessible via IIS)
  publicUrlBase: process.env.WINDOWS_SERVER_URL || '/api/atnt/files',

  // Local fallback path
  localFallbackPath: path.join(__dirname, 'uploads', 'atnt'),

  // Local fallback URL base
  localFallbackUrlBase: '/api/atnt/files',
};

// Configure storage for image uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for images
  fileFilter: (req, file, cb) => {
    // Allow common image formats
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

// Helper function to save file to Windows server
const saveToWindowsServer = async (file, filename, subfolder = 'criminals') => {
  return new Promise((resolve, reject) => {
    const uploadPath = path.join(WINDOWS_SERVER_CONFIG.uploadPath, subfolder, filename);

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
        // Return the public URL with subfolder
        const publicUrl = `${WINDOWS_SERVER_CONFIG.publicUrlBase}/${subfolder}/${filename}`;
        resolve(publicUrl);
      }
    });
  });
};

// Initialize the criminal_images table if it doesn't exist
const initializeTable = async () => {
  try {
    // Check if table exists
    const checkResult = await queryATNT(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'criminal_images'
      );
    `);

    if (!checkResult.rows[0].exists) {
      // Table doesn't exist, create it
      await queryATNT(`
        CREATE TABLE criminal_images (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          image_name VARCHAR(255) NOT NULL,
          image_url TEXT NOT NULL,
          uploaded_by VARCHAR(255),
          upload_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('ATNT: Criminal images table created successfully');
    } else {
      console.log('ATNT: Criminal images table already exists');

      // Check if uploaded_by column exists and its type
      const columnCheck = await queryATNT(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'criminal_images'
        AND column_name = 'uploaded_by'
      `);

      if (columnCheck.rows.length > 0) {
        const dataType = columnCheck.rows[0].data_type;
        console.log('ATNT: uploaded_by column type:', dataType);

        // If it's uuid, we need to change it to varchar
        if (dataType === 'uuid') {
          console.log('ATNT: Changing uploaded_by from UUID to VARCHAR...');
          await queryATNT(`
            ALTER TABLE criminal_images
            ALTER COLUMN uploaded_by TYPE VARCHAR(255) USING 'unknown'
          `);
          console.log('ATNT: uploaded_by column changed to VARCHAR(255)');
        }
      }
    }

    // Create index on image_name for faster searches
    try {
      await queryATNT(`
        CREATE INDEX IF NOT EXISTS idx_criminal_images_name ON criminal_images(image_name)
      `);
      console.log('ATNT: Index on image_name created successfully');
    } catch (indexError) {
      console.warn('ATNT: Could not create index on image_name:', indexError.message);
    }

    console.log('ATNT: Criminal images table initialization completed');
  } catch (error) {
    console.error('ATNT: Error initializing table:', error);
  }
};

// Initialize ATNT data tables
const initializeDataTables = async () => {
  try {
    await queryATNT(`
      CREATE TABLE IF NOT EXISTS atnt_daily_summary (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        station_data JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add todays_mapped_data column if it doesn't exist
    try {
      await queryATNT(`
        ALTER TABLE atnt_daily_summary
        ADD COLUMN IF NOT EXISTS todays_mapped_data INTEGER DEFAULT 0
      `);
      console.log('ATNT: todays_mapped_data column added/verified');
    } catch (alterError) {
      console.warn('ATNT: Could not add todays_mapped_data column (may already exist):', alterError.message);
    }

    // Change created_by column type from UUID to VARCHAR if it's UUID
    try {
      // First, check if created_by column exists and its type
      const columnCheck = await queryATNT(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'atnt_daily_summary'
        AND column_name = 'created_by'
      `);

      if (columnCheck.rows.length > 0) {
        const dataType = columnCheck.rows[0].data_type;
        console.log('ATNT: created_by column type:', dataType);

        // If it's uuid, we need to change it to varchar
        if (dataType === 'uuid') {
          console.log('ATNT: Changing created_by from UUID to VARCHAR...');
          await queryATNT(`
            ALTER TABLE atnt_daily_summary
            ALTER COLUMN created_by TYPE VARCHAR(255) USING 'admin'
          `);
          console.log('ATNT: created_by column changed to VARCHAR(255)');
        }
      }
    } catch (alterError) {
      console.warn('ATNT: Could not change created_by column type:', alterError.message);
    }

    await queryATNT(`
      CREATE TABLE IF NOT EXISTS atnt_offense_summary (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        offense_data JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Change created_by column type from UUID to VARCHAR if it's UUID for offense_summary table
    try {
      const columnCheckOffense = await queryATNT(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'atnt_offense_summary'
        AND column_name = 'created_by'
      `);

      if (columnCheckOffense.rows.length > 0) {
        const dataType = columnCheckOffense.rows[0].data_type;
        console.log('ATNT: offense_summary created_by column type:', dataType);

        if (dataType === 'uuid') {
          console.log('ATNT: Changing offense_summary created_by from UUID to VARCHAR...');
          await queryATNT(`
            ALTER TABLE atnt_offense_summary
            ALTER COLUMN created_by TYPE VARCHAR(255) USING 'admin'
          `);
          console.log('ATNT: offense_summary created_by column changed to VARCHAR(255)');
        }
      }
    } catch (alterError) {
      console.warn('ATNT: Could not change offense_summary created_by column type:', alterError.message);
    }

    console.log('ATNT: Data tables initialized successfully');
  } catch (error) {
    console.error('ATNT: Error initializing data tables:', error);
  }
};

// Initialize tables on startup
initializeTable();
initializeDataTables();

// Serve static files from the uploads directory
router.use('/files', express.static(WINDOWS_SERVER_CONFIG.uploadPath));

// Upload criminal image
router.post('/upload-criminal-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname);
    const filename = `${date.replace(/-/g, '_')}_${timestamp}${ext}`;

    // Save file to Windows server
    const imageUrl = await saveToWindowsServer(req.file, filename, 'criminals');

    // Save to database
    const userStr = req.headers['x-user'] || 'unknown';
    const uploadedBy = typeof userStr === 'string' ? JSON.parse(decodeURIComponent(userStr)) : null;

    const result = await queryATNT(
      `INSERT INTO criminal_images (image_name, image_url, uploaded_by, upload_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [filename, imageUrl, uploadedBy?.username || 'unknown', date]
    );

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading criminal image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all criminal images
router.get('/criminal-images', async (req, res) => {
  try {
    const { date } = req.query;
    
    console.log('ATNT API: Fetching criminal images with query params:', { date });
    
    let query = 'SELECT * FROM criminal_images';
    let params = [];
    
    if (date) {
      query += ' WHERE upload_date = $1';
      params.push(date);
    }
    
    query += ' ORDER BY created_at DESC';
    
    console.log('ATNT API: Executing query:', query);
    console.log('ATNT API: Query params:', params);
    
    const result = await queryATNT(query, params);
    
    console.log('ATNT API: Found', result.rows.length, 'criminal images');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching criminal images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get criminal image by ID
router.get('/criminal-images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryATNT(
      'SELECT * FROM criminal_images WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching criminal image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete criminal image
router.delete('/criminal-images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get image details first
    const imageResult = await queryATNT(
      'SELECT * FROM criminal_images WHERE id = $1',
      [id]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageUrl = imageResult.rows[0].image_url;

    // Delete from database
    await queryATNT('DELETE FROM criminal_images WHERE id = $1', [id]);

    // Delete file from filesystem
    try {
      const filename = path.basename(imageUrl);
      const filePath = path.join(WINDOWS_SERVER_CONFIG.uploadPath, 'criminals', filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('File deleted successfully:', filePath);
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Don't fail the request if file deletion fails
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting criminal image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily summary for a specific date
router.get('/daily-summary/:date', async (req, res) => {
  try {
    const { date } = req.params;

    console.log('ATNT API: Fetching daily summary for date:', date);
    console.log('ATNT API: Date type:', typeof date);

    const result = await queryATNT(
      'SELECT id, date::text as date, station_data, created_by, created_at, updated_at, todays_mapped_data FROM atnt_daily_summary WHERE date = $1',
      [date]
    );

    console.log('ATNT API: Query result rows:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('ATNT API: Found data for date:', result.rows[0].date);
    }

    if (result.rows.length === 0) {
      console.log('ATNT API: No data found for date:', date);
      return res.json({ data: null });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('ATNT API: Error fetching daily summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upsert daily summary
router.post('/daily-summary', async (req, res) => {
  try {
    const { date, station_data, created_by } = req.body;

    console.log('ATNT API: Upserting daily summary for date:', date);
    console.log('ATNT API: Date type:', typeof date);
    console.log('ATNT API: Station data length:', station_data?.length);
    console.log('ATNT API: Created by:', created_by);

    let result;
    try {
      result = await queryATNT(
        `INSERT INTO atnt_daily_summary (date, station_data, created_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (date) DO UPDATE SET
           station_data = EXCLUDED.station_data,
           updated_at = NOW()
         RETURNING *`,
        [date, JSON.stringify(station_data), created_by]
      );
    } catch (insertError) {
      // If UUID error, try without created_by
      if (insertError.message && insertError.message.includes('uuid')) {
        console.warn('ATNT API: UUID error, retrying without created_by');
        result = await queryATNT(
          `INSERT INTO atnt_daily_summary (date, station_data)
           VALUES ($1, $2)
           ON CONFLICT (date) DO UPDATE SET
             station_data = EXCLUDED.station_data,
             updated_at = NOW()
           RETURNING *`,
          [date, JSON.stringify(station_data)]
        );
      } else {
        throw insertError;
      }
    }

    console.log('ATNT API: Upsert successful, stored date:', result.rows[0].date);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('ATNT API: Error upserting daily summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete daily summary
router.delete('/daily-summary/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const result = await queryATNT(
      'DELETE FROM atnt_daily_summary WHERE date = $1 RETURNING *',
      [date]
    );

    res.json({ message: 'Daily summary deleted successfully' });
  } catch (error) {
    console.error('Error deleting daily summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get offense summary for a specific date
router.get('/offense-summary/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const result = await queryATNT(
      'SELECT id, date::text as date, offense_data, created_by, created_at, updated_at FROM atnt_offense_summary WHERE date = $1',
      [date]
    );

    if (result.rows.length === 0) {
      return res.json({ data: null });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching offense summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upsert offense summary
router.post('/offense-summary', async (req, res) => {
  try {
    const { date, offense_data, created_by } = req.body;

    console.log('ATNT API: Upserting offense summary for date:', date);
    console.log('ATNT API: Offense data length:', offense_data?.length);
    console.log('ATNT API: Created by:', created_by);

    let result;
    try {
      result = await queryATNT(
        `INSERT INTO atnt_offense_summary (date, offense_data, created_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (date) DO UPDATE SET
           offense_data = EXCLUDED.offense_data,
           updated_at = NOW()
         RETURNING *`,
        [date, JSON.stringify(offense_data), created_by]
      );
    } catch (insertError) {
      // If UUID error, try without created_by
      if (insertError.message && insertError.message.includes('uuid')) {
        console.warn('ATNT API: UUID error, retrying offense without created_by');
        result = await queryATNT(
          `INSERT INTO atnt_offense_summary (date, offense_data)
           VALUES ($1, $2)
           ON CONFLICT (date) DO UPDATE SET
             offense_data = EXCLUDED.offense_data,
             updated_at = NOW()
           RETURNING *`,
          [date, JSON.stringify(offense_data)]
        );
      } else {
        throw insertError;
      }
    }

    console.log('ATNT API: Offense upsert successful');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('ATNT API: Error upserting offense summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete offense summary
router.delete('/offense-summary/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const result = await queryATNT(
      'DELETE FROM atnt_offense_summary WHERE date = $1 RETURNING *',
      [date]
    );

    res.json({ message: 'Offense summary deleted successfully' });
  } catch (error) {
    console.error('Error deleting offense summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get daily summary date range
router.get('/daily-summary/range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const result = await queryATNT(
      `SELECT date::text as date, station_data FROM atnt_daily_summary
       WHERE date >= $1 AND date <= $2
       ORDER BY date`,
      [startDate, endDate]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily summary range:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
