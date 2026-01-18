const { Pool } = require('pg');

// Police Mitra PostgreSQL Connection
const poolPoliceMitra = new Pool({
  host: process.env.POLICEMITRA_DB_HOST || '94.249.213.97',
  port: process.env.POLICEMITRA_DB_PORT || 5432,
  database: process.env.POLICEMITRA_DB_NAME || 'policemitra',
  user: process.env.POLICEMITRA_DB_USER || 'postgres',
  password: process.env.POLICEMITRA_DB_PASSWORD || 'thane123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
poolPoliceMitra.on('connect', () => {
  console.log('Police Mitra: Connected to PostgreSQL database');
});

poolPoliceMitra.on('error', (err) => {
  console.error('Police Mitra: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryPoliceMitra = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolPoliceMitra.query(text, params);
    const duration = Date.now() - start;
    console.log('Police Mitra: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Police Mitra: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientPoliceMitra = async () => {
  const client = await poolPoliceMitra.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('Police Mitra: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryPoliceMitra,
  getClientPoliceMitra,
  poolPoliceMitra
};
