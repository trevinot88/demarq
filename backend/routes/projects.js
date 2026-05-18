'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.*,
        COUNT(DISTINCT cpb.contractor_id)::int AS contractor_count
      FROM projects p
      LEFT JOIN contractor_project_budgets cpb ON cpb.project_id = p.id
      GROUP BY p.id
      ORDER BY p.status, p.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects
router.post('/', async (req, res) => {
  try {
    const { name, client_name, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await db.query(
      `INSERT INTO projects (name, client_name, status) VALUES ($1, $2, $3) RETURNING id`,
      [name.trim().toUpperCase(), client_name || null, status]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = (await db.query(`SELECT * FROM projects WHERE id = $1`, [req.params.id])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { rows: contractors } = await db.query(`
      SELECT cpb.*, c.name AS contractor_name
      FROM contractor_project_budgets cpb
      JOIN contractors c ON c.id = cpb.contractor_id
      WHERE cpb.project_id = $1
      ORDER BY c.name
    `, [req.params.id]);

    const { rows: history } = await db.query(`
      SELECT wr.week_date,
        SUM(re.ent_a_cta) AS total_ent,
        SUM(re.rep_a_cta) AS total_rep,
        COUNT(DISTINCT re.contractor_id)::int AS contractors_active
      FROM report_entries re
      JOIN weekly_reports wr ON wr.id = re.report_id
      WHERE re.project_id = $1
      GROUP BY wr.id, wr.week_date
      ORDER BY wr.week_date DESC
    `, [req.params.id]);

    res.json({ project, contractors, history });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, client_name, status } = req.body;
    const project = (await db.query(`SELECT id FROM projects WHERE id = $1`, [req.params.id])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await db.query(
      `UPDATE projects SET name = COALESCE($1, name),
                           client_name = COALESCE($2, client_name),
                           status = COALESCE($3, status)
       WHERE id = $4`,
      [name ? name.trim().toUpperCase() : null, client_name ?? null, status ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM projects WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id/contractors
router.get('/:id/contractors', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cpb.*, c.name AS contractor_name
      FROM contractor_project_budgets cpb
      JOIN contractors c ON c.id = cpb.contractor_id
      WHERE cpb.project_id = $1
      ORDER BY c.name
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/contractors
router.post('/:id/contractors', async (req, res) => {
  const { contractor_id, valor_presupuesto = 0, notes = '' } = req.body;
  if (!contractor_id) return res.status(400).json({ error: 'contractor_id required' });
  try {
    const { rows } = await db.query(`
      INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (contractor_id, project_id) DO UPDATE
        SET valor_presupuesto = EXCLUDED.valor_presupuesto,
            notes             = EXCLUDED.notes
      RETURNING id
    `, [contractor_id, req.params.id, valor_presupuesto, notes]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/projects/:id/contractors/:cid
router.put('/:id/contractors/:cid', async (req, res) => {
  try {
    const { valor_presupuesto, notes } = req.body;
    await db.query(`
      UPDATE contractor_project_budgets
         SET valor_presupuesto = COALESCE($1, valor_presupuesto),
             notes             = COALESCE($2, notes)
       WHERE contractor_id = $3 AND project_id = $4
    `, [valor_presupuesto ?? null, notes ?? null, req.params.cid, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id/contractors/:cid
router.delete('/:id/contractors/:cid', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM contractor_project_budgets WHERE contractor_id = $1 AND project_id = $2`,
      [req.params.cid, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
