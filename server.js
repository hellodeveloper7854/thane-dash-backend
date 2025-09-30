const express = require('express');
const axios = require('axios');

const cors = require('cors');

require('dotenv').config();

const db = require('./db'); // SmartHQ - uses DB_DATABASE_SMARTHQ
const dbLMS = require('./db_lms'); // LMS - uses DB_DATABASE_LMS

const app = express();

const PORT = process.env.PORT || 4000;

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

// Add more routes later

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});