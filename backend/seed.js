'use strict';
/**
 * Seed script — popula la BD con datos de ejemplo.
 * Ejecutar: npm run seed
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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
  ];
  for (const sql of statements) await pool.query(sql);
}

async function seed() {
  await initSchema();
  console.log('✅ Schema listo');

  // ── Limpiar todo ──────────────────────────────────────────────────────────
  await pool.query(`DELETE FROM fuel_transactions`);
  await pool.query(`DELETE FROM office_payments`);
  await pool.query(`DELETE FROM report_entries`);
  await pool.query(`DELETE FROM weekly_reports`);
  await pool.query(`DELETE FROM contractor_project_budgets`);
  await pool.query(`DELETE FROM contractors`);
  await pool.query(`DELETE FROM projects`);

  // ── Helper insert ─────────────────────────────────────────────────────────
  async function insProject(name, client_name, status) {
    const { rows } = await pool.query(
      `INSERT INTO projects (name, client_name, status) VALUES ($1, $2, $3) RETURNING id`,
      [name, client_name, status]
    );
    return rows[0].id;
  }

  async function insContractor(name) {
    const { rows } = await pool.query(
      `INSERT INTO contractors (name) VALUES ($1) RETURNING id`, [name]
    );
    return rows[0].id;
  }

  async function insBudget(contractor_id, project_id, valor_presupuesto) {
    await pool.query(
      `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto) VALUES ($1, $2, $3)`,
      [contractor_id, project_id, valor_presupuesto]
    );
  }

  async function insWeeklyReport(week_date) {
    const { rows } = await pool.query(
      `INSERT INTO weekly_reports (week_date) VALUES ($1) RETURNING id`, [week_date]
    );
    return rows[0].id;
  }

  async function insEntry(report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes = '') {
    await pool.query(
      `INSERT INTO report_entries (report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes]
    );
  }

  async function insOffice(report_id, person_name, amount) {
    await pool.query(
      `INSERT INTO office_payments (report_id, person_name, amount) VALUES ($1, $2, $3)`,
      [report_id, person_name, amount]
    );
  }

  // ── Proyectos ─────────────────────────────────────────────────────────────
  const P = {
    terreno:        await insProject('TERRENO',                    'Fernando Marroquin', 'active'),
    bocapalma:      await insProject('BOCAPALMA',                  'Fernando Marroquin', 'active'),
    barandales:     await insProject('BOCAPALMA BARANDALES',       null,                 'active'),
    banos:          await insProject('BOCAPALMA BAÑOS',            null,                 'active'),
    escalera:       await insProject('BOCAPALMA ESCALERA Y RAMPA', null,                 'active'),
    amacuzac:       await insProject('AMACUZAC',                   null,                 'active'),
    factores:       await insProject('FACTORES MUTUOS',            null,                 'active'),
    gomezMorin:     await insProject('LOCAL GOMEZ MORIN',          null,                 'active'),
    sierraDelValle: await insProject('SIERRA DEL VALLE',           null,                 'active'),
  };

  // ── Contratistas ──────────────────────────────────────────────────────────
  const C = {
    gildardo:     await insContractor('GILDARDO DE HOYOS'),
    arturo:       await insContractor('ARTURO LOPEZ'),
    temo:         await insContractor('CUAUHTEMOC SALAS'),
    joseDuran:    await insContractor('JOSE DURAN'),
    pedroYanez:   await insContractor('PEDRO YAÑEZ'),
    jorgeMtz:     await insContractor('JORGE MARTINEZ'),
    antonio:      await insContractor('ANTONIO GUTIERREZ'),
    rodo:         await insContractor('RODO ALEMAN'),
    luis:         await insContractor('LUIS OROPEZA'),
    jaime:        await insContractor('JAIME BAUTISTA'),
    guadalupe:    await insContractor('GUADALUPE MORENO'),
    joseLuis:     await insContractor('JOSE LUIS TORRES'),
    solatube:     await insContractor('SOLATUBE'),
    mosquiteros:  await insContractor('MOSQUITEROS'),
    mario:        await insContractor('MARIO CABALLERO'),
    genaroMtz:    await insContractor('GENARO MARTINEZ'),
    bernardo:     await insContractor('BERNARDO ZAMORA'),
    orlando:      await insContractor('ORLANDO TREJO'),
    maryTere:     await insContractor('MARY TERE'),
    ingCarlos:    await insContractor('ING CARLOS LUCIO'),
    control2000:  await insContractor('CONTROL 2000'),
    materialesSF: await insContractor('MATERIALES S.F.'),
  };

  // ── Presupuestos ──────────────────────────────────────────────────────────
  // TERRENO
  await insBudget(C.gildardo,  P.terreno,     180000);
  await insBudget(C.arturo,    P.terreno,     120000);
  await insBudget(C.temo,      P.terreno,      95000);
  await insBudget(C.joseDuran, P.terreno,      75000);
  await insBudget(C.orlando,   P.terreno,      60000);
  // BOCAPALMA
  await insBudget(C.pedroYanez, P.bocapalma,  200000);
  await insBudget(C.jorgeMtz,   P.bocapalma,  150000);
  await insBudget(C.antonio,    P.bocapalma,  130000);
  await insBudget(C.gildardo,   P.bocapalma,  110000);
  await insBudget(C.rodo,       P.bocapalma,   90000);
  // BARANDALES
  await insBudget(C.bernardo,  P.barandales,   85000);
  await insBudget(C.luis,      P.barandales,   60000);
  // BAÑOS
  await insBudget(C.jaime,     P.banos,        90000);
  await insBudget(C.guadalupe, P.banos,        70000);
  // ESCALERA Y RAMPA
  await insBudget(C.joseLuis,  P.escalera,    110000);
  await insBudget(C.mario,     P.escalera,     80000);
  // AMACUZAC
  await insBudget(C.genaroMtz, P.amacuzac,   160000);
  await insBudget(C.temo,      P.amacuzac,   120000);
  await insBudget(C.bernardo,  P.amacuzac,    95000);
  // FACTORES MUTUOS
  await insBudget(C.solatube,    P.factores,   45000);
  await insBudget(C.mosquiteros, P.factores,   35000);
  await insBudget(C.control2000, P.factores,   55000);
  // LOCAL GOMEZ MORIN
  await insBudget(C.maryTere,    P.gomezMorin,  80000);
  await insBudget(C.ingCarlos,   P.gomezMorin, 100000);
  await insBudget(C.materialesSF,P.gomezMorin,  65000);
  // SIERRA DEL VALLE
  await insBudget(C.temo,      P.sierraDelValle, 140000);
  await insBudget(C.joseDuran, P.sierraDelValle, 110000);
  await insBudget(C.arturo,    P.sierraDelValle,  90000);

  // ── Semana 1: 30 de abril 2026 ───────────────────────────────────────────
  const w1 = await insWeeklyReport('2026-04-30');
  // TERRENO
  await insEntry(w1, C.gildardo,  P.terreno,  45000, 15000);
  await insEntry(w1, C.arturo,    P.terreno,  30000, 10000);
  await insEntry(w1, C.temo,      P.terreno,  20000,  8000, '12 EFE 27 ABR');
  await insEntry(w1, C.joseDuran, P.terreno,  15000,  5000);
  await insEntry(w1, C.orlando,   P.terreno,  12000,  4000);
  // BOCAPALMA
  await insEntry(w1, C.pedroYanez, P.bocapalma, 65000, 20000);
  await insEntry(w1, C.jorgeMtz,   P.bocapalma, 50000, 15000);
  await insEntry(w1, C.antonio,    P.bocapalma, 40000, 12000);
  await insEntry(w1, C.gildardo,   P.bocapalma, 30000, 10000);
  await insEntry(w1, C.rodo,       P.bocapalma, 20000,  7000);
  // BARANDALES
  await insEntry(w1, C.bernardo, P.barandales, 25000, 8000);
  await insEntry(w1, C.luis,     P.barandales, 18000, 6000);
  // BAÑOS
  await insEntry(w1, C.jaime,     P.banos, 28000, 9000);
  await insEntry(w1, C.guadalupe, P.banos, 20000, 7000);
  // ESCALERA Y RAMPA
  await insEntry(w1, C.joseLuis, P.escalera, 35000, 12000);
  await insEntry(w1, C.mario,    P.escalera, 25000,  9000);
  // AMACUZAC
  await insEntry(w1, C.genaroMtz, P.amacuzac, 55000, 18000);
  await insEntry(w1, C.temo,      P.amacuzac, 40000, 14000);
  await insEntry(w1, C.bernardo,  P.amacuzac, 30000, 10000);
  // FACTORES MUTUOS
  await insEntry(w1, C.solatube,    P.factores, 12000, 4000);
  await insEntry(w1, C.mosquiteros, P.factores,  8000, 3000);
  await insEntry(w1, C.control2000, P.factores, 18000, 6000);
  // LOCAL GOMEZ MORIN
  await insEntry(w1, C.maryTere,    P.gomezMorin, 25000,  8000);
  await insEntry(w1, C.ingCarlos,   P.gomezMorin, 35000, 12000);
  await insEntry(w1, C.materialesSF,P.gomezMorin, 20000,  7000);
  // OFICINA
  await insOffice(w1, 'EMILIO',            12000);
  await insOffice(w1, 'ROLAND',             8000);
  await insOffice(w1, 'PEDRO YAÑEZ',        5000);
  await insOffice(w1, 'GILDARDO DE HOYOS',  4000);
  await insOffice(w1, 'TEMO',               6000);
  await insOffice(w1, 'LUIS OROPEZA',       3000);
  await insOffice(w1, 'GUADALUPE MORENO',   2500);
  await insOffice(w1, 'SRA VICKY',          3500);
  await insOffice(w1, 'ANTONIO GUTIERREZ',  2000);
  await insOffice(w1, 'BERNARDO ZAMORA',    2000);
  await insOffice(w1, 'MARIO CABALLERO',    2500);
  await insOffice(w1, 'GENARO MARTINEZ',    2000);
  await insOffice(w1, 'JOSE LUIS TORRES',   2000);
  await insOffice(w1, 'JOSE DURAN',         2000);
  await insOffice(w1, 'CONTENEDOR',        15000);

  // ── Semana 2: 08 de mayo 2026 ────────────────────────────────────────────
  const w2 = await insWeeklyReport('2026-05-08');
  // TERRENO
  await insEntry(w2, C.gildardo,  P.terreno,  60000, 18000);
  await insEntry(w2, C.arturo,    P.terreno,  40000, 12000);
  await insEntry(w2, C.temo,      P.terreno,  28000,  9000);
  await insEntry(w2, C.joseDuran, P.terreno,  20000,  6000);
  await insEntry(w2, C.orlando,   P.terreno,  16000,  5000);
  // BOCAPALMA
  await insEntry(w2, C.pedroYanez, P.bocapalma,  85000, 22000);
  await insEntry(w2, C.jorgeMtz,   P.bocapalma,  65000, 16000);
  await insEntry(w2, C.antonio,    P.bocapalma,  52000, 13000);
  await insEntry(w2, C.gildardo,   P.bocapalma,  40000, 11000);
  await insEntry(w2, C.rodo,       P.bocapalma,  27000,  8000);
  // BARANDALES
  await insEntry(w2, C.bernardo, P.barandales, 33000, 9000);
  await insEntry(w2, C.luis,     P.barandales, 24000, 7000);
  // BAÑOS
  await insEntry(w2, C.jaime,     P.banos, 37000, 10000);
  await insEntry(w2, C.guadalupe, P.banos, 27000,  8000);
  // ESCALERA Y RAMPA
  await insEntry(w2, C.joseLuis, P.escalera, 47000, 13000);
  await insEntry(w2, C.mario,    P.escalera, 34000, 10000);
  // AMACUZAC
  await insEntry(w2, C.genaroMtz, P.amacuzac, 73000, 20000);
  await insEntry(w2, C.temo,      P.amacuzac, 54000, 15000);
  await insEntry(w2, C.bernardo,  P.amacuzac, 40000, 12000);
  // FACTORES MUTUOS
  await insEntry(w2, C.solatube,    P.factores, 16000, 5000);
  await insEntry(w2, C.mosquiteros, P.factores, 11000, 4000);
  await insEntry(w2, C.control2000, P.factores, 24000, 7000);
  // LOCAL GOMEZ MORIN
  await insEntry(w2, C.maryTere,    P.gomezMorin, 33000,  9000);
  await insEntry(w2, C.ingCarlos,   P.gomezMorin, 47000, 13000);
  await insEntry(w2, C.materialesSF,P.gomezMorin, 27000,  8000);
  // SIERRA DEL VALLE
  await insEntry(w2, C.temo,      P.sierraDelValle, 0, 10000, 'Inicio de obra');
  await insEntry(w2, C.joseDuran, P.sierraDelValle, 0,  8000, 'Inicio de obra');
  await insEntry(w2, C.arturo,    P.sierraDelValle, 0,  7000, 'Inicio de obra');
  // OFICINA
  await insOffice(w2, 'EMILIO',            12000);
  await insOffice(w2, 'ROLAND',             8000);
  await insOffice(w2, 'PEDRO YAÑEZ',        5000);
  await insOffice(w2, 'GILDARDO DE HOYOS',  4000);
  await insOffice(w2, 'TEMO',               6000);
  await insOffice(w2, 'LUIS OROPEZA',       3000);
  await insOffice(w2, 'GUADALUPE MORENO',   2500);
  await insOffice(w2, 'SRA VICKY',          3500);
  await insOffice(w2, 'ANTONIO GUTIERREZ',  2000);
  await insOffice(w2, 'BERNARDO ZAMORA',    2000);
  await insOffice(w2, 'MARIO CABALLERO',    2500);
  await insOffice(w2, 'GENARO MARTINEZ',    2000);
  await insOffice(w2, 'JOSE LUIS TORRES',   2000);
  await insOffice(w2, 'JOSE DURAN',         2000);
  await insOffice(w2, 'CONTENEDOR',        15000);

  // ── Gasolinas / Caja ─────────────────────────────────────────────────────
  async function insFuel(date, type, amount, description = '') {
    await pool.query(
      `INSERT INTO fuel_transactions (date, type, amount, description) VALUES ($1, $2, $3, $4)`,
      [date, type, amount, description]
    );
  }
  await insFuel('2026-03-01', 'APORTACION',  30915, 'Aportación inicial marzo');
  await insFuel('2026-03-05', 'FACTURA_GAS',  3520, 'Factura gas — vehículo 1');
  await insFuel('2026-03-12', 'FACTURA_GAS',  4180, 'Factura gas — vehículo 2');
  await insFuel('2026-03-19', 'FACTURA_GAS',  3750, 'Factura gas — varios');
  await insFuel('2026-03-26', 'FACTURA_GAS',  4230, 'Factura gas — vehículo 1');
  await insFuel('2026-04-02', 'FACTURA_GAS',  3890, 'Factura gas — vehículo 2');
  await insFuel('2026-04-09', 'FACTURA_GAS',  4450, 'Factura gas — varios');
  await insFuel('2026-04-16', 'FACTURA_GAS',  5100, 'Factura gas — vehículo 1');
  await insFuel('2026-04-23', 'FACTURA_GAS',  4800, 'Factura gas — vehículo 2');
  await insFuel('2026-04-30', 'FACTURA_GAS',  5200, 'Factura gas — varios');
  await insFuel('2026-05-07', 'FACTURA_GAS',  4680, 'Factura gas — vehículo 1');
  await insFuel('2026-03-15', 'RETIRO',       15000, 'Retiro materiales obra');
  await insFuel('2026-03-28', 'RETIRO',       12000, 'Retiro herramientas');
  await insFuel('2026-04-10', 'RETIRO',       18000, 'Retiro gastos varios');
  await insFuel('2026-04-20', 'RETIRO',       20000, 'Retiro nómina');
  await insFuel('2026-04-27', 'RETIRO',       10000, 'Retiro caja');
  await insFuel('2026-05-05', 'RETIRO',       14300, 'Retiro gastos operativos');

  console.log('✅  Seed completado exitosamente');
  console.log(`   Proyectos:    ${Object.keys(P).length}`);
  console.log(`   Contratistas: ${Object.keys(C).length}`);
  console.log(`   Semanas:      2  (30 abr 2026 / 08 may 2026)`);

  await pool.end();
}

seed().catch(err => {
  console.error('❌  Seed falló:', err.message);
  process.exit(1);
});
