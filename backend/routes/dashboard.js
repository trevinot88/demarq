'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/dashboard
router.get('/', (req, res) => {
  // Semana más reciente
  const latestWeek = db.prepare(
    `SELECT * FROM weekly_reports ORDER BY week_date DESC LIMIT 1`
  ).get();

  let currentWeekTotal = 0;
  let currentWeekSummary = [];
  let negativeAlerts = [];

  if (latestWeek) {
    const entries = db.prepare(`
      SELECT re.*, c.name AS contractor_name, p.name AS project_name,
             cpb.valor_presupuesto AS vp
      FROM report_entries re
      JOIN contractors c  ON c.id  = re.contractor_id
      JOIN projects p     ON p.id  = re.project_id
      LEFT JOIN contractor_project_budgets cpb
             ON cpb.contractor_id = re.contractor_id
            AND cpb.project_id   = re.project_id
      WHERE re.report_id = ?
    `).all(latestWeek.id);

    // Suma rep_a_cta de proyectos
    currentWeekTotal = entries.reduce((s, e) => s + e.rep_a_cta, 0);

    // Sumar oficina
    const officeTotal = db.prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM office_payments WHERE report_id = ?`
    ).get(latestWeek.id);
    currentWeekTotal += officeTotal.total;

    // Resumen por contratista (sumando todos sus proyectos)
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

    // Alertas de saldo_final negativo
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

  // Total pagado global (suma de todos los rep_a_cta de todas las semanas)
  const globalPaid = db.prepare(
    `SELECT COALESCE(SUM(rep_a_cta),0) AS total FROM report_entries`
  ).get();

  const activeProjects = db.prepare(
    `SELECT COUNT(*) AS cnt FROM projects WHERE status = 'active'`
  ).get();

  const activeContractors = db.prepare(
    `SELECT COUNT(*) AS cnt FROM contractors`
  ).get();

  res.json({
    current_week: latestWeek,
    current_week_total:   currentWeekTotal,
    total_pagado_global:  globalPaid.total,
    active_projects:      activeProjects.cnt,
    active_contractors:   activeContractors.cnt,
    current_week_summary: currentWeekSummary,
    negative_alerts:      negativeAlerts,
  });
});

module.exports = router;
