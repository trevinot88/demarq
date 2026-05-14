'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/contractors
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      COUNT(DISTINCT cpb.project_id) AS project_count,
      COALESCE(SUM(cpb.valor_presupuesto), 0) AS total_vp
    FROM contractors c
    LEFT JOIN contractor_project_budgets cpb ON cpb.contractor_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json(rows);
});

// POST /api/contractors
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const r = db.prepare(`INSERT INTO contractors (name) VALUES (?)`).run(name.trim().toUpperCase());
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(409).json({ error: 'Contratista ya existe' });
  }
});

// GET /api/contractors/:id
router.get('/:id', (req, res) => {
  const contractor = db.prepare(`SELECT * FROM contractors WHERE id = ?`).get(req.params.id);
  if (!contractor) return res.status(404).json({ error: 'Contractor not found' });

  // Proyectos con VP y totales pagados
  const projects = db.prepare(`
    SELECT p.id, p.name AS project_name, p.status,
           cpb.valor_presupuesto AS vp,
           COALESCE(SUM(re.rep_a_cta), 0) AS total_rep_a_cta,
           MAX(re.ent_a_cta) AS last_ent_a_cta
    FROM contractor_project_budgets cpb
    JOIN projects p ON p.id = cpb.project_id
    LEFT JOIN report_entries re ON re.contractor_id = cpb.contractor_id
                               AND re.project_id    = cpb.project_id
    WHERE cpb.contractor_id = ?
    GROUP BY p.id
    ORDER BY p.name
  `).all(req.params.id);

  // Historial de pagos semanales
  const history = db.prepare(`
    SELECT wr.week_date, p.name AS project_name,
           re.ent_a_cta, re.rep_a_cta, re.notes,
           cpb.valor_presupuesto AS vp
    FROM report_entries re
    JOIN weekly_reports wr ON wr.id = re.report_id
    JOIN projects p         ON p.id = re.project_id
    LEFT JOIN contractor_project_budgets cpb
           ON cpb.contractor_id = re.contractor_id
          AND cpb.project_id   = re.project_id
    WHERE re.contractor_id = ?
    ORDER BY wr.week_date DESC, p.name
  `).all(req.params.id);

  // Totales globales
  const totals = db.prepare(`
    SELECT COALESCE(SUM(rep_a_cta), 0) AS total_pagado,
           COALESCE(SUM(cpb.valor_presupuesto), 0) AS total_vp
    FROM report_entries re
    LEFT JOIN contractor_project_budgets cpb
           ON cpb.contractor_id = re.contractor_id
          AND cpb.project_id   = re.project_id
    WHERE re.contractor_id = ?
  `).get(req.params.id);

  res.json({ contractor, projects, history, totals });
});

// PUT /api/contractors/:id
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    db.prepare(`UPDATE contractors SET name = ? WHERE id = ?`).run(name.trim().toUpperCase(), req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(409).json({ error: 'Nombre ya existe' });
  }
});

// DELETE /api/contractors/:id
router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM contractors WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
