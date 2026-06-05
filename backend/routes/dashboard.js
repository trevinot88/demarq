'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const latestWeek = (await db.query(
      `SELECT * FROM weekly_reports ORDER BY week_date DESC LIMIT 1`
    )).rows[0];

    let currentWeekTotal = 0;
    let currentWeekSummary = [];
    let negativeAlerts = [];

    if (latestWeek) {
      const { rows: entries } = await db.query(`
        SELECT re.*, c.name AS contractor_name, p.name AS project_name,
               COALESCE(NULLIF(re.vp, 0), cpb.valor_presupuesto, 0) AS vp
        FROM report_entries re
        JOIN contractors c  ON c.id  = re.contractor_id
        JOIN projects p     ON p.id  = re.project_id
        LEFT JOIN contractor_project_budgets cpb
               ON cpb.contractor_id = re.contractor_id
              AND cpb.project_id   = re.project_id
        WHERE re.report_id = $1
      `, [latestWeek.id]);

      currentWeekTotal = entries.reduce((s, e) => s + e.rep_a_cta, 0);

      const { rows: officePayments } = await db.query(
        `SELECT person_name, amount FROM office_payments WHERE report_id = $1`,
        [latestWeek.id]
      );
      const officeTotal = officePayments.reduce((s, op) => s + Number(op.amount), 0);
      currentWeekTotal += officeTotal;

      const summaryMap = {};
      // Agregar contratistas
      for (const e of entries) {
        if (!summaryMap[e.contractor_id]) {
          summaryMap[e.contractor_id] = { contractor_name: e.contractor_name, total: 0 };
        }
        summaryMap[e.contractor_id].total += e.rep_a_cta;
      }
      // Agregar personas de oficina
      for (const op of officePayments) {
        const key = `office_${op.person_name}`;
        if (!summaryMap[key]) {
          summaryMap[key] = { contractor_name: op.person_name, total: 0 };
        }
        summaryMap[key].total += Number(op.amount);
      }
      currentWeekSummary = Object.values(summaryMap)
        .filter(s => s.total > 0)
        .sort((a, b) => b.total - a.total);

      negativeAlerts = entries
        .map(e => {
          const vp = e.vp || 0;
          const saldo_final = vp - e.ent_a_cta - e.rep_a_cta;
          return { ...e, saldo_final };
        })
        .filter(e => e.saldo_final < 0)
        .map(e => ({
          contractor_name: e.contractor_name,
          project_name: e.project_name,
          saldo_final: e.saldo_final,
        }));
    }

    // Calcular saldo disponible de gasolinas
    const fuelBalance = (await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'APORTACION' THEN amount ELSE 0 END), 0) AS aportaciones,
        COALESCE(SUM(CASE WHEN type = 'RETIRO' THEN amount ELSE 0 END), 0) AS retiros,
        COALESCE(SUM(CASE WHEN type = 'FACTURA_GAS' THEN amount ELSE 0 END), 0) AS facturas
      FROM fuel_transactions
    `)).rows[0];
    const disponibleGasolinas = Number(fuelBalance.aportaciones) + Number(fuelBalance.facturas) - Number(fuelBalance.retiros);

    const activeProjects = (await db.query(
      `SELECT COUNT(*)::int AS cnt FROM projects WHERE status = 'active'`
    )).rows[0];

    const activeContractors = (await db.query(
      `SELECT COUNT(*)::int AS cnt FROM contractors`
    )).rows[0];

    res.json({
      current_week:         latestWeek,
      current_week_total:   currentWeekTotal,
      disponible_gasolinas: disponibleGasolinas,
      active_projects:      activeProjects.cnt,
      active_contractors:   activeContractors.cnt,
      current_week_summary: currentWeekSummary,
      negative_alerts:      negativeAlerts,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
