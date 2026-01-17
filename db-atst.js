const { Pool } = require('pg');

// ATST PostgreSQL Connection
const poolATST = new Pool({
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
poolATST.on('connect', () => {
  console.log('ATST: Connected to PostgreSQL database');
});

poolATST.on('error', (err) => {
  console.error('ATST: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryATST = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolATST.query(text, params);
    const duration = Date.now() - start;
    console.log('ATST: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('ATST: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientATST = async () => {
  const client = await poolATST.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('ATST: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryATST,
  getClientATST,
  poolATST
};
