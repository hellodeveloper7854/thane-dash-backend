const { Pool } = require('pg');

// ATNT PostgreSQL Connection (using same database as other modules)
const poolATNT = new Pool({
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
poolATNT.on('connect', () => {
  console.log('ATNT: Connected to PostgreSQL database');
});

poolATNT.on('error', (err) => {
  console.error('ATNT: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryATNT = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolATNT.query(text, params);
    const duration = Date.now() - start;
    console.log('ATNT: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('ATNT: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientATNT = async () => {
  const client = await poolATNT.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  const timeout = setTimeout(() => {
    console.error('ATNT: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryATNT,
  getClientATNT,
  poolATNT
};
