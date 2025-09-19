const mysql = require('mysql2');

require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE_LMS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to LMS MySQL:', err);
    return;
  }
  console.log('Connected to LMS MySQL database:', connection.config.database);
  connection.release();
});

module.exports = pool;