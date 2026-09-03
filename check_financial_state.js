'use strict';
/**
 * Verificación de consistencia financiera (fuente única de verdad).
 *
 * Para cada par (proyecto, contratista) compara:
 *   - el estado calculado por finance.js (VP_TOTAL, PAGOS, SALDO)
 *   - la entrada más reciente en report_entries (vp, ent_a_cta, rep_a_cta)
 *
 * Reglas validadas:
 *   R1: la entrada de la semana más reciente debe tener
 *       vp ≈ SALDO y ent_a_cta ≈ PAGOS (estado al inicio de la semana).
 *   R2: vp nunca debe ser igual a VP_TOTAL cuando existen pagos acumulados
 *       (síntoma del bug "saldo reiniciado").
 *
 * Uso: node check_financial_state.js
 */
const db = require('./backend/db');
const { getContractorFinancialState } = require('./backend/finance');

(async () => {
  try {
    const { rows: pairs } = await db.query(`
      SELECT cpb.contractor_id, cpb.project_id,
             p.name AS project_name, c.name AS contractor_name
      FROM contractor_project_budgets cpb
      JOIN projects p    ON p.id = cpb.project_id
      JOIN contractors c ON c.id = cpb.contractor_id
      ORDER BY p.name, c.name
    `);

    let problems = 0;
    for (const { contractor_id, project_id, project_name, contractor_name } of pairs) {
      const state = await getContractorFinancialState(contractor_id, project_id);
      if (!state) { console.log(`⚠️  ${project_name} / ${contractor_name}: sin presupuesto`); continue; }

      const { rows: [last] } = await db.query(`
        SELECT wr.week_date, re.vp, re.ent_a_cta, re.rep_a_cta
        FROM report_entries re
        JOIN weekly_reports wr ON wr.id = re.report_id
        WHERE re.contractor_id = $1 AND re.project_id = $2
        ORDER BY TO_DATE(wr.week_date, 'YYYY-MM-DD') DESC
        LIMIT 1
      `, [contractor_id, project_id]);

      console.log(`\n▸ ${project_name} / ${contractor_name}`);
      console.log(`  VP_TOTAL=$${state.vp_total}  PAGOS=$${state.pagos_acumulados}  SALDO=$${state.saldo}`);

      if (!last) {
        console.log('  (sin semanas aún — nada que validar)');
        continue;
      }
      console.log(`  Última semana ${last.week_date}: vp=${last.vp} ent=${last.ent_a_cta} rep=${last.rep_a_cta} (saldo_final=${last.vp - last.ent_a_cta - last.rep_a_cta})`);

      const pagosPrevios = state.pagos_acumulados - last.rep_a_cta; // pagos antes de esa semana
      if (Math.abs(last.ent_a_cta - pagosPrevios) > 0.01) {
        problems++;
        console.log(`  ❌ R1: ent_a_cta=${last.ent_a_cta} pero los pagos previos eran ${pagosPrevios}`);
      }
      const vpEsperado = state.vp_total - pagosPrevios;
      if (Math.abs(last.vp - vpEsperado) > 0.01) {
        problems++;
        console.log(`  ❌ R2: vp=${last.vp} pero debería ser ${vpEsperado} (¿saldo reiniciado al VP original?)`);
      }
      // Síntoma del bug: vp = VP_TOTAL cuando SÍ había pagos ANTES de la semana.
      // (Si vp=VP_TOTAL pero ent=0, el pago se registró dentro de la semana y
      // es correcto: vp es el saldo al INICIO de la semana.)
    }

    console.log(problems === 0
      ? '\n✅ Todos los pares consistentes con la fuente única de verdad.'
      : `\n⛔ ${problems} inconsistencia(s) encontrada(s).`);
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
