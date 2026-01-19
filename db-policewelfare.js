const { Pool } = require('pg');

// Police Welfare PostgreSQL Connection - using siddhihall database
const poolPoliceWelfare = new Pool({
  host: '94.249.213.97',
  port:  5432,
  database: 'siddhihall',
  user: 'postgres',
  password: 'thane123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
poolPoliceWelfare.on('connect', () => {
  console.log('PoliceWelfare: Connected to PostgreSQL database (siddhihall)');
});

poolPoliceWelfare.on('error', (err) => {
  console.error('PoliceWelfare: Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
const queryPoliceWelfare = async (text, params) => {
  const start = Date.now();
  try {
    const res = await poolPoliceWelfare.query(text, params);
    const duration = Date.now() - start;
    console.log('PoliceWelfare: Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('PoliceWelfare: Database query error', error);
    throw error;
  }
};

// Get a client from the pool for transactions
const getClientPoliceWelfare = async () => {
  const client = await poolPoliceWelfare.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  // Set a timeout for the client
  const timeout = setTimeout(() => {
    console.error('PoliceWelfare: A client has been checked out for too long.');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return client.release();
  };

  return { query, release };
};

module.exports = {
  queryPoliceWelfare,
  getClientPoliceWelfare,
  poolPoliceWelfare
};
