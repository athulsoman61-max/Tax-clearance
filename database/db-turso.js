/**
 * database/db-turso.js
 * Provides a unified async database interface.
 * Uses Turso (cloud) in production, local SQLite in development.
 */

const path = require('path');

const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let db;

if (useTurso) {
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  db = {
    async all(sql, params = []) {
      const rs = await client.execute({ sql, args: params });
      return rs.rows.map(row => Object.assign({}, row));
    },
    async get(sql, params = []) {
      const rs = await client.execute({ sql, args: params });
      return rs.rows.length > 0 ? Object.assign({}, rs.rows[0]) : undefined;
    },
    async run(sql, params = []) {
      const rs = await client.execute({ sql, args: params });
      return { lastInsertRowid: Number(rs.lastInsertRowid || 0), changes: rs.rowsAffected || 0 };
    },
    async exec(sql) {
      const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of stmts) {
        await client.execute(stmt);
      }
    }
  };

  console.log('🌐 Using Turso cloud database');

} else {
  const Database = require('./sqlite-shim');
  const DB_PATH = path.join(__dirname, 'taxclearance.db');
  const sqliteDb = new Database(DB_PATH);

  // Wrap sync SQLite in the same async interface
  db = {
    async all(sql, params = []) { return sqliteDb.prepare(sql).all(...params); },
    async get(sql, params = []) { return sqliteDb.prepare(sql).get(...params); },
    async run(sql, params = []) { return sqliteDb.prepare(sql).run(...params); },
    async exec(sql) { return sqliteDb.exec(sql); }
  };

  console.log('💾 Using local SQLite database');
}

module.exports = { db, useTurso };
