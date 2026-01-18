const { Pool } = require('pg');

// Users Management PostgreSQL Connection
const poolUsers = new Pool({
  host: process.env.PM_DB_HOST || '94.249.213.97',
  port: process.env.PM_DB_PORT || 5432,
  database: process.env.PM_DB_NAME || 'thanedashboard',
  user: process.env.PM_DB_USER || 'postgres',
  password: process.env.PM_DB_PASSWORD || 'thane123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
poolUsers.on('connect', () => {
  console.log('Users Management: Connected to PostgreSQL database');
});

poolUsers.on('error', (err) => {
  console.error('Users Management: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryUsers = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolUsers.query(text, params);
    const duration = Date.now() - start;
    console.log('Users Management: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Users Management: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientUsers = async () => {
  const client = await poolUsers.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  const timeout = setTimeout(() => {
    console.error('Users Management: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryUsers,
  getClientUsers,
  poolUsers
};
