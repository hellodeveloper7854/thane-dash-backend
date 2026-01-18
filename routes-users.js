const express = require('express');
const router = express.Router();
const { queryUsers } = require('./db-users');

// Get all users (excluding deleted ones)
router.get('/all', async (req, res) => {
  try {
    const result = await queryUsers(
      'SELECT user_id, username, user_type, viewer_access_level, viewer_region, viewer_division, viewer_zone, viewer_station, selected_modules, role, created_at, updated_at FROM users_management WHERE isdeleted = false ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await queryUsers(
      'SELECT * FROM users_management WHERE user_id = $1 AND isdeleted = false',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by username
router.get('/username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await queryUsers(
      'SELECT * FROM users_management WHERE username = $1 AND isdeleted = false',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user by username:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new user
router.post('/create', async (req, res) => {
  try {
    const {
      user_id,
      username,
      password,
      user_type,
      viewer_access_level,
      viewer_region,
      viewer_division,
      viewer_zone,
      viewer_station,
      selected_modules,
      role,
      created_by
    } = req.body;

    // Check if username already exists
    const existingUser = await queryUsers(
      'SELECT user_id FROM users_management WHERE username = $1',
      [username.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const result = await queryUsers(
      `INSERT INTO users_management (
        user_id, username, password, user_type, viewer_access_level,
        viewer_region, viewer_division, viewer_zone, viewer_station,
        selected_modules, role, created_by, isdeleted, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW(), NOW())
      RETURNING *`,
      [
        user_id,
        username.toLowerCase(),
        password,
        user_type,
        viewer_access_level || null,
        viewer_region || null,
        viewer_division || null,
        viewer_zone || null,
        viewer_station || null,
        selected_modules || [], // Send as JSON array directly
        role,
        created_by
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      user_type,
      viewer_access_level,
      viewer_region,
      viewer_division,
      viewer_zone,
      viewer_station,
      selected_modules,
      role
    } = req.body;

    const result = await queryUsers(
      `UPDATE users_management SET
        user_type = $1,
        viewer_access_level = $2,
        viewer_region = $3,
        viewer_division = $4,
        viewer_zone = $5,
        viewer_station = $6,
        selected_modules = $7,
        role = $8,
        updated_at = NOW()
      WHERE user_id = $9
      RETURNING *`,
      [
        user_type,
        viewer_access_level || null,
        viewer_region || null,
        viewer_division || null,
        viewer_zone || null,
        viewer_station || null,
        selected_modules || [], // Send as JSON array directly
        role,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user password
router.put('/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    const result = await queryUsers(
      'UPDATE users_management SET password = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [password, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user permissions
router.put('/:userId/permissions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { selected_modules, user_type } = req.body;

    const result = await queryUsers(
      `UPDATE users_management SET
        selected_modules = $1,
        user_type = COALESCE($2, user_type),
        updated_at = NOW()
      WHERE user_id = $3
      RETURNING *`,
      [selected_modules || [], user_type, userId] // Send as JSON array directly
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user (soft delete)
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await queryUsers(
      'UPDATE users_management SET isdeleted = true, updated_at = NOW() WHERE user_id = $1 RETURNING *',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify user credentials (for login)
router.post('/verify', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await queryUsers(
      'SELECT * FROM users_management WHERE username = $1 AND password = $2 AND isdeleted = false',
      [username.toLowerCase(), password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error verifying credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users with tracking data
router.get('/tracking/all', async (req, res) => {
  try {
    const result = await queryUsers(
      `SELECT user_id, username, role, is_online, last_seen, created_at
       FROM users_management
       WHERE isdeleted = false
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get login count for a user in date range
router.get('/:userId/login-count', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    let query = 'SELECT COUNT(*) as count FROM user_login_logs WHERE user_id = $1 AND event_type = \'login\'';
    const params = [userId];

    if (startDate) {
      query += ' AND created_at >= $2';
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    const result = await queryUsers(query, params);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (error) {
    console.error('Error fetching login count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get last login for a user
router.get('/:userId/last-login', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await queryUsers(
      'SELECT created_at FROM user_login_logs WHERE user_id = $1 AND event_type = \'login\' ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ lastLogin: null });
    }

    res.json({ lastLogin: result.rows[0].created_at });
  } catch (error) {
    console.error('Error fetching last login:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all login logs for a user in date range
router.get('/:userId/login-logs', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    let query = 'SELECT * FROM user_login_logs WHERE user_id = $1';
    const params = [userId];

    if (startDate) {
      query += ' AND created_at >= $2';
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC';

    const result = await queryUsers(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user online status
router.put('/:userId/online-status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isOnline } = req.body;

    const result = await queryUsers(
      'UPDATE users_management SET is_online = $1, last_seen = NOW() WHERE user_id = $2 RETURNING *',
      [isOnline, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log user login event
router.post('/login-log', async (req, res) => {
  try {
    const { user_id, username, event_type, ip_address, user_agent, session_id } = req.body;

    const result = await queryUsers(
      `INSERT INTO user_login_logs (user_id, username, event_type, ip_address, user_agent, session_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [user_id, username, event_type || 'login', ip_address || null, user_agent || null, session_id || null]
    );

    // Also update user's online status
    await queryUsers(
      'UPDATE users_management SET is_online = true, last_seen = NOW() WHERE user_id = $1',
      [user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error logging login event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log user logout event
router.post('/logout-log', async (req, res) => {
  try {
    const { user_id, username, session_id } = req.body;

    const result = await queryUsers(
      `INSERT INTO user_login_logs (user_id, username, event_type, session_id, created_at)
       VALUES ($1, $2, 'logout', $3, NOW())
       RETURNING *`,
      [user_id, username, session_id || null]
    );

    // Update user's online status
    await queryUsers(
      'UPDATE users_management SET is_online = false, last_seen = NOW() WHERE user_id = $1',
      [user_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error logging logout event:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
