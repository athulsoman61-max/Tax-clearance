/**
 * database/db.js
 * 
 * Uses Turso (cloud SQLite) in production via TURSO_DATABASE_URL env var,
 * Falls back to local node-sqlite3-wasm for local development.
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// ─── Detect environment ─────────────────────────────────────────────────────
const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let db;

if (useTurso) {
  // ── Production: Turso cloud SQLite ────────────────────────────────────────
  const { createClient } = require('@libsql/client');
  const tursoClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Wrap Turso async client in a synchronous-style interface
  // using sync batch execution for compatibility with existing code
  db = {
    _client: tursoClient,
    _isTurso: true,

    prepare(sql) {
      return {
        _sql: sql,
        _client: tursoClient,

        all(...args) {
          const params = this._flatArgs(args);
          // Synchronous wrapper using shared result storage
          return runSync(this._client, this._sql, params, 'all');
        },
        get(...args) {
          const params = this._flatArgs(args);
          return runSync(this._client, this._sql, params, 'get');
        },
        run(...args) {
          const params = this._flatArgs(args);
          return runSync(this._client, this._sql, params, 'run');
        },
        _flatArgs(args) {
          if (args.length === 0) return [];
          if (args.length === 1 && Array.isArray(args[0])) return args[0];
          return args.reduce((a, v) => Array.isArray(v) ? a.concat(v) : (a.push(v), a), []);
        }
      };
    },

    exec(sql) {
      // Split multiple statements and run each
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        runSync(tursoClient, stmt, [], 'run');
      }
      return this;
    },

    transaction(fn) {
      return (...args) => {
        runSync(tursoClient, 'BEGIN', [], 'run');
        try {
          const result = fn(...args);
          runSync(tursoClient, 'COMMIT', [], 'run');
          return result;
        } catch (e) {
          try { runSync(tursoClient, 'ROLLBACK', [], 'run'); } catch {}
          throw e;
        }
      };
    }
  };

  console.log('🌐 Using Turso cloud database');

} else {
  // ── Development: local node-sqlite3-wasm ──────────────────────────────────
  const Database = require('./sqlite-shim');
  const DB_PATH = path.join(__dirname, 'taxclearance.db');
  db = new Database(DB_PATH);
  console.log('💾 Using local SQLite database');
}

// ─── Synchronous wrapper for Turso (uses Atomics + SharedArrayBuffer trick) ──
// Since node-sqlite3-wasm and better-sqlite3 are synchronous but Turso is async,
// we use a worker-thread approach for sync execution in production.
// For simplicity in this implementation, we use a blocking promise resolution.

let _workerData = null;

function runSync(client, sql, params, mode) {
  // Use synchronous-via-Atomics for Node.js ≥ 16
  const { execSync } = require('child_process');
  const tmpFile = path.join(require('os').tmpdir(), `tc_query_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  
  // Write query to temp file
  fs.writeFileSync(tmpFile, JSON.stringify({ sql, params, mode }));
  
  // Run a small sync child process
  const helperPath = path.join(__dirname, 'turso-sync.js');
  try {
    const result = execSync(
      `node "${helperPath}" "${tmpFile}" "${process.env.TURSO_DATABASE_URL}" "${process.env.TURSO_AUTH_TOKEN}"`,
      { timeout: 10000, encoding: 'utf8' }
    );
    fs.unlinkSync(tmpFile);
    return JSON.parse(result);
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch {}
    throw new Error(`DB query failed: ${e.message}`);
  }
}

module.exports = { db, useTurso };
