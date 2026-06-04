'use strict';
const router = require('express').Router();
const db = require('../db');
const { updateVPForExtras } = require('./reports');

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
    const projectName = name.trim().toUpperCase();
    const { rows } = await db.query(
      `INSERT INTO projects (name, client_name, status) VALUES ($1, $2, $3) RETURNING id`,
      [projectName, client_name || null, status]
    );
    await req.logAudit('CREATE', 'project', rows[0].id, projectName, { client_name, status });
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const project = (await db.query(`SELECT * FROM projects WHERE id = $1`, [req.params.id])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { rows: contractors } = await db.query(`
      SELECT cpb.*, c.name AS contractor_name,
        COALESCE(
          (SELECT SUM(amount)
           FROM contractor_project_extras cpe
           WHERE cpe.contractor_id = cpb.contractor_id
             AND cpe.project_id = cpb.project_id), 0
        ) AS total_extras,
        COALESCE(
          cpb.total_pagado_manual,
          (SELECT re.ent_a_cta + re.rep_a_cta
           FROM report_entries re
           JOIN weekly_reports wr ON wr.id = re.report_id
           WHERE re.contractor_id = cpb.contractor_id
             AND re.project_id = cpb.project_id
           ORDER BY wr.week_date DESC LIMIT 1)
        , 0) AS total_pagado
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
    const project = (await db.query(`SELECT name FROM projects WHERE id = $1`, [req.params.id])).rows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const updates = {};
    if (name) updates.name = name.trim().toUpperCase();
    if (client_name !== undefined) updates.client_name = client_name;
    if (status) updates.status = status;
    await db.query(
      `UPDATE projects SET name = COALESCE($1, name),
                           client_name = COALESCE($2, client_name),
                           status = COALESCE($3, status)
       WHERE id = $4`,
      [name ? name.trim().toUpperCase() : null, client_name ?? null, status ?? null, req.params.id]
    );
    await req.logAudit('UPDATE', 'project', req.params.id, project.name, updates);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const project = (await db.query(`SELECT name FROM projects WHERE id = $1`, [req.params.id])).rows[0];
    await db.query(`DELETE FROM projects WHERE id = $1`, [req.params.id]);
    if (project) await req.logAudit('DELETE', 'project', req.params.id, project.name);
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
    const names = await db.query(`
      SELECT p.name AS project_name, c.name AS contractor_name
      FROM projects p, contractors c
      WHERE p.id = $1 AND c.id = $2
    `, [req.params.id, contractor_id]);
    const { rows } = await db.query(`
      INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (contractor_id, project_id) DO UPDATE
        SET valor_presupuesto = EXCLUDED.valor_presupuesto,
            notes             = EXCLUDED.notes
      RETURNING id
    `, [contractor_id, req.params.id, valor_presupuesto, notes]);
    if (names.rows[0]) {
      await req.logAudit('ASSIGN', 'contractor_project', rows[0].id, 
        `${names.rows[0].contractor_name} → ${names.rows[0].project_name}`,
        { valor_presupuesto, notes });
    }
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/projects/:id/contractors/:cid
router.put('/:id/contractors/:cid', async (req, res) => {
  try {
    const { valor_presupuesto, notes, total_pagado_manual } = req.body;
    const names = await db.query(`
      SELECT p.name AS project_name, c.name AS contractor_name
      FROM projects p, contractors c
      WHERE p.id = $1 AND c.id = $2
    `, [req.params.id, req.params.cid]);
    await db.query(`
      UPDATE contractor_project_budgets
         SET valor_presupuesto = COALESCE($1, valor_presupuesto),
             notes             = COALESCE($2, notes),
             total_pagado_manual = $3
       WHERE contractor_id = $4 AND project_id = $5
    `, [valor_presupuesto ?? null, notes ?? null, total_pagado_manual ?? null, req.params.cid, req.params.id]);
    
    // Si se actualizó el valor_presupuesto, actualizar VP en relaciones semanales
    if (valor_presupuesto !== undefined && valor_presupuesto !== null) {
      await updateVPForExtras(req.params.cid, req.params.id);
    }
    
    if (names.rows[0]) {
      await req.logAudit('UPDATE_VP', 'contractor_project', null,
        `${names.rows[0].contractor_name} → ${names.rows[0].project_name}`,
        { valor_presupuesto, notes, total_pagado_manual });
    }
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

// ── Extras routes ────────────────────────────────────────────────────────────

// GET /api/projects/:id/contractors/:cid/extras
router.get('/:id/contractors/:cid/extras', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM contractor_project_extras
      WHERE contractor_id = $1 AND project_id = $2
      ORDER BY date DESC, id DESC
    `, [req.params.cid, req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/contractors/:cid/extras
router.post('/:id/contractors/:cid/extras', async (req, res) => {
  const { amount, description = '', date = new Date().toISOString().split('T')[0] } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount required and must be > 0' });
  try {
    const names = await db.query(`
      SELECT p.name AS project_name, c.name AS contractor_name
      FROM projects p, contractors c
      WHERE p.id = $1 AND c.id = $2
    `, [req.params.id, req.params.cid]);
    const { rows } = await db.query(`
      INSERT INTO contractor_project_extras (contractor_id, project_id, amount, description, date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [req.params.cid, req.params.id, amount, description.trim(), date]);
    
    // Actualizar VP en todas las relaciones semanales
    await updateVPForExtras(req.params.cid, req.params.id);
    
    if (names.rows[0]) {
      await req.logAudit('ADD_EXTRA', 'extra', rows[0].id,
        `${names.rows[0].contractor_name} → ${names.rows[0].project_name}`,
        { amount, description, date });
    }
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/projects/:id/contractors/:cid/extras/:eid
router.put('/:id/contractors/:cid/extras/:eid', async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    const names = await db.query(`
      SELECT p.name AS project_name, c.name AS contractor_name
      FROM projects p, contractors c
      WHERE p.id = $1 AND c.id = $2
    `, [req.params.id, req.params.cid]);
    await db.query(`
      UPDATE contractor_project_extras
         SET amount      = COALESCE($1, amount),
             description = COALESCE($2, description),
             date        = COALESCE($3, date)
       WHERE id = $4 AND contractor_id = $5 AND project_id = $6
    `, [amount ?? null, description ?? null, date ?? null, req.params.eid, req.params.cid, req.params.id]);
    
    // Actualizar VP en todas las relaciones semanales
    await updateVPForExtras(req.params.cid, req.params.id);
    
    if (names.rows[0]) {
      await req.logAudit('UPDATE_EXTRA', 'extra', req.params.eid,
        `${names.rows[0].contractor_name} → ${names.rows[0].project_name}`,
        { amount, description, date });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id/contractors/:cid/extras/:eid
router.delete('/:id/contractors/:cid/extras/:eid', async (req, res) => {
  try {
    const names = await db.query(`
      SELECT p.name AS project_name, c.name AS contractor_name, cpe.amount, cpe.description
      FROM projects p, contractors c, contractor_project_extras cpe
      WHERE p.id = $1 AND c.id = $2 AND cpe.id = $3
    `, [req.params.id, req.params.cid, req.params.eid]);
    await db.query(
      `DELETE FROM contractor_project_extras WHERE id = $1 AND contractor_id = $2 AND project_id = $3`,
      [req.params.eid, req.params.cid, req.params.id]
    );
    
    // Actualizar VP en todas las relaciones semanales
    await updateVPForExtras(req.params.cid, req.params.id);
    
    if (names.rows[0]) {
      await req.logAudit('DELETE_EXTRA', 'extra', req.params.eid,
        `${names.rows[0].contractor_name} → ${names.rows[0].project_name}`,
        { amount: names.rows[0].amount, description: names.rows[0].description });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
