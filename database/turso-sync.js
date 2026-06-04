const fs = require('fs');
const { createClient } = require('@libsql/client');

async function run() {
  try {
    const tmpFile = process.argv[2];
    const url = process.argv[3];
    const authToken = process.argv[4];

    const data = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    
    const client = createClient({ url, authToken });
    
    let result;
    if (data.mode === 'all') {
      const rs = await client.execute({ sql: data.sql, args: data.params });
      result = rs.rows;
    } else if (data.mode === 'get') {
      const rs = await client.execute({ sql: data.sql, args: data.params });
      result = rs.rows[0] || undefined;
    } else if (data.mode === 'run') {
      const rs = await client.execute({ sql: data.sql, args: data.params });
      result = { lastInsertRowid: rs.lastInsertRowid ? Number(rs.lastInsertRowid) : 0, changes: rs.rowsAffected };
    }
    
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

run();
