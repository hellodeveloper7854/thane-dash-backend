const { Pool } = require('pg');

// Emergency112 PostgreSQL Connection
const poolEmergency112 = new Pool({
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
poolEmergency112.on('connect', () => {
  console.log('Emergency112: Connected to PostgreSQL database');
});

poolEmergency112.on('error', (err) => {
  console.error('Emergency112: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryEmergency112 = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolEmergency112.query(text, params);
    const duration = Date.now() - start;
    console.log('Emergency112: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Emergency112: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientEmergency112 = async () => {
  const client = await poolEmergency112.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('Emergency112: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryEmergency112,
  getClientEmergency112,
  poolEmergency112
};
