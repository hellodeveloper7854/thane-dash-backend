const { Pool } = require('pg');

// Portal Links PostgreSQL Connection
const poolPortalLinks = new Pool({
  host: process.env.PM_DB_HOST || '94.249.213.97',
  port: process.env.PM_DB_PORT || 5432,
  database: process.env.PM_DB_NAME || 'thanedashboard',
  user: process.env.PM_DB_USER || 'postgres',
  password: process.env.PM_DB_PASSWORD || 'thane123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});

// Test the connection
poolPortalLinks.on('connect', () => {
  console.log('PortalLinks: Connected to PostgreSQL database');
});

poolPortalLinks.on('error', (err) => {
  console.error('PortalLinks: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryPortalLinks = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolPortalLinks.query(text, params);
    const duration = Date.now() - start;
    console.log('PortalLinks: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('PortalLinks: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientPortalLinks = async () => {
  const client = await poolPortalLinks.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('PortalLinks: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryPortalLinks,
  getClientPortalLinks,
  poolPortalLinks
};
