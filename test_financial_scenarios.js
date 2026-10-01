'use strict';
/**
 * Pruebas de los 5 escenarios del flujo PROYECTO → PAGOS → RELACIÓN SEMANAL.
 * Requiere DATABASE_URL apuntando a una BD de prueba (el schema se auto-inicializa).
 * Uso: DATABASE_URL=postgres://... node test_financial_scenarios.js
 */
const db = require('./backend/db');
const { getContractorFinancialState, syncManualPayment } = require('./backend/finance');
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

  // ── ESCENARIO 2: pago manual migrado a la cadena → nueva semana → NO saldo 20,000
  // (antes se usaba total_pagado_manual; ahora el pago se registra en la cadena)
  console.log('\nESCENARIO 2: pago de 10,000 registrado en la cadena (semana 1)');
  {
    const rid1 = (await db.query(
      `SELECT id FROM weekly_reports WHERE week_date='2026-05-01'`)).rows[0].id;
    await entry(rid1, 20000, 0, 10000); // vp=20000, ent=0, rep=10000
    const s = await getContractorFinancialState(cont.id, proj.id);
    check('pagos acumulados = 10000', approx(s.pagos_acumulados, 10000));
    check('saldo = 10000', approx(s.saldo, 10000));
    // Crear semana 2 como lo hace POST /api/reports (fuente única de verdad)
    const rid = await week('2026-05-08');
    await entry(rid, s.vp_total, s.pagos_acumulados, 0);
    const { rows: [e] } = await db.query(
      `SELECT * FROM report_entries WHERE report_id=$1 AND contractor_id=$2`,
      [rid, cont.id]);
    check('nueva semana vp=20000 (presupuesto)', approx(e.vp, 20000), `vp=${e.vp}`);
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
    await entry(rid, s.vp_total, s.pagos_acumulados, 0);
    const { rows: [e] } = await db.query(
      `SELECT * FROM report_entries WHERE report_id=$1`, [rid]);
    check('semana siguiente vp=20000 (presupuesto), ent=14000', approx(e.vp, 20000) && approx(e.ent_a_cta, 14000), `vp=${e.vp} ent=${e.ent_a_cta}`);
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
    check('semana en curso recalculada vp=25000 (presupuesto)', approx(cur.vp, 25000), `vp=${cur.vp}`);
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
      await entry(rid, s.vp_total, s.pagos_acumulados, rep);
    }
    const s = await getContractorFinancialState(cont.id, proj.id);
    check('saldo final = 1000 (nunca se reinició)', approx(s.saldo, 1000), `saldo=${s.saldo}`);
    const { rows: [first] } = await db.query(
      `SELECT vp FROM report_entries re JOIN weekly_reports wr ON wr.id=re.report_id
       WHERE wr.week_date='2026-05-22' AND contractor_id=$1`, [cont.id]);
    check('vp se mantiene = presupuesto (20000)', approx(first.vp, 20000), `vp=${first.vp}`);
  }

  // ── ESCENARIO 6: EL BUG REPORTADO — rep en semana N debe heredar a N+1
  console.log('\nESCENARIO 6: herencia canónica ent_{n+1} = ent_n + rep_n (bug de semanas)');
  {
    // Semana 2026-06-12 con entrada heredada (ent=saldo previo, rep=2500)
    const s0 = await getContractorFinancialState(cont.id, proj.id);
    const ridN = await week('2026-06-12');
    await entry(ridN, s0.vp_total, s0.pagos_acumulados, 2500);
    // Crear semana siguiente vía fuente única de verdad (como POST /api/reports)
    const s1 = await getContractorFinancialState(cont.id, proj.id);
    check('tras rep=2500, pagos acumulados suben', approx(s1.pagos_acumulados, s0.pagos_acumulados + 2500),
      `acum=${s1.pagos_acumulados}`);
    const ridNext = await week('2026-06-19');
    await entry(ridNext, s1.vp_total, s1.pagos_acumulados, 0);
    const { rows: [eNext] } = await db.query(
      `SELECT vp, ent_a_cta FROM report_entries WHERE report_id=$1 AND contractor_id=$2`,
      [ridNext, cont.id]);
    const expectedEnt = s0.pagos_acumulados + 2500;
    check(`ent de semana siguiente = ${expectedEnt} (heredó el rep)`,
      approx(eNext.ent_a_cta, expectedEnt), `ent=${eNext.ent_a_cta}`);
    check('vp de semana siguiente = presupuesto total', approx(eNext.vp, s1.vp_total),
      `vp=${eNext.vp} esperado=${s1.vp_total}`);
  }

  // ── ESCENARIO 7: edición directa del "pagado" desde PROYECTOS ────────────────
  console.log('\nESCENARIO 7: editar "pagado" directo sincroniza la cadena (fuente única)');
  {
    // Par independiente para no depender del estado acumulado previo
    const { rows: [proj2] } = await db.query(`INSERT INTO projects (name) VALUES ('TEST PAGADO DIRECTO') RETURNING id`);
    const { rows: [cont2] } = await db.query(`INSERT INTO contractors (name) VALUES ('TEST CONTRATISTA PAGADO') RETURNING id`);
    await db.query(
      `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto) VALUES ($1,$2,50000)`,
      [cont2.id, proj2.id]);
    const rid = await week('2026-07-03');
    await db.query(
      `INSERT INTO report_entries (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
       VALUES ($1,$2,$3,50000,0,0,'')`,
      [rid, cont2.id, proj2.id]);

    // Editar "pagado" a 12000 → debe quedar ent=0, rep=12000 en la semana reciente
    const r = await syncManualPayment(cont2.id, proj2.id, 12000);
    check('syncManualPayment ok', r.ok === true, JSON.stringify(r));
    const s = await getContractorFinancialState(cont2.id, proj2.id);
    check('pagos acumulados = 12000', approx(s.pagos_acumulados, 12000), `pagos=${s.pagos_acumulados}`);
    check('saldo = 38000', approx(s.saldo, 38000), `saldo=${s.saldo}`);

    // Consistencia: SUM(rep_a_cta) de todas las semanas debe ser 12000 (Contratista)
    const { rows: [tot] } = await db.query(
      `SELECT COALESCE(SUM(rep_a_cta),0)::float AS total FROM report_entries WHERE contractor_id=$1 AND project_id=$2`,
      [cont2.id, proj2.id]);
    check('SUM(rep_a_cta) = 12000 (Contratista consistente)', approx(Number(tot.total), 12000), `sum=${tot.total}`);

    // Hereda a la semana siguiente
    const s1 = await getContractorFinancialState(cont2.id, proj2.id);
    const ridNext = await week('2026-07-10');
    await db.query(
      `INSERT INTO report_entries (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
       VALUES ($1,$2,$3,$4,$5,0,'')`,
      [ridNext, cont2.id, proj2.id, s1.vp_total, s1.pagos_acumulados]);
    const { rows: [eNext] } = await db.query(
      `SELECT ent_a_cta FROM report_entries WHERE report_id=$1 AND contractor_id=$2`, [ridNext, cont2.id]);
    check('semana siguiente hereda ent=12000', approx(Number(eNext.ent_a_cta), 12000), `ent=${eNext.ent_a_cta}`);

    // Intentar reducir por debajo de lo acumulado debe fallar
    const rLow = await syncManualPayment(cont2.id, proj2.id, 5000);
    check('reducir debajo de acumulado falla', rLow.ok === false, JSON.stringify(rLow));
  }

  console.log(failures === 0 ? '\n✅ TODOS LOS ESCENARIOS PASARON' : `\n⛔ ${failures} FALLA(S)`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
