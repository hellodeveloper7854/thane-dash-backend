const db = require('./db'); // SmartHQ
const dbLMS = require('./db_lms'); // LMS

const smarthqProcedures = [
  'GetDashboardCardData',
  'sp_GetDashBoardCardAttendence',
  'sp_GetCardDataLogin',
  'GetDailyLeaveReportDashboard',
  'GetDailyDutyInsightDashboard',
  'GetLeaveEmpByPostandGender',
  'GetEmpLocationByPostandGender'
];

const lmsProcedures = [
  'GetDashboardData',
  'GetLicenceQuery',
  'GetApplicationQuery',
  'GetShowCauseNotice',
  'GetPieChartsData'
];

function checkParams(dbConn, procedures, dbName) {
  procedures.forEach(proc => {
    // Check parameters
    dbConn.query(`SELECT parameter_name, parameter_mode, data_type, ordinal_position FROM information_schema.parameters WHERE specific_schema = DATABASE() AND specific_name = ? ORDER BY ordinal_position`, [proc], (err, results) => {
      if (err) {
        console.error(`Error fetching parameters for ${proc} in ${dbName}:`, err);
        return;
      }
      console.log(`\nParameters for ${proc} in ${dbName}:`);
      if (results.length === 0) {
        console.log('No parameters');
      } else {
        results.forEach(param => {
          console.log(`${param.ORDINAL_POSITION}: ${param.PARAMETER_MODE} ${param.PARAMETER_NAME || 'N/A'} ${param.DATA_TYPE}`);
        });
      }
    });

    // Show create procedure
    dbConn.query(`SHOW CREATE PROCEDURE ${proc}`, (err, results) => {
      if (err) {
        console.error(`Error fetching code for ${proc} in ${dbName}:`, err);
        return;
      }
      console.log(`\nCode for ${proc} in ${dbName}:`);
      console.log(results[0]['Create Procedure']);
    });
  });
}

checkParams(db, smarthqProcedures, 'SmartHQ (hqmangemntsystemprod)');
// checkParams(dbLMS, lmsProcedures, 'LMS (lmstest)');

// Close connections after a delay
setTimeout(() => {
  db.end();
  dbLMS.end();
}, 5000);