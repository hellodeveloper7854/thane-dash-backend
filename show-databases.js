const db = require('./db');

db.query('SHOW DATABASES', (err, results) => {
  if (err) {
    console.error('Error fetching databases:', err);
    return;
  }
  console.log('Databases:');
  results.forEach(db => console.log(db.Database));

  db.end();
});