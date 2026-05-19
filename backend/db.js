'use strict';
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set — set it in .env for local development');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const db = {
  pool,
  query: (sql, params = []) => pool.query(sql, params),
};

async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS projects (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL,
      client_name TEXT,
      status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS contractors (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS contractor_project_budgets (
      id                SERIAL PRIMARY KEY,
      contractor_id     INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
      project_id        INTEGER NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
      valor_presupuesto REAL    NOT NULL DEFAULT 0,
      notes             TEXT    DEFAULT '',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(contractor_id, project_id)
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_reports (
      id         SERIAL PRIMARY KEY,
      week_date  TEXT    NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS report_entries (
      id            SERIAL PRIMARY KEY,
      report_id     INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
      contractor_id INTEGER NOT NULL REFERENCES contractors(id),
      project_id    INTEGER NOT NULL REFERENCES projects(id),
      ent_a_cta     REAL    NOT NULL DEFAULT 0,
      rep_a_cta     REAL    NOT NULL DEFAULT 0,
      notes         TEXT    DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(report_id, contractor_id, project_id)
    )`,
    `CREATE TABLE IF NOT EXISTS office_payments (
      id          SERIAL PRIMARY KEY,
      report_id   INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
      person_name TEXT    NOT NULL,
      amount      REAL    NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS fuel_transactions (
      id          SERIAL PRIMARY KEY,
      date        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('FACTURA_GAS','APORTACION','RETIRO')),
      amount      REAL    NOT NULL,
      description TEXT    DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // vp = valor pendiente (saldo al inicio de la semana)
    `ALTER TABLE report_entries ADD COLUMN IF NOT EXISTS vp REAL NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS advancement_reports (
      id               SERIAL PRIMARY KEY,
      project_id       INTEGER NOT NULL REFERENCES projects(id)     ON DELETE CASCADE,
      contractor_id    INTEGER NOT NULL REFERENCES contractors(id)  ON DELETE CASCADE,
      amount_reported  REAL    NOT NULL DEFAULT 0,
      amount_accepted  REAL,
      description      TEXT    DEFAULT '',
      status           TEXT    NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending','accepted','rejected')),
      report_date      DATE    NOT NULL DEFAULT CURRENT_DATE,
      accepted_date    DATE,
      weekly_report_id INTEGER REFERENCES weekly_reports(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }
}

// ── Schema initialization with retry ────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set — DB disabled (set it in .env)');
} else {
  const RETRY_ATTEMPTS = 15;
  const RETRY_DELAY_MS = 4000;

  (async () => {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        await initSchema();
        console.log('✅ DB schema ready');
        return;
      } catch (err) {
        console.error(`DB init attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${err.message}`);
        if (attempt < RETRY_ATTEMPTS) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        } else {
          console.error('DB init failed after all retries, exiting');
          process.exit(1);
        }
      }
    }
  })();
}

module.exports = db;
