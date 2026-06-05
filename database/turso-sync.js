const fs = require('fs');
const { createClient } = require('@libsql/client');

async function run() {
  try {
    const tmpFile = process.argv[2];
    const url = process.argv[3];
    const authToken = process.argv[4];

    const data = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    const client = createClient({ url, authToken });

    let result = null;

    if (data.mode === 'all') {
      const rs = await client.execute({ sql: data.sql, args: data.params || [] });
      // Convert Row objects to plain objects
      result = rs.rows.map(row => {
        const obj = {};
        Object.keys(row).forEach(k => { obj[k] = row[k]; });
        return obj;
      });
    } else if (data.mode === 'get') {
      const rs = await client.execute({ sql: data.sql, args: data.params || [] });
      if (rs.rows.length > 0) {
        const row = rs.rows[0];
        result = {};
        Object.keys(row).forEach(k => { result[k] = row[k]; });
      } else {
        result = null;
      }
    } else if (data.mode === 'run') {
      const rs = await client.execute({ sql: data.sql, args: data.params || [] });
      result = {
        lastInsertRowid: rs.lastInsertRowid ? Number(rs.lastInsertRowid) : 0,
        changes: rs.rowsAffected || 0
      };
    }

    // Always output valid JSON — never "undefined"
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(err.message + '\n');
    process.exit(1);
  }
}

run();

