'use strict';
/**
 * 🔒 FUENTE ÚNICA DE VERDAD (PUNTO 3)
 *
 * Toda la información financiera acumulada de un par (contratista, proyecto)
 * DEBE obtenerse a través de este helper. PROYECTOS y RELACIÓN SEMANAL
 * comparten la misma fórmula:
 *
 *   VP_TOTAL = valor_presupuesto (base) + extras
 *   PAGOS_ACUMULADOS = total_pagado_manual (si existe; pagos registrados
 *                      manualmente en PROYECTOS) o (ent_a_cta + rep_a_cta)
 *                      de la entrada más reciente en report_entries.
 *
 *   ⚠️ pagos_semanas usa la ENTRADA MÁS RECIENTE (ent + rep), NO una SUMA de
 *   todas las semanas: `ent_a_cta` ya es acumulativo por diseño de la cadena
 *   semanal (ent_n = ent_{n-1} + rep_{n-1}), y sumar todas las semanas
 *   duplicaría los pagos.
 *
 *   SALDO_ACTUAL = VP_TOTAL − PAGOS_ACUMULADOS
 *
 * Semántica de columnas en report_entries (snapshot histórico inmutable):
 *   vp       = saldo al INICIO de la semana
 *   ent_a_cta= pagos acumulados a la fecha (al inicio de la semana)
 *   rep_a_cta= reportado/pagado dentro de la semana
 */
const db = require('./db');

async function getContractorFinancialState(contractorId, projectId, client = null) {
  const conn = client || db.pool;
  const { rows: [budget] } = await conn.query(`
    SELECT cpb.valor_presupuesto,
           cpb.total_pagado_manual,
           COALESCE((SELECT SUM(amount) FROM contractor_project_extras cpe
                     WHERE cpe.contractor_id = $1 AND cpe.project_id = $2), 0) AS extras,
           COALESCE((
             SELECT re.ent_a_cta + re.rep_a_cta
             FROM report_entries re
             JOIN weekly_reports wr ON wr.id = re.report_id
             WHERE re.contractor_id = $1 AND re.project_id = $2
             ORDER BY TO_DATE(wr.week_date, 'YYYY-MM-DD') DESC
             LIMIT 1
           ), 0) AS pagos_semanas
    FROM contractor_project_budgets cpb
    WHERE cpb.contractor_id = $1 AND cpb.project_id = $2
  `, [contractorId, projectId]);

  if (!budget) return null;

  const vp_total = (Number(budget.valor_presupuesto) || 0) + (Number(budget.extras) || 0);
  // Regla: gana el MAYOR entre el pago manual y el acumulado semanal.
  // - Si el usuario registró pagos fuera de las semanas, manual >= semanal.
  // - Si después registró pagos en la Relación Semanal, semanal > manual.
  // COALESCE sería incorrecto: ignoraría uno de los dos y revertiría el bug.
  const pagos_acumulados = budget.total_pagado_manual != null
    ? Math.max(Number(budget.total_pagado_manual) || 0, Number(budget.pagos_semanas) || 0)
    : Number(budget.pagos_semanas) || 0;

  return {
    vp_total,
    pagos_acumulados,
    saldo: vp_total - pagos_acumulados,
  };
}

/**
 * 🔒 SINCRONIZACIÓN PROYECTOS → SEMANA EN CURSO:
 * Recalcula vp y ent_a_cta de la entrada del par (contratista, proyecto) en la
 * semana MÁS RECIENTE a partir del estado financiero real. Las semanas
 * históricas NO se tocan (snapshot inmutable).
 *
 * Se invoca cuando el usuario registra/edita pagos manuales (total_pagado_manual)
 * en PROYECTOS, para que la Relación Semanal abierta refleje el pago de inmediato
 * y no "hasta la semana siguiente".
 *
 * vp       = VP_TOTAL − pagos_previos (pagos acumulados menos lo reportado EN la semana)
 * ent_a_cta= pagos_previos
 */
async function recalcCurrentWeekEntry(contractorId, projectId, client = null) {
  const conn = client || db.pool;
  const state = await getContractorFinancialState(contractorId, projectId, conn);
  if (!state) return;

  const { rowCount } = await conn.query(`
    UPDATE report_entries re
    SET ent_a_cta = $1 - re.rep_a_cta,
        vp        = $2 - ($1 - re.rep_a_cta)
    WHERE re.contractor_id = $3 AND re.project_id = $4
      AND re.report_id = (
        SELECT wr.id FROM weekly_reports wr
        WHERE wr.week_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        ORDER BY TO_DATE(wr.week_date, 'YYYY-MM-DD') DESC
        LIMIT 1
      )
  `, [state.pagos_acumulados, state.vp_total, contractorId, projectId]);
  return rowCount;
}

module.exports = { getContractorFinancialState, recalcCurrentWeekEntry };