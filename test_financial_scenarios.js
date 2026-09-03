'use strict';
/**
 * Pruebas de los 5 escenarios del flujo PROYECTO → PAGOS → RELACIÓN SEMANAL.
 * Requiere DATABASE_URL apuntando a una BD de prueba (el schema se auto-inicializa).
 * Uso: DATABASE_URL=postgres://... node test_financial_scenarios.js
 */
const db = require('./backend/db');
const { getContractorFinancialState } = require('./backend/finance');
const { updateVPForExtras } = require('./backend/routes/reports');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.log(`  ❌ ${name} ${detail}`); }
}
const approx = (a, b) => Math.abs(a - b) < 0.01;

(async () => {
  await db.query(`DELETE FROM report_entries`);
  await db.query(`DELETE FROM weekly_reports`);
  await db.query(`DELETE FROM contractor_project_extras`);
  await db.query(`DELETE FROM contractor_project_budgets`);
  await db.query(`DELETE FROM contractors`);
  await db.query(`DELETE FROM projects`);

  // Setup: proyecto BOCAPALMA + contratista GILDARDO, VP base 20,000
  const { rows: [proj] } = await db.query(
    `INSERT INTO projects (name, client_name) VALUES ('BOCAPALMA PROYECTO ENTRADA','TEST') RETURNING id`);
  const { rows: [cont] } = await db.query(`INSERT INTO contractors (name) VALUES ('GILDARDO DE HOYOS') RETURNING id`);
  await db.query(
    `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto) VALUES ($1,$2,20000)`,
    [cont.id, proj.id]);

  const week = async (date) => (await db.query(
    `INSERT INTO weekly_reports (week_date) VALUES ($1) RETURNING id`, [date])).rows[0].id;

  const entry = async (reportId, vp, ent, rep) => {
    await db.query(
      `INSERT INTO report_entries (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
       VALUES ($1,$2,$3,$4,$5,$6,'') ON CONFLICT DO NOTHING`,
      [reportId, cont.id, proj.id, vp, ent, rep]);
  };


  // ── ESCENARIO 1: VP 20,000 / Pagado 0 → crear semana → vp=20,000, ent=0
  console.log('\nESCENARIO 1: primera semana sin pagos');
  {
    await week('2026-05-01');
    const s = await getContractorFinancialState(cont.id, proj.id);
    check('vp_total = 20000', approx(s.vp_total, 20000));
    check('saldo = 20000', approx(s.saldo, 20000));
  }

  // ── ESCENARIO 2: Pagado manual 10,000 → nueva semana → NO saldo 20,000
  console.log('\nESCENARIO 2: pago manual de 10,000 registrado en PROYECTOS');
  {
    await db.query(
      `UPDATE contractor_project_budgets SET total_pagado_manual = 10000 WHERE contractor_id=$1 AND project_id=$2`,
      [cont.id, proj.id]);
    const s = await getContractorFinancialState(cont.id, proj.id);
    check('saldo = 10000', approx(s.saldo, 10000));
    const rid = await week('2026-05-08');
    await entry(rid, s.saldo, s.pagos_acumulados, 0);
    const { rows: [e] } = await db.query(
      `SELECT * FROM report_entries WHERE report_id=$1 AND contractor_id=$2`,
      [rid, cont.id]);
    check('nueva semana vp=10000 (NO 20000)', approx(e.vp, 10000), `vp=${e.vp}`);
    check('nueva semana ent=10000', approx(e.ent_a_cta, 10000));
  }

  // ── ESCENARIO 3: registrar rep_a_cta en la semana, crear la siguiente
  console.log('\nESCENARIO 3: pago dentro de la semana, luego semana siguiente');
  {
    await db.query(`UPDATE report_entries SET rep_a_cta = 4000 WHERE report_id=(
      SELECT id FROM weekly_reports WHERE week_date='2026-05-08') AND contractor_id=$1`, [cont.id]);
    const s = await getContractorFinancialState(cont.id, proj.id);
    check('pagos acumulados = 14000', approx(s.pagos_acumulados, 14000), `pagos=${s.pagos_acumulados}`);
    check('saldo = 6000', approx(s.saldo, 6000));
    const rid = await week('2026-05-15');
    await entry(rid, s.saldo, s.pagos_acumulados, 0);
    const { rows: [e] } = await db.query(
      `SELECT * FROM report_entries WHERE report_id=$1`, [rid]);
    check('semana siguiente vp=6000, ent=14000', approx(e.vp, 6000) && approx(e.ent_a_cta, 14000), `vp=${e.vp} ent=${e.ent_a_cta}`);
  }

  // ── ESCENARIO 4: modificar presupuesto no altera semana histórica
  console.log('\nESCENARIO 4: semana histórica intacta tras modificar el proyecto');
  {
    const before = (await db.query(
      `SELECT vp, ent_a_cta, rep_a_cta FROM report_entries re
       JOIN weekly_reports wr ON wr.id=re.report_id WHERE wr.week_date='2026-05-01'`)).rows[0];
    await db.query(`UPDATE contractor_project_budgets SET valor_presupuesto=25000 WHERE contractor_id=$1 AND project_id=$2`, [cont.id, proj.id]);
    await updateVPForExtras(cont.id, proj.id);
    const after = (await db.query(
      `SELECT vp, ent_a_cta, rep_a_cta FROM report_entries re
       JOIN weekly_reports wr ON wr.id=re.report_id WHERE wr.week_date='2026-05-01'`)).rows[0];
    check('semana histórica sin cambios', JSON.stringify(before) === JSON.stringify(after));
    const cur = (await db.query(
      `SELECT vp FROM report_entries re JOIN weekly_reports wr ON wr.id=re.report_id
       WHERE wr.week_date='2026-05-15' AND contractor_id=$1`, [cont.id])).rows[0];
    check('semana en curso recalculada vp=11000', approx(cur.vp, 11000), `vp=${cur.vp}`);
  }

  // ── ESCENARIO 5: varias semanas consecutivas nunca reinician al VP original
  console.log('\nESCENARIO 5: cadena de 3 semanas con pagos entre semanas');
  {
    await db.query(`UPDATE contractor_project_budgets SET valor_presupuesto=20000 WHERE contractor_id=$1 AND project_id=$2`, [cont.id, proj.id]);
    let lastSaldo = null;
    for (const [date, rep] of [['2026-05-22', 2000], ['2026-05-29', 3000], ['2026-06-05', 0]]) {
      const s = await getContractorFinancialState(cont.id, proj.id);
      if (lastSaldo !== null && s.saldo > lastSaldo + 0.01) {
        failures++; console.log(`  ❌ semana ${date}: saldo ${s.saldo} > anterior ${lastSaldo} (se reinició)`);
      }
      lastSaldo = s.saldo;
      const rid = await week(date);
      await entry(rid, s.saldo, s.pagos_acumulados, rep);
    }
    const s = await getContractorFinancialState(cont.id, proj.id);
    check('saldo final = 1000 (nunca se reinició)', approx(s.saldo, 1000), `saldo=${s.saldo}`);
    const { rows: [first] } = await db.query(
      `SELECT vp FROM report_entries re JOIN weekly_reports wr ON wr.id=re.report_id
       WHERE wr.week_date='2026-05-22' AND contractor_id=$1`, [cont.id]);
    check('ninguna semana volvió a vp=20000', first.vp < 20000, `vp=${first.vp}`);
  }

  console.log(failures === 0 ? '\n✅ TODOS LOS ESCENARIOS PASARON' : `\n⛔ ${failures} FALLA(S)`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
