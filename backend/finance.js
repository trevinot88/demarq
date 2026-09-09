'use strict';
/**
 * 🔒 FUENTE ÚNICA DE VERDAD (PUNTO 3)
 *
 * Toda la información financiera acumulada de un par (contratista, proyecto)
 * DEBE obtenerse a través de este helper. PROYECTOS y RELACIÓN SEMANAL
 * comparten la misma fórmula:
 *
 *   VP_TOTAL        = valor_presupuesto (base) + extras
 *   PAGOS_ACUMULADOS = (ent_a_cta + rep_a_cta) de la entrada MÁS RECIENTE
 *                      en report_entries  ← LA CADENA SEMANAL ES LA ÚNICA
 *                      FUENTE DE VERDAD DEL TOTAL PAGADO.
 *
 *   ⚠️ pagos_semanas usa la ENTRADA MÁS RECIENTE (ent + rep), NO una SUMA de
 *   todas las semanas: `ent_a_cta` ya es acumulativo por diseño de la cadena
 *   semanal (ent_n = ent_{n-1} + rep_{n-1}), y sumar todas las semanas
 *   duplicaría los pagos.
 *
 *   SALDO_ACTUAL = VP_TOTAL − PAGOS_ACUMULADOS
 *
 *   ⛔ HISTORIAL: anteriormente se combinaba `contractor_project_budgets.
 *   total_pagado_manual` con la cadena vía Math.max. Ese cache congelado
 *   TOPABA la herencia entre semanas (la siguiente semana reiniciaba
 *   ent_a_cta al valor manual, descartando el rep_a_cta reportado). Fue
 *   ELIMINADO: la cadena semanal es la única fuente. Los pagos manuales se
 *   registran a través de la Relación Semanal (o migrados a ella).
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
           COALESCE((SELECT SUM(amount) FROM contractor_project_extras cpe
                     WHERE cpe.contractor_id = $1 AND cpe.project_id = $2), 0) AS extras,
           COALESCE((
             SELECT re.ent_a_cta + re.rep_a_cta
             FROM report_entries re
             JOIN weekly_reports wr ON wr.id = re.report_id
             WHERE re.contractor_id = $1 AND re.project_id = $2
               AND wr.week_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
             ORDER BY TO_DATE(wr.week_date, 'YYYY-MM-DD') DESC
             LIMIT 1
           ), 0) AS pagos_semanas
    FROM contractor_project_budgets cpb
    WHERE cpb.contractor_id = $1 AND cpb.project_id = $2
  `, [contractorId, projectId]);

  if (!budget) return null;

  const vp_total = (Number(budget.valor_presupuesto) || 0) + (Number(budget.extras) || 0);
  // 🔒 Cadena semanal = única fuente de verdad del total pagado.
  const pagos_acumulados = Number(budget.pagos_semanas) || 0;

  return {
    vp_total,
    pagos_acumulados,
    saldo: vp_total - pagos_acumulados,
  };
}

module.exports = { getContractorFinancialState };