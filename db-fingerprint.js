const { Pool } = require('pg');

// Fingerprint PostgreSQL Connection
const poolFingerprint = new Pool({
  host: process.env.PM_DB_HOST || '94.249.213.97',
  port: process.env.PM_DB_PORT || 5432,
  database: process.env.PM_DB_NAME || 'thanedashboard',
  user: process.env.PM_DB_USER || 'postgres',
  password: process.env.PM_DB_PASSWORD || 'thane123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
poolFingerprint.on('connect', () => {
  console.log('Fingerprint: Connected to PostgreSQL database');
});

poolFingerprint.on('error', (err) => {
  console.error('Fingerprint: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryFingerprint = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolFingerprint.query(text, params);
    const duration = Date.now() - start;
    console.log('Fingerprint: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Fingerprint: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientFingerprint = async () => {
  const client = await poolFingerprint.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('Fingerprint: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryFingerprint,
  getClientFingerprint,
  poolFingerprint
};
