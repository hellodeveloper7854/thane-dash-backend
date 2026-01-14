const { Pool } = require('pg');

// Senior Citizen PostgreSQL Connection
const poolSeniorCitizen = new Pool({
  host: process.env.SC_DB_HOST || '94.249.213.97',
  port: process.env.SC_DB_PORT || 5432,
  database: process.env.SC_DB_NAME || 'seniorcitizen',
  user: process.env.SC_DB_USER || 'postgres',
  password: process.env.SC_DB_PASSWORD || 'thane123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
poolSeniorCitizen.on('connect', () => {
  console.log('Senior Citizen: Connected to PostgreSQL database');
});

poolSeniorCitizen.on('error', (err) => {
  console.error('Senior Citizen: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const querySeniorCitizen = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolSeniorCitizen.query(text, params);
    const duration = Date.now() - start;
    console.log('Senior Citizen: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Senior Citizen: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientSeniorCitizen = async () => {
  const client = await poolSeniorCitizen.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('Senior Citizen: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  querySeniorCitizen,
  getClientSeniorCitizen,
  poolSeniorCitizen
};
