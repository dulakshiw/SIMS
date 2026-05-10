const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'sims_db' });
    const [rows] = await conn.query('SHOW COLUMNS FROM inventory_items');
    console.log(JSON.stringify(rows, null, 2));
    await conn.end();
  } catch (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
})();
