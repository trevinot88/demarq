'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/projects
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT cpb.contractor_id) AS contractor_count
    FROM projects p
    LEFT JOIN contractor_project_budgets cpb ON cpb.project_id = p.id
    GROUP BY p.id
    ORDER BY p.status, p.name
  `).all();
  res.json(rows);
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name, client_name, status = 'active' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const r = db.prepare(
    `INSERT INTO projects (name, client_name, status) VALUES (?, ?, ?)`
  ).run(name.trim().toUpperCase(), client_name || null, status);
  res.status(201).json({ id: r.lastInsertRowid });
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const contractors = db.prepare(`
    SELECT cpb.*, c.name AS contractor_name
    FROM contractor_project_budgets cpb
    JOIN contractors c ON c.id = cpb.contractor_id
    WHERE cpb.project_id = ?
    ORDER BY c.name
  `).all(req.params.id);

  // Historial de semanas con actividad en este proyecto
  const history = db.prepare(`
    SELECT wr.week_date,
      SUM(re.ent_a_cta) AS total_ent,
      SUM(re.rep_a_cta) AS total_rep,
      COUNT(DISTINCT re.contractor_id) AS contractors_active
    FROM report_entries re
    JOIN weekly_reports wr ON wr.id = re.report_id
    WHERE re.project_id = ?
    GROUP BY wr.id
    ORDER BY wr.week_date DESC
  `).all(req.params.id);

  res.json({ project, contractors, history });
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const { name, client_name, status } = req.body;
  const project = db.prepare(`SELECT id FROM projects WHERE id = ?`).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  db.prepare(
    `UPDATE projects SET name = COALESCE(?, name),
                         client_name = COALESCE(?, client_name),
                         status = COALESCE(?, status)
     WHERE id = ?`
  ).run(name ? name.trim().toUpperCase() : null, client_name, status, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// GET /api/projects/:id/contractors
router.get('/:id/contractors', (req, res) => {
  const rows = db.prepare(`
    SELECT cpb.*, c.name AS contractor_name
    FROM contractor_project_budgets cpb
    JOIN contractors c ON c.id = cpb.contractor_id
    WHERE cpb.project_id = ?
    ORDER BY c.name
  `).all(req.params.id);
  res.json(rows);
});

// POST /api/projects/:id/contractors  — asignar contratista
router.post('/:id/contractors', (req, res) => {
  const { contractor_id, valor_presupuesto = 0, notes = '' } = req.body;
  if (!contractor_id) return res.status(400).json({ error: 'contractor_id required' });
  try {
    const r = db.prepare(`
      INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(contractor_id, project_id) DO UPDATE
        SET valor_presupuesto = excluded.valor_presupuesto,
            notes             = excluded.notes
    `).run(contractor_id, req.params.id, valor_presupuesto, notes);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/projects/:id/contractors/:cid  — actualizar VP
router.put('/:id/contractors/:cid', (req, res) => {
  const { valor_presupuesto, notes } = req.body;
  db.prepare(`
    UPDATE contractor_project_budgets
       SET valor_presupuesto = COALESCE(?, valor_presupuesto),
           notes             = COALESCE(?, notes)
     WHERE contractor_id = ? AND project_id = ?
  `).run(valor_presupuesto, notes, req.params.cid, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/projects/:id/contractors/:cid
router.delete('/:id/contractors/:cid', (req, res) => {
  db.prepare(
    `DELETE FROM contractor_project_budgets WHERE contractor_id = ? AND project_id = ?`
  ).run(req.params.cid, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
