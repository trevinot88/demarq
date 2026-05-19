'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initSchema() {
  const s = [
    `CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, name TEXT NOT NULL, client_name TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS contractors (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS contractor_project_budgets (id SERIAL PRIMARY KEY, contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, valor_presupuesto REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(contractor_id, project_id))`,
    `CREATE TABLE IF NOT EXISTS weekly_reports (id SERIAL PRIMARY KEY, week_date TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS report_entries (id SERIAL PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE, contractor_id INTEGER NOT NULL REFERENCES contractors(id), project_id INTEGER NOT NULL REFERENCES projects(id), vp REAL NOT NULL DEFAULT 0, ent_a_cta REAL NOT NULL DEFAULT 0, rep_a_cta REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(report_id, contractor_id, project_id))`,
    `ALTER TABLE report_entries ADD COLUMN IF NOT EXISTS vp REAL NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS office_payments (id SERIAL PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE, person_name TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS fuel_transactions (id SERIAL PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('FACTURA_GAS','APORTACION','RETIRO')), amount REAL NOT NULL, description TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS advancement_reports (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE, amount_reported REAL NOT NULL DEFAULT 0, amount_accepted REAL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')), report_date DATE NOT NULL DEFAULT CURRENT_DATE, accepted_date DATE, weekly_report_id INTEGER REFERENCES weekly_reports(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  ];
  for (const q of s) await pool.query(q);
}

async function seed() {
  await initSchema();

  // Limpiar datos anteriores
  await pool.query('DELETE FROM advancement_reports');
  await pool.query('DELETE FROM fuel_transactions');
  await pool.query('DELETE FROM office_payments');
  await pool.query('DELETE FROM report_entries');
  await pool.query('DELETE FROM weekly_reports');
  await pool.query('DELETE FROM contractor_project_budgets');
  await pool.query('DELETE FROM contractors');
  await pool.query('DELETE FROM projects');

  // Helpers
  async function insProject(name, client, status = 'active') {
    const { rows } = await pool.query(
      `INSERT INTO projects (name,client_name,status) VALUES ($1,$2,$3) RETURNING id`,
      [name, client, status]
    );
    return rows[0].id;
  }
  async function insCont(name) {
    const { rows } = await pool.query(
      `INSERT INTO contractors (name) VALUES ($1) RETURNING id`,
      [name]
    );
    return rows[0].id;
  }
  async function insBudget(cid, pid, val) {
    await pool.query(
      `INSERT INTO contractor_project_budgets (contractor_id,project_id,valor_presupuesto) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [cid, pid, val]
    );
  }
  async function insWeek(week_date) {
    const { rows } = await pool.query(
      `INSERT INTO weekly_reports (week_date) VALUES ($1) RETURNING id`,
      [week_date]
    );
    return rows[0].id;
  }
  async function insEntry(rid, cid, pid, vp, ent, rep, notes = '') {
    await pool.query(
      `INSERT INTO report_entries (report_id,contractor_id,project_id,vp,ent_a_cta,rep_a_cta,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [rid, cid, pid, vp, ent, rep, notes]
    );
  }
  async function insOffice(rid, name, amount) {
    await pool.query(
      `INSERT INTO office_payments (report_id,person_name,amount) VALUES ($1,$2,$3)`,
      [rid, name, amount]
    );
  }
  async function insFuel(date, type, amount, desc = '') {
    await pool.query(
      `INSERT INTO fuel_transactions (date,type,amount,description) VALUES ($1,$2,$3,$4)`,
      [date, type, amount, desc]
    );
  }
  async function insAR(pid, cid, amount_rep, desc, date, status, amount_acc = null) {
    const acc_date = status === 'accepted' ? date : null;
    await pool.query(
      `INSERT INTO advancement_reports (project_id,contractor_id,amount_reported,description,report_date,status,amount_accepted,accepted_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [pid, cid, amount_rep, desc, date, status, amount_acc, acc_date]
    );
  }

  // ── PROYECTOS ──────────────────────────────────────────────────────────
  const P = {
    terreno:    await insProject('TERRENO',                    'Fernando Marroquin'),
    bocapalma:  await insProject('BOCAPALMA',                  'Fernando Marroquin'),
    barandales: await insProject('BOCAPALMA BARANDALES',       'Fernando Marroquin'),
    banos:      await insProject('BOCAPALMA BANOS',            'Fernando Marroquin'),
    escalera:   await insProject('BOCAPALMA ESCALERA Y RAMPA', 'Fernando Marroquin'),
    amacuzac:   await insProject('AMACUZAC',                   null),
    factores:   await insProject('FACTORES MUTUOS',            null),
    gomezMorin: await insProject('LOCAL GOMEZ MORIN',          null),
    sierra:     await insProject('SIERRA DEL VALLE',           null),
  };

  // ── CONTRATISTAS ───────────────────────────────────────────────────────
  const C = {
    gildardo:    await insCont('GILDARDO DE HOYOS'),
    temo:        await insCont('CUAUHTEMOC SALAS'),
    arturo:      await insCont('ARTURO LOPEZ'),
    jorgeMtz:    await insCont('JORGE MARTINEZ'),
    joseDuran:   await insCont('JOSE DURAN'),
    pedroYanez:  await insCont('PEDRO YANEZ'),
    genaroMtz:   await insCont('GENARO MARTINEZ'),
    antonio:     await insCont('ANTONIO GUTIERREZ'),
    rodo:        await insCont('RODO ALEMAN'),
    luis:        await insCont('LUIS OROPEZA'),
    mario:       await insCont('MARIO CABALLERO'),
    bernardo:    await insCont('BERNARDO ZAMORA'),
    guadalupe:   await insCont('GUADALUPE MORENO'),
    orlando:     await insCont('ORLANDO TREJO'),
    jaime:       await insCont('JAIME BAUTISTA'),
    joseLuis:    await insCont('JOSE LUIS TORRES'),
    maryTere:    await insCont('MARY TERE'),
    sraVicky:    await insCont('SRA VICKY'),
    solatube:    await insCont('SOLATUBE'),
    mosquiteros: await insCont('MOSQUITEROS'),
    control2000: await insCont('CONTROL 2000'),
    ingCarlos:   await insCont('ING CARLOS LUCIO'),
    materialesSF:await insCont('MATERIALES S.F.'),
  };

  // ── PRESUPUESTOS ───────────────────────────────────────────────────────
  // TERRENO
  await insBudget(C.gildardo,    P.terreno,    180000);
  // BOCAPALMA
  await insBudget(C.gildardo,    P.bocapalma,  120000);
  await insBudget(C.jorgeMtz,    P.bocapalma,  500000);
  await insBudget(C.arturo,      P.bocapalma,  200000);
  await insBudget(C.antonio,     P.bocapalma,  280000);
  await insBudget(C.rodo,        P.bocapalma,   80000);
  await insBudget(C.luis,        P.bocapalma,  160000);
  // BARANDALES
  await insBudget(C.arturo,      P.barandales, 750000);
  await insBudget(C.temo,        P.barandales, 200000);
  // BANOS
  await insBudget(C.temo,        P.banos,      600000);
  await insBudget(C.joseDuran,   P.banos,      150000);
  await insBudget(C.pedroYanez,  P.banos,      100000);
  // ESCALERA Y RAMPA
  await insBudget(C.temo,        P.escalera,   120000);
  // GOMEZ MORIN
  await insBudget(C.temo,        P.gomezMorin,  60000);
  await insBudget(C.pedroYanez,  P.gomezMorin,  20000);
  await insBudget(C.mario,       P.gomezMorin, 100000);
  // SIERRA DEL VALLE
  await insBudget(C.genaroMtz,   P.sierra,      80000);
  await insBudget(C.joseDuran,   P.sierra,      30000);
  await insBudget(C.arturo,      P.sierra,     120000);
  // AMACUZAC
  await insBudget(C.bernardo,    P.amacuzac,    90000);
  await insBudget(C.orlando,     P.amacuzac,    70000);
  await insBudget(C.genaroMtz,   P.amacuzac,    50000);
  // FACTORES MUTUOS
  await insBudget(C.solatube,    P.factores,    45000);
  await insBudget(C.mosquiteros, P.factores,    35000);
  await insBudget(C.control2000, P.factores,    55000);
  await insBudget(C.ingCarlos,   P.factores,    80000);

  // ── SEMANA 2026-05-15 (datos reales de las fotos) ──────────────────────
  const w3 = await insWeek('2026-05-15');

  // TERRENO
  await insEntry(w3, C.gildardo,   P.terreno,    10000,  5000,     0);
  // BOCAPALMA
  await insEntry(w3, C.gildardo,   P.bocapalma,   3000,  1500,     0);
  await insEntry(w3, C.jorgeMtz,   P.bocapalma,  48690, 28690, 28690);
  await insEntry(w3, C.arturo,     P.bocapalma,  41000,     0,     0);
  await insEntry(w3, C.antonio,    P.bocapalma,  69300,  2480,  2480);
  await insEntry(w3, C.rodo,       P.bocapalma,   7600,     0,     0);
  await insEntry(w3, C.luis,       P.bocapalma,  38742,  4950,  4950);
  // BARANDALES
  await insEntry(w3, C.arturo,     P.barandales,420430,     0,     0);
  await insEntry(w3, C.temo,       P.barandales, 41400,     0,     0);
  // BANOS
  await insEntry(w3, C.temo,       P.banos,     376000,     0,     0);
  await insEntry(w3, C.joseDuran,  P.banos,      70317,     0, 70018);
  await insEntry(w3, C.pedroYanez, P.banos,      26110,     0,     0);
  // ESCALERA Y RAMPA
  await insEntry(w3, C.temo,       P.escalera,   16947, 15000, 15000);
  // LOCAL GOMEZ MORIN
  await insEntry(w3, C.temo,       P.gomezMorin, 13200,  3500,  3500);
  await insEntry(w3, C.pedroYanez, P.gomezMorin,  1900,     0,  1900);
  await insEntry(w3, C.mario,      P.gomezMorin, 38460,     0,     0);
  // SIERRA DEL VALLE
  await insEntry(w3, C.genaroMtz,  P.sierra,     14500, 14500, 14500);
  await insEntry(w3, C.joseDuran,  P.sierra,       200,   200,   200);
  await insEntry(w3, C.arturo,     P.sierra,     17000,  8500,  8500);

  // Pagos de oficina semana 2026-05-15
  await insOffice(w3, 'EMILIO',      250);
  await insOffice(w3, 'ROLANDO',    3250);
  await insOffice(w3, 'MOSQUITEROS',2500);

  // Combustible (registros de ejemplo)
  await insFuel('2025-07-10', 'FACTURA_GAS', 810.11, 'gas');
  await insFuel('2025-07-25', 'FACTURA_GAS', 2150.45, 'gas');
  await insFuel('2025-08-05', 'FACTURA_GAS', 2000.0, 'gas');
  await insFuel('2025-08-20', 'FACTURA_GAS', 1000.0, 'gas');
  await insFuel('2025-09-03', 'FACTURA_GAS', 800.0, 'gas');
  await insFuel('2025-09-15', 'FACTURA_GAS', 710.19, 'gas');
  await insFuel('2025-09-28', 'FACTURA_GAS', 807.12, 'gas');
  await insFuel('2025-10-05', 'FACTURA_GAS', 432.67, 'gas');
  await insFuel('2025-10-15', 'FACTURA_GAS', 458.0, 'gas');
  await insFuel('2025-10-28', 'FACTURA_GAS', 2140.18, 'gas');
  await insFuel('2025-11-01', 'FACTURA_GAS', 700.0, 'gas');
  await insFuel('2025-11-05', 'FACTURA_GAS', 700.0, 'gas');
  await insFuel('2025-11-08', 'FACTURA_GAS', 1000.0, 'gas');
  await insFuel('2025-11-12', 'FACTURA_GAS', 2030.0, 'gas nov');
  await insFuel('2025-11-20', 'FACTURA_GAS', 600.0, 'gas nov');
  await insFuel('2025-11-28', 'FACTURA_GAS', 2000.0, 'gas nov');
  await insFuel('2025-12-05', 'FACTURA_GAS', 432.77, 'gas');
  await insFuel('2025-12-15', 'FACTURA_GAS', 2000.0, 'gas');
  await insFuel('2025-12-28', 'FACTURA_GAS', 2081.0, 'gas');
  await insFuel('2026-01-05', 'FACTURA_GAS', 1000.0, 'gas enero');
  await insFuel('2026-01-12', 'FACTURA_GAS', 1181.0, 'gas enero');
  await insFuel('2026-01-18', 'FACTURA_GAS', 700.0, 'gas enero');
  await insFuel('2026-01-25', 'FACTURA_GAS', 2500.0, 'gas enero');
  await insFuel('2026-01-27', 'FACTURA_GAS', 2150.0, 'gas');
  await insFuel('2026-01-28', 'FACTURA_GAS', 1000.0, 'gas');
  await insFuel('2026-01-30', 'FACTURA_GAS', 2000.0, 'gas enero 30');
  await insFuel('2026-02-03', 'FACTURA_GAS', 1000.0, 'feb');
  await insFuel('2026-02-07', 'FACTURA_GAS', 461.0, 'gas');
  await insFuel('2026-02-12', 'FACTURA_GAS', 500.0, 'gas');
  await insFuel('2026-02-17', 'FACTURA_GAS', 1100.0, 'gas');
  await insFuel('2026-02-22', 'FACTURA_GAS', 500.0, 'gas');
  await insFuel('2026-02-27', 'FACTURA_GAS', 1684.0, 'gas');
  await insFuel('2026-03-05', 'FACTURA_GAS', 2110.0, 'marzo');
  await insFuel('2026-03-10', 'FACTURA_GAS', 1200.0, 'marzo');
  await insFuel('2026-03-15', 'FACTURA_GAS', 2116.0, 'gas');
  await insFuel('2026-03-20', 'FACTURA_GAS', 2150.0, 'gas');
  await insFuel('2026-03-25', 'FACTURA_GAS', 800.0, 'gas');
  await insFuel('2026-03-31', 'FACTURA_GAS', 2300.0, 'mar-31');
  await insFuel('2026-04-17', 'FACTURA_GAS', 5430.0, 'abril 17 varias');
  await insFuel('2026-04-24', 'FACTURA_GAS', 1895.0, 'abr-24');
  await insFuel('2026-04-27', 'RETIRO', 10000.0, 'retiro 27 abril');
  await insFuel('2026-05-08', 'FACTURA_GAS', 2500.0, 'may-08');
  await insFuel('2026-05-18', 'FACTURA_GAS', 2200.0, 'may-18');
  await insFuel('2026-05-18', 'APORTACION', 40915.0, 'Total aportaciones (ult. Aport. 18 may)');

  // ── REPORTES DE AVANCE ─────────────────────────────────────────────────
  // Pendientes
  await insAR(P.barandales, C.arturo,    420430, 'Avance estructura barandales',  '2026-05-14', 'pending');
  await insAR(P.banos,      C.joseDuran,  70018, 'Trabajos sanitarios banos',     '2026-05-14', 'pending');
  await insAR(P.banos,      C.temo,       50000, 'Avance banos area humeda',      '2026-05-13', 'pending');
  await insAR(P.gomezMorin, C.mario,      15000, 'Acabados interiores Gomez Morin','2026-05-14','pending');
  // Aceptados
  await insAR(P.escalera,   C.temo,       15000, 'Escalera y rampa semana 15',    '2026-05-14', 'accepted', 15000);
  await insAR(P.gomezMorin, C.temo,        3500, 'Trabajo carpinteria Gomez Morin','2026-05-14','accepted',  3500);
  await insAR(P.sierra,     C.genaroMtz,  14500, 'Avance Sierra del Valle',       '2026-05-13', 'accepted', 14500);
  await insAR(P.sierra,     C.arturo,      9000, 'Albañileria Sierra del Valle',  '2026-05-13', 'accepted',  8500);
  // Rechazado
  await insAR(P.bocapalma,  C.jorgeMtz,   35000, 'Solicitud adicional carpinteria','2026-05-12','rejected');

  console.log('Seed completado con exito.');
}

seed().catch(err => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
