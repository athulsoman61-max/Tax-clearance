/**
 * sqlite-shim.js
 * 
 * Thin compatibility layer that wraps node-sqlite3-wasm to provide
 * the same synchronous API as better-sqlite3.
 * 
 * Supports:
 *   db.prepare(sql).all(...params)
 *   db.prepare(sql).get(...params)
 *   db.prepare(sql).run(...params)  → returns { lastInsertRowid, changes }
 *   db.exec(sql)
 *   db.transaction(fn)
 */

const { Database: WasmDatabase } = require('node-sqlite3-wasm');

class Statement {
  constructor(wasmStmt, db) {
    this._stmt = wasmStmt;
    this._db = db;
  }

  /** Flatten spread args or single-array arg into a plain array */
  _params(args) {
    if (args.length === 0) return [];
    // If single array passed (e.g. .all(['a','b'])) use it directly
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    // Spread args — some may themselves be arrays, flatten one level
    return args.reduce((acc, a) => Array.isArray(a) ? acc.concat(a) : (acc.push(a), acc), []);
  }

  all(...args) {
    try {
      const result = this._stmt.all(this._params(args));
      return Array.isArray(result) ? result : [];
    } catch (e) {
      throw e;
    }
  }

  get(...args) {
    try {
      const result = this._stmt.get(this._params(args));
      return result || undefined;
    } catch (e) {
      throw e;
    }
  }

  run(...args) {
    try {
      this._stmt.run(this._params(args));
      return {
        lastInsertRowid: this._db._raw.lastInsertRowid,
        changes: this._db._raw.changes,
      };
    } catch (e) {
      throw e;
    }
  }
}

class Database {
  constructor(filePath) {
    this._raw = new WasmDatabase(filePath);
  }

  prepare(sql) {
    const stmt = this._raw.prepare(sql);
    return new Statement(stmt, this);
  }

  exec(sql) {
    this._raw.exec(sql);
    return this;
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._raw.exec('BEGIN');
      try {
        const result = fn.apply(this, args);
        self._raw.exec('COMMIT');
        return result;
      } catch (err) {
        try { self._raw.exec('ROLLBACK'); } catch {}
        throw err;
      }
    };
  }

  close() {
    this._raw.close();
  }
}

module.exports = Database;
