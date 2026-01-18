const express = require('express');
const axios = require('axios');

const cors = require('cors');

require('dotenv').config();

const db = require('./db'); // SmartHQ - uses DB_DATABASE_SMARTHQ
const dbLMS = require('./db_lms'); // LMS - uses DB_DATABASE_LMS

const app = express();

const PORT = process.env.PORT || 4000;

// PostgreSQL connections for Police Mitra, Senior Citizen, ATST, and IGotELearning
const policeMitraRoutes = require('./routes-policemitra');
const seniorCitizenRoutes = require('./routes-seniorcitizen');
const atstRoutes = require('./routes-atst');
const igotlearningRoutes = require('./routes-igotlearning');

// Enable CORS for all origins
app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running and connected to MySQL');
});

app.get('/databases', (req, res) => {
  db.query('SHOW DATABASES', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.get('/current-db', (req, res) => {
  db.query('SELECT DATABASE() as current_database', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ current_database: results[0].current_database });
  });
});

app.get('/tables', (req, res) => {
  db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.get('/triggers', (req, res) => {
  db.query('SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = DATABASE()', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// SmartHQ Endpoints - Uses DB_DATABASE_SMARTHQ (hqmangemntsystemprod)
app.get('/api/smarthq/dashboard', (req, res) => {
  db.query('CALL GetDashboardCardData(1)', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/smarthq/dashboard-card-determinants', (req, res) => {
  db.query('CALL sp_GetDashBoardCardAttendence(1)', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/smarthq/card-data-login', (req, res) => {
  console.log('Calling sp_GetCardDataLogin on SmartHQ database...');
  db.query('CALL sp_GetCardDataLogin(1)', (err, results) => {
    if (err) {
      console.error('sp_GetCardDataLogin error:', err);
      return res.status(500).json({
        error: err.message,
        code: err.code,
        sqlState: err.sqlState
      });
    }
    console.log('sp_GetCardDataLogin success');
    res.json(results);
  });
});

app.get('/api/smarthq/leave-report', (req, res) => {
  db.query('CALL GetDailyLeaveReportDashboard(1)', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/smarthq/daily-duty-insights', (req, res) => {
  db.query('CALL GetDailyDutyInsightDashboard(1)', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/smarthq/leave-employee-by-post-gender', (req, res) => {
  db.query('CALL GetLeaveEmpByPostandGender()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/smarthq/count-employee-location', (req, res) => {
  db.query('CALL GetEmpLocationByPostandGender()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// LMS Endpoints - Uses DB_DATABASE_LMS (lmstest)
app.get('/api/lms/dashboard', (req, res) => {
  dbLMS.query('CALL GetDashboardData()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/dashboard2', (req, res) => {
  const policeStationId = req.query.policeStationId;

  if (!policeStationId) {
    return res.status(400).json({ error: "policeStationId is required" });
  }

  dbLMS.query(
    `CALL sp_GetDashboardDataByPoliceStation(?)`,
    [policeStationId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // results[0] contains first resultset, results[1] second, etc.
      res.json(results);
    }
  );
});


app.get('/api/lms/pending-licenses', (req, res) => {
  dbLMS.query('CALL GetLicenceQuery()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/pending-applications', (req, res) => {
  dbLMS.query('CALL GetApplicationQuery()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/pending-notices', (req, res) => {
  dbLMS.query('CALL GetShowCauseNotice()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/piechart-data', (req, res) => {
  dbLMS.query('CALL GetPieChartsData()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/dashboard-by-police-station', (req, res) => {
  dbLMS.query('CALL LicenceWeaponMgtRpt()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/PoliceStationLicenceCancellationYearWiseRpt', (req, res) => {
  dbLMS.query('CALL PoliceStationIssuedAndCancelledYearWiseRpt()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get('/api/lms/licenses-by-year-type-status', (req, res) => {
  const { year, licenceTypeName, status } = req.query;

  // Validation
  if (!year || !licenceTypeName || !status) {
    return res.status(400).json({
      error: "year, licenceTypeName and status parameters are required"
    });
  }

  // Optional: normalize status
  const normalizedStatus = status.toUpperCase();
  if (!['ISSUED', 'CANCELLED'].includes(normalizedStatus)) {
    return res.status(400).json({
      error: "status must be either ISSUED or CANCELLED"
    });
  }

  dbLMS.query(
    // `CALL GetLicenceDetailsByYearTypeNameAndStatus(?, ?, ?)`,
    `CALL GetIssuedOrCancelledLicenceDetails(?, ?, ?)`,
    [year, licenceTypeName, normalizedStatus],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // MySQL procedures return nested arrays
      res.json(results[0]);
    }
  );
});


app.post('/api/lms/filtered-data', (req, res) => {
  const { cardIndex, categoryName } = req.body;

  if (!cardIndex || !categoryName) {
    return res.status(400).json({ error: "cardIndex and categoryName are required" });
  }

  dbLMS.query(
    'CALL LicenceWeaponMgtRpt_Filter(?, ?)',
    [cardIndex, categoryName],
    (err, results) => {
      if (err) {
        console.error("SQL Error:", err);
        return res.status(500).json({ error: err.message });
      }

      // results[0] contains SELECT output
      const output = results[0]?.[0] || {};
      res.json(output);
    }
  );
});


app.get('/api/lms/licenses-list-by-type', (req, res) => {
  const { type } = req.query;

  if (!type) {
    return res.status(400).json({ error: "type parameter is required" });
  }

  dbLMS.query(`CALL GetLicenceListByType(?)`, [type], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


app.get('/api/lms/licence-query-reports', (req, res) => {
  const { reportType } = req.query;

  if (!reportType) {
    return res.status(400).json({ error: "reportType parameter is required" });
  }

  dbLMS.query(`CALL sp_LicenceQueryReports(?)`, [reportType], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }

    res.json(results);
  });
});




app.get('/api/lms/pending-licenses-by-police-station', (req, res) => {
  dbLMS.query('CALL GetLicenceQueryByPoliceStation()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/pending-applications-by-police-station', (req, res) => {
  dbLMS.query('CALL GetApplicationQueryByPoliceStation()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/lms/pending-notices-by-police-station', (req, res) => {
  dbLMS.query('CALL GetShowCauseNoticeByPoliceStation()', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});




app.get('/api/lms/piechart-data-by-police-station', (req, res) => {
  const policeStationId = req.query.policeStationId;

  // Validate required parameter
  if (!policeStationId) {
    return res.status(400).json({ error: "policeStationId is required" });
  }

  // Call the stored procedure
  dbLMS.query(
    `CALL sp_GetPieChartsDataByPoliceStation(?)`,
    [policeStationId],
    (err, results) => {
      if (err) {
        console.error("Error executing sp_GetPieChartsDataByPoliceStation:", err);
        return res.status(500).json({ error: err.message });
      }

      // results[0] contains the main dataset (since your SP returns one combined resultset)
      res.json(results);
    }
  );
});


// WhatsApp Chatbot Data Proxy
app.get('/api/chatbot-data', async (req, res) => {
  try {
    const response = await axios.get('https://nirbhaythane.org/thane-admin/chatbot_data.php');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching chatbot data:', error);
    res.status(500).json({ error: 'Failed to fetch chatbot data' });
  }
});

// Police Welfare Dashboard Data Proxy
app.get('/api/welfare-dashboard', async (req, res) => {
  try {
    const response = await axios.get('https://dgtraining.in/Police_welfare_management/api/welfare-dashboard', {
      headers: {
        'X-Api-Key': "a52f700ff79ad08e39ef17812301ce04c0c6b288abc5bac23f1171328e6fe534"
      }
    });
    console.log('Welfare API response status:', response.status);
    console.log('Welfare API response data:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching welfare dashboard data:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch welfare dashboard data', details: error.message });
  }
});

// Police Mitra API Routes
app.use('/api/policemitra', policeMitraRoutes);

// Senior Citizen API Routes
app.use('/api/seniorcitizen', seniorCitizenRoutes);

// ATST API Routes
app.use('/api/atst', atstRoutes);

// IGotELearning API Routes
app.use('/api/igotlearning', igotlearningRoutes);
// Add more routes later

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});