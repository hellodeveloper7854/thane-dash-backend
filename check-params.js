const db = require('./db');

const procedureName = 'GetDashboardCardData';

db.query(`SELECT parameter_name, parameter_mode, data_type, ordinal_position FROM information_schema.parameters WHERE specific_schema = DATABASE() AND specific_name = ? ORDER BY ordinal_position`, [procedureName], (err, results) => {
  if (err) {
    console.error('Error fetching parameters:', err);
    return;
  }
  console.log(`Parameters for procedure ${procedureName}:`);
  results.forEach(param => {
    console.log(`${param.ORDINAL_POSITION}: ${param.PARAMETER_MODE} ${param.PARAMETER_NAME} ${param.DATA_TYPE}`);
  });

  db.end();
});