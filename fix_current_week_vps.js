'use strict';
/**
 * ⚠️ SCRIPT DE REPARACIÓN ONE-TIME
 * Recalcula vp y ent_a_cta de las entradas de la semana MÁS RECIENTE
 * usando la fuente única de verdad (backend/finance.js). Las semanas
 * históricas NO se tocan.
 *
 * Uso:  node fix_current_week_vps.js          (muestra lo que haría)
 *       node fix_current_week_vps.js --apply  (aplica los cambios)
 */
const db = require('./backend/db');
const { getContractorFinancialState } = require('./backend/finance');

const APPLY = process.argv.includes('--apply');

(async () => {
  const { rows: latest } = await db.query(`
    SELECT id, week_date FROM weekly_reports
    WHERE week_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    ORDER BY TO_DATE(week_date, 'YYYY-MM-DD') DESC LIMIT 1
  `);
  if (!latest.length) { console.log('No hay semanas.'); process.exit(0); }
  const { id: reportId, week_date } = latest[0];
  console.log(`Semana más reciente: ${week_date} (ID ${reportId}) ${APPLY ? '— APLICANDO' : '— modo simulación (usa --apply)'}`);

  const { rows: entries } = await db.query(
    `SELECT id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta FROM report_entries WHERE report_id = $1`,
    [reportId]);

  for (const e of entries) {
    const s = await getContractorFinancialState(e.contractor_id, e.project_id);
    if (!s) continue;
    const newEnt = s.pagos_acumulados - e.rep_a_cta; // pagos previos a esta semana
    const newVp  = s.vp_total - newEnt;
    if (approx(e.vp, newVp) && approx(e.ent_a_cta, newEnt)) {
      console.log(`  OK   entry ${e.id}: vp=${e.vp} ent=${e.ent_a_cta}`);
      continue;
    }
    console.log(`  FIX  entry ${e.id}: vp ${e.vp} → ${newVp}, ent ${e.ent_a_cta} → ${newEnt}`);
    if (APPLY) {
      await db.query(`UPDATE report_entries SET vp = $1, ent_a_cta = $2 WHERE id = $3`,
        [newVp, newEnt, e.id]);
    }
  }
  console.log(APPLY ? 'Listo.' : 'Simulación terminada. Ejecuta con --apply para aplicar.');
  process.exit(0);

  function approx(a, b) { return Math.abs(a - b) < 0.01; }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
