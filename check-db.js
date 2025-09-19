const db = require('./db');

db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()', (err, tables) => {
  if (err) {
    console.error('Error fetching tables:', err);
    return;
  }
  console.log('Tables:');
  tables.forEach(table => console.log(table.TABLE_NAME));

  db.query('SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = DATABASE()', (err, triggers) => {
    if (err) {
      console.error('Error fetching triggers:', err);
      return;
    }
    console.log('\nTriggers:');
    triggers.forEach(trigger => console.log(trigger.TRIGGER_NAME));

    db.query('SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = DATABASE()', (err, routines) => {
      if (err) {
        console.error('Error fetching routines:', err);
        return;
      }
      console.log('\nRoutines (Functions/Procedures):');
      routines.forEach(routine => console.log(`${routine.ROUTINE_TYPE}: ${routine.ROUTINE_NAME}`));

      db.end();
    });
  });
});