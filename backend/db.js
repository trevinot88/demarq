'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'constructor.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const _db = new DatabaseSync(DB_PATH);
_db.exec('PRAGMA journal_mode = WAL');
_db.exec('PRAGMA foreign_keys = ON');

/**
 * Thin shim around node:sqlite's DatabaseSync to expose the same
 * synchronous API used throughout the routes (better-sqlite3 style).
 */
const db = {
  exec: (sql) => _db.exec(sql),

  prepare: (sql) => {
    const stmt = _db.prepare(sql);
    return {
      run:  (...args) => {
        const r = stmt.run(...args);
        return { lastInsertRowid: r.lastInsertRowid, changes: r.changes };
      },
      get:  (...args) => stmt.get(...args),
      all:  (...args) => stmt.all(...args),
    };
  },

  transaction: (fn) => () => {
    _db.exec('BEGIN');
    try { fn(); _db.exec('COMMIT'); }
    catch (e) { _db.exec('ROLLBACK'); throw e; }
  },
};

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    client_name TEXT,
    status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS contractors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS contractor_project_budgets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    contractor_id     INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    project_id        INTEGER NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
    valor_presupuesto REAL    NOT NULL DEFAULT 0,
    notes             TEXT    DEFAULT '',
    created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(contractor_id, project_id)
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    week_date  TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS report_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id     INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
    contractor_id INTEGER NOT NULL REFERENCES contractors(id),
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    ent_a_cta     REAL    NOT NULL DEFAULT 0,
    rep_a_cta     REAL    NOT NULL DEFAULT 0,
    notes         TEXT    DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(report_id, contractor_id, project_id)
  );

  CREATE TABLE IF NOT EXISTS office_payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id   INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
    person_name TEXT    NOT NULL,
    amount      REAL    NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS fuel_transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,
    type        TEXT    NOT NULL CHECK(type IN ('FACTURA_GAS','APORTACION','RETIRO')),
    amount      REAL    NOT NULL,
    description TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = db;
