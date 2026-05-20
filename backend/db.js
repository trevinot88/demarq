'use strict';
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set — set it in .env for local development');
}

function normalizeRenderHost(host) {
  if (!host) return host;
  if (host.startsWith('dpg-') && !host.includes('.')) {
    const region = process.env.RENDER_REGION || 'oregon';
    return `${host}.${region}-postgres.render.com`;
  }
  return host;
}

function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    const originalHost = parsed.hostname || '';
    const normalizedHost = normalizeRenderHost(originalHost);

    if (normalizedHost !== originalHost) {
      parsed.hostname = normalizedHost;
      console.warn(`⚠️  DATABASE_URL host normalized to ${parsed.hostname}`);
    }

    return parsed.toString();
  } catch (_err) {
    // Fallback for malformed URLs that still contain host+path segments.
    const match = rawUrl.match(/@(dpg-[a-z0-9-]+)(?=[:/]|$)/i);
    if (match) {
      const normalizedHost = normalizeRenderHost(match[1]);
      if (normalizedHost !== match[1]) {
        const fixed = rawUrl.replace(match[1], normalizedHost);
        console.warn(`⚠️  DATABASE_URL host normalized to ${normalizedHost}`);
        return fixed;
      }
    }
    return rawUrl || null;
  }
}

function connectionStringFromPgEnv() {
  const host = normalizeRenderHost(process.env.PGHOST || '');
  const port = process.env.PGPORT || '5432';
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;

  if (!host || !database || !user || !password) return null;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL) || connectionStringFromPgEnv();

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const db = {
  pool,
  query: (sql, params = []) => pool.query(sql, params),
};

async function initSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      username    TEXT    NOT NULL,
      action      TEXT    NOT NULL,
      entity_type TEXT    NOT NULL,
      entity_id   INTEGER,
      entity_name TEXT,
      details     JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
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
    `CREATE TABLE IF NOT EXISTS contractor_project_extras (
      id            SERIAL PRIMARY KEY,
      contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
      project_id    INTEGER NOT NULL REFERENCES projects(id)    ON DELETE CASCADE,
      amount        REAL    NOT NULL DEFAULT 0,
      description   TEXT    NOT NULL DEFAULT '',
      date          DATE    NOT NULL DEFAULT CURRENT_DATE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_reports (
      id         SERIAL PRIMARY KEY,
      week_date  TEXT    NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS report_entries (
      id            SERIAL PRIMARY KEY,
      report_id     INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
      contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
      project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
    // Migrar restricciones de report_entries a ON DELETE CASCADE
    `DO $$ 
     BEGIN
       -- Drop old constraints if they exist without CASCADE
       IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_entries_contractor_id_fkey') THEN
         ALTER TABLE report_entries DROP CONSTRAINT report_entries_contractor_id_fkey;
       END IF;
       IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_entries_project_id_fkey') THEN
         ALTER TABLE report_entries DROP CONSTRAINT report_entries_project_id_fkey;
       END IF;
       -- Add new constraints with CASCADE
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_entries_contractor_id_fkey_cascade') THEN
         ALTER TABLE report_entries ADD CONSTRAINT report_entries_contractor_id_fkey_cascade 
           FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE CASCADE;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_entries_project_id_fkey_cascade') THEN
         ALTER TABLE report_entries ADD CONSTRAINT report_entries_project_id_fkey_cascade 
           FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
       END IF;
     END $$`,
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

  // Insertar usuarios por defecto si no existen
  await pool.query(`
    INSERT INTO users (username, password, role)
    VALUES ('demarq', '2026', 'admin')
    ON CONFLICT (username) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO users (username, password, role)
    VALUES ('Asistente', 'demarq2026', 'user')
    ON CONFLICT (username) DO NOTHING
  `);
}

// ── Schema initialization with retry ────────────────────────────────────────
if (!connectionString) {
  console.warn('⚠️  No valid DB connection settings found — DB disabled');
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
