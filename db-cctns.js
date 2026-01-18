const { Pool } = require('pg');

// CCTNS PostgreSQL Connection
const poolCCTNS = new Pool({
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
poolCCTNS.on('connect', () => {
  console.log('CCTNS: Connected to PostgreSQL database');
});

poolCCTNS.on('error', (err) => {
  console.error('CCTNS: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryCCTNS = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolCCTNS.query(text, params);
    const duration = Date.now() - start;
    console.log('CCTNS: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('CCTNS: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientCCTNS = async () => {
  const client = await poolCCTNS.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('CCTNS: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryCCTNS,
  getClientCCTNS,
  poolCCTNS
};
