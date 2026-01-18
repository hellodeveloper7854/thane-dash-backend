const express = require('express');
const router = express.Router();
const { queryPortalLinks } = require('./db-portallinks');

// Initialize the useful_portal_links table if it doesn't exist
const initializeTable = async () => {
  try {
    await queryPortalLinks(`
      CREATE TABLE IF NOT EXISTS useful_portal_links (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        sr_no INTEGER NOT NULL UNIQUE,
        service VARCHAR(255) NOT NULL,
        department_agency VARCHAR(255) NOT NULL,
        website TEXT NOT NULL,
        email VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on sr_no for faster queries and ordering
    await queryPortalLinks(`
      CREATE INDEX IF NOT EXISTS idx_useful_portal_links_sr_no ON useful_portal_links(sr_no)
    `);

    console.log('PortalLinks: Table initialized successfully');
  } catch (error) {
    console.error('PortalLinks: Error initializing table:', error);
  }
};

// Initialize table on module load
initializeTable();

// Get all portal links ordered by sr_no
router.get('/links', async (req, res) => {
  try {
    const result = await queryPortalLinks(
      'SELECT * FROM useful_portal_links ORDER BY sr_no ASC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('PortalLinks: Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch portal links', details: error.message });
  }
});

// Get a single portal link by ID
router.get('/links/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryPortalLinks(
      'SELECT * FROM useful_portal_links WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal link not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('PortalLinks: Error fetching link:', error);
    res.status(500).json({ error: 'Failed to fetch portal link', details: error.message });
  }
});

// Create a new portal link
router.post('/links', async (req, res) => {
  try {
    const { sr_no, service, department_agency, website, email, description } = req.body;

    if (!sr_no || !service || !department_agency || !website || !description) {
      return res.status(400).json({
        error: 'Missing required fields: sr_no, service, department_agency, website, description'
      });
    }

    const result = await queryPortalLinks(
      `INSERT INTO useful_portal_links (sr_no, service, department_agency, website, email, description, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [sr_no, service, department_agency, website, email || null, description]
    );

    console.log('PortalLinks: Link created successfully with sr_no:', sr_no);
    res.status(201).json({ message: 'Portal link created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('PortalLinks: Error creating link:', error);

    // Handle unique constraint violation for sr_no
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A portal link with this serial number already exists' });
    }

    res.status(500).json({ error: 'Failed to create portal link', details: error.message });
  }
});

// Update a portal link
router.put('/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sr_no, service, department_agency, website, email, description } = req.body;

    if (!sr_no || !service || !department_agency || !website || !description) {
      return res.status(400).json({
        error: 'Missing required fields: sr_no, service, department_agency, website, description'
      });
    }

    const result = await queryPortalLinks(
      `UPDATE useful_portal_links
       SET sr_no = $1, service = $2, department_agency = $3, website = $4, email = $5, description = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [sr_no, service, department_agency, website, email || null, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal link not found' });
    }

    console.log('PortalLinks: Link updated successfully with id:', id);
    res.json({ message: 'Portal link updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('PortalLinks: Error updating link:', error);

    // Handle unique constraint violation for sr_no
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A portal link with this serial number already exists' });
    }

    res.status(500).json({ error: 'Failed to update portal link', details: error.message });
  }
});

// Delete a portal link
router.delete('/links/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryPortalLinks(
      'DELETE FROM useful_portal_links WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portal link not found' });
    }

    console.log('PortalLinks: Link deleted successfully with id:', id);
    res.json({ message: 'Portal link deleted successfully', deleted: result.rows[0] });
  } catch (error) {
    console.error('PortalLinks: Error deleting link:', error);
    res.status(500).json({ error: 'Failed to delete portal link', details: error.message });
  }
});

// Bulk insert portal links
router.post('/bulk-insert', async (req, res) => {
  try {
    const { links } = req.body;

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array is required and must be non-empty' });
    }

    const results = [];
    const errors = [];

    for (const link of links) {
      const { sr_no, service, department_agency, website, email, description } = link;

      if (!sr_no || !service || !department_agency || !website || !description) {
        errors.push({ link, error: 'Missing required fields' });
        continue;
      }

      try {
        const result = await queryPortalLinks(
          `INSERT INTO useful_portal_links (sr_no, service, department_agency, website, email, description, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (sr_no)
           DO UPDATE SET service = $2, department_agency = $3, website = $4, email = $5, description = $6, updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [sr_no, service, department_agency, website, email || null, description]
        );

        results.push(result.rows[0]);
      } catch (error) {
        errors.push({ link, error: error.message });
      }
    }

    console.log('PortalLinks: Bulk insert completed, success:', results.length, 'errors:', errors.length);
    res.json({
      message: 'Bulk insert completed',
      success: results.length,
      errors: errors.length,
      data: results,
      failed: errors
    });
  } catch (error) {
    console.error('PortalLinks: Error in bulk insert:', error);
    res.status(500).json({ error: 'Failed to complete bulk insert', details: error.message });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await queryPortalLinks('SELECT 1');
    res.json({ status: 'healthy', message: 'PortalLinks database connection is working' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', message: 'PortalLinks database connection failed', details: error.message });
  }
});

module.exports = router;
