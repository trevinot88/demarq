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
               cpb.valor_presupuesto AS vp
        FROM report_entries re
        JOIN contractors c  ON c.id  = re.contractor_id
        JOIN projects p     ON p.id  = re.project_id
        LEFT JOIN contractor_project_budgets cpb
               ON cpb.contractor_id = re.contractor_id
              AND cpb.project_id   = re.project_id
        WHERE re.report_id = $1
      `, [latestWeek.id]);

      currentWeekTotal = entries.reduce((s, e) => s + e.rep_a_cta, 0);

      const officeTotal = (await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM office_payments WHERE report_id = $1`,
        [latestWeek.id]
      )).rows[0];
      currentWeekTotal += Number(officeTotal.total);

      const summaryMap = {};
      for (const e of entries) {
        if (!summaryMap[e.contractor_id]) {
          summaryMap[e.contractor_id] = { contractor_name: e.contractor_name, total: 0 };
        }
        summaryMap[e.contractor_id].total += e.rep_a_cta;
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

    const globalPaid = (await db.query(
      `SELECT COALESCE(SUM(rep_a_cta), 0) AS total FROM report_entries`
    )).rows[0];

    const activeProjects = (await db.query(
      `SELECT COUNT(*)::int AS cnt FROM projects WHERE status = 'active'`
    )).rows[0];

    const activeContractors = (await db.query(
      `SELECT COUNT(*)::int AS cnt FROM contractors`
    )).rows[0];

    res.json({
      current_week:         latestWeek,
      current_week_total:   currentWeekTotal,
      total_pagado_global:  Number(globalPaid.total),
      active_projects:      activeProjects.cnt,
      active_contractors:   activeContractors.cnt,
      current_week_summary: currentWeekSummary,
      negative_alerts:      negativeAlerts,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
