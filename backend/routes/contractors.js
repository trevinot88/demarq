'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/contractors
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*,
        COUNT(DISTINCT cpb.project_id)::int AS project_count,
        COALESCE(SUM(cpb.valor_presupuesto), 0) AS total_vp
      FROM contractors c
      LEFT JOIN contractor_project_budgets cpb ON cpb.contractor_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/contractors
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO contractors (name) VALUES ($1) RETURNING id`,
      [name.trim().toUpperCase()]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    res.status(409).json({ error: 'Contratista ya existe' });
  }
});

// GET /api/contractors/:id
router.get('/:id', async (req, res) => {
  try {
    const contractor = (await db.query(`SELECT * FROM contractors WHERE id = $1`, [req.params.id])).rows[0];
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' });

    const { rows: projects } = await db.query(`
      SELECT p.id, p.name AS project_name, p.status,
             cpb.valor_presupuesto AS vp,
             COALESCE(SUM(re.rep_a_cta), 0) AS total_rep_a_cta,
             MAX(re.ent_a_cta) AS last_ent_a_cta
      FROM contractor_project_budgets cpb
      JOIN projects p ON p.id = cpb.project_id
      LEFT JOIN report_entries re ON re.contractor_id = cpb.contractor_id
                                 AND re.project_id    = cpb.project_id
      WHERE cpb.contractor_id = $1
      GROUP BY p.id, p.name, p.status, cpb.valor_presupuesto
      ORDER BY p.name
    `, [req.params.id]);

    const { rows: history } = await db.query(`
      SELECT wr.week_date, p.name AS project_name,
             re.ent_a_cta, re.rep_a_cta, re.notes,
             cpb.valor_presupuesto AS vp
      FROM report_entries re
      JOIN weekly_reports wr ON wr.id = re.report_id
      JOIN projects p         ON p.id = re.project_id
      LEFT JOIN contractor_project_budgets cpb
             ON cpb.contractor_id = re.contractor_id
            AND cpb.project_id   = re.project_id
      WHERE re.contractor_id = $1
      ORDER BY wr.week_date DESC, p.name
    `, [req.params.id]);

    const totals = (await db.query(`
      SELECT COALESCE(SUM(re.rep_a_cta), 0) AS total_pagado,
             COALESCE(SUM(cpb.valor_presupuesto), 0) AS total_vp
      FROM report_entries re
      LEFT JOIN contractor_project_budgets cpb
             ON cpb.contractor_id = re.contractor_id
            AND cpb.project_id   = re.project_id
      WHERE re.contractor_id = $1
    `, [req.params.id])).rows[0];

    res.json({ contractor, projects, history, totals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/contractors/:id
router.put('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    await db.query(`UPDATE contractors SET name = $1 WHERE id = $2`, [name.trim().toUpperCase(), req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(409).json({ error: 'Nombre ya existe' });
  }
});

// DELETE /api/contractors/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM contractors WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
