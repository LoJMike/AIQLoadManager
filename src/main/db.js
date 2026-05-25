/**
 * db.js — SQLite using Node's built-in node:sqlite module
 *
 * node:sqlite ships with Node 22+ (stable in Node 23+, Node 24 used here).
 * Zero npm dependencies. Zero deprecation warnings. No compilation.
 *
 * API is a drop-in replacement — no other files need changes:
 *   db.exec(sql)              — run DDL (multi-statement, splits on ;)
 *   db.prepare(sql).run(...)  — INSERT / UPDATE / DELETE
 *   db.prepare(sql).get(...)  — SELECT first row → plain object | undefined
 *   db.prepare(sql).all(...)  — SELECT all rows  → plain object[]
 *
 * node:sqlite returns null-prototype objects; we convert them to plain
 * objects so they serialise correctly over Electron IPC.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Suppress the "experimental" warning on Node 22
// (Node 23+ and Node 24 don't emit it, but this is harmless)
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name === 'ExperimentalWarning' && w.message.includes('SQLite')) return;
  process.stderr.write(`${w.name}: ${w.message}\n`);
});

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  DatabaseSync = null;
}

/** Convert null-prototype object from node:sqlite to a plain JS object */
function toPlain(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.assign({}, obj);
}

class NodeSqliteDatabase {
  constructor(dbPath) {
    this.dbPath     = dbPath;
    this._stmtCache = new Map();   // sql → StatementSync (prepared once, reused forever)
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    // Enable WAL mode for better concurrent write performance
    this.db.exec('PRAGMA journal_mode = WAL');
  }

  /**
   * Run a synchronous transaction.
   * fn() is called inside BEGIN/COMMIT; any throw triggers ROLLBACK and re-throw.
   *
   * @param {() => void} fn
   */
  transaction(fn) {
    this.db.exec('BEGIN');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch (_) {}
      throw e;
    }
  }

  /**
   * Execute one or more SQL statements (DDL).
   * node:sqlite's exec() handles multiple statements natively.
   */
  exec(sql) {
    // Split on ; and run each — handles both single and multi-statement blocks
    const stmts = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of stmts) {
      try { this.db.exec(stmt + ';'); } catch (e) {
        // Ignore "already exists" errors from CREATE IF NOT EXISTS
        if (!e.message.includes('already exists')) {
          console.warn('[db] exec warning:', e.message.slice(0, 120));
        }
      }
    }
    return this;
  }

  /** Returns a statement object with run / get / all */
  prepare(sql) {
    // Lazily prepare and cache the statement — prepared once, reused on every call.
    const cache = this._stmtCache;
    const db    = this.db;
    const _stmt = () => {
      if (!cache.has(sql)) cache.set(sql, db.prepare(sql));
      return cache.get(sql);
    };

    return {
      // run() re-throws on failure so callers can detect write errors.
      // Callers that must never surface a write failure (e.g. usage recording)
      // wrap this in their own try/catch.
      run(...params) {
        const result = _stmt().run(...params);
        // node:sqlite returns { changes, lastInsertRowid }
        return { changes: result?.changes ?? 1, lastInsertRowid: result?.lastInsertRowid };
      },

      // Read methods keep the defensive fallback — a failed SELECT should not
      // crash the app; returning empty is safer than propagating.
      get(...params) {
        try {
          const row = _stmt().get(...params);
          return row ? toPlain(row) : undefined;
        } catch (e) {
          console.error('[db] get error:', e.message, '| SQL:', sql.slice(0, 80));
          return undefined;
        }
      },

      all(...params) {
        try {
          return _stmt().all(...params).map(toPlain);
        } catch (e) {
          console.error('[db] all error:', e.message, '| SQL:', sql.slice(0, 80));
          return [];
        }
      },
    };
  }
}

/**
 * In-memory fallback — used if node:sqlite is somehow unavailable.
 * Data is lost on restart, but the app stays functional.
 */
class MemoryDatabase {
  constructor() {
    this._data = {};
    console.warn('[db] node:sqlite unavailable — using in-memory fallback (data will not persist)');
  }
  exec()       { return this; }
  prepare()    { return { run: () => ({ changes: 0 }), get: () => undefined, all: () => [] }; }
}

/**
 * Open (or create) a database file.
 * Synchronous — node:sqlite has no async init.
 *
 * Usage:
 *   const db = openDatabase('/path/to/app.db');
 *   db.exec('CREATE TABLE IF NOT EXISTS …');
 */
function openDatabase(dbPath) {
  if (!DatabaseSync) {
    console.error('[db] node:sqlite not found. Requires Node 22+. Running in-memory.');
    return new MemoryDatabase();
  }
  try {
    const instance = new NodeSqliteDatabase(dbPath);
    console.log('[db] opened:', dbPath);
    return instance;
  } catch (e) {
    console.error('[db] failed to open database:', e.message);
    return new MemoryDatabase();
  }
}

module.exports = { openDatabase, NodeSqliteDatabase, MemoryDatabase };
