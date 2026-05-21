'use strict';
const router = require('express').Router();
const db     = require('../db');

// ── GET /api/reportes ─────────────────────────────────────────────────────────
// Lista todos los reportes de avance con info de proyecto y contratista
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ar.*,
             p.name  AS project_name,
             c.name  AS contractor_name
        FROM advancement_reports ar
        JOIN projects    p ON p.id = ar.project_id
        JOIN contractors c ON c.id = ar.contractor_id
       ORDER BY ar.report_date DESC, ar.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reportes ────────────────────────────────────────────────────────
// Crear nuevo reporte de avance
router.post('/', async (req, res) => {
  const { project_id, contractor_id, amount_reported, description, report_date } = req.body;
  if (!project_id || !contractor_id || amount_reported == null) {
    return res.status(400).json({ error: 'project_id, contractor_id y amount_reported son requeridos' });
  }
  try {
    const names = await db.query(`
      SELECT p.name AS project_name, c.name AS contractor_name
      FROM projects p, contractors c
      WHERE p.id = $1 AND c.id = $2
    `, [project_id, contractor_id]);
    const { rows } = await db.query(`
      INSERT INTO advancement_reports (project_id, contractor_id, amount_reported, description, report_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [project_id, contractor_id, amount_reported, description || '', report_date || new Date().toISOString().slice(0, 10)]);
    if (names.rows[0]) {
      await req.logAudit('CREATE', 'advancement_report', rows[0].id,
        `${names.rows[0].contractor_name} → ${names.rows[0].project_name}`,
        { amount_reported, description, report_date });
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reportes/:id/accept ───────────────────────────────────────────
// Aceptar reporte (con monto negociado)
router.patch('/:id/accept', async (req, res) => {
  const { amount_accepted } = req.body;
  if (amount_accepted == null) {
    return res.status(400).json({ error: 'amount_accepted es requerido' });
  }
  try {
    const before = await db.query(`
      SELECT ar.*, p.name AS project_name, c.name AS contractor_name
      FROM advancement_reports ar
      JOIN projects p ON p.id = ar.project_id
      JOIN contractors c ON c.id = ar.contractor_id
      WHERE ar.id = $1
    `, [req.params.id]);
    const { rows } = await db.query(`
      UPDATE advancement_reports
         SET status = 'accepted',
             amount_accepted = $1,
             accepted_date   = CURRENT_DATE
       WHERE id = $2
      RETURNING *
    `, [amount_accepted, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (before.rows[0]) {
      await req.logAudit('ACCEPT', 'advancement_report', req.params.id,
        `${before.rows[0].contractor_name} → ${before.rows[0].project_name}`,
        { amount_reported: before.rows[0].amount_reported, amount_accepted });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reportes/:id/reject ───────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  try {
    const before = await db.query(`
      SELECT ar.*, p.name AS project_name, c.name AS contractor_name
      FROM advancement_reports ar
      JOIN projects p ON p.id = ar.project_id
      JOIN contractors c ON c.id = ar.contractor_id
      WHERE ar.id = $1
    `, [req.params.id]);
    const { rows } = await db.query(`
      UPDATE advancement_reports
         SET status = 'rejected'
       WHERE id = $1
      RETURNING *
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (before.rows[0]) {
      await req.logAudit('REJECT', 'advancement_report', req.params.id,
        `${before.rows[0].contractor_name} → ${before.rows[0].project_name}`,
        { amount_reported: before.rows[0].amount_reported });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reportes/:id/reset ────────────────────────────────────────────
// Regresa a pendiente
router.patch('/:id/reset', async (req, res) => {
  try {
    const { rows } = await db.query(`
      UPDATE advancement_reports
         SET status = 'pending', amount_accepted = NULL,
             accepted_date = NULL, weekly_report_id = NULL
       WHERE id = $1
      RETURNING *
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reportes/:id/pasar ─────────────────────────────────────────────
// Pasa el reporte aceptado a la relación semanal indicada
router.post('/:id/pasar', async (req, res) => {
  const { weekly_report_id } = req.body;
  if (!weekly_report_id) {
    return res.status(400).json({ error: 'weekly_report_id es requerido' });
  }
  try {
    // Obtener el reporte
    const { rows: arRows } = await db.query(`
      SELECT ar.*, p.name AS project_name, c.name AS contractor_name, wr.week_date
      FROM advancement_reports ar
      JOIN projects p ON p.id = ar.project_id
      JOIN contractors c ON c.id = ar.contractor_id
      JOIN weekly_reports wr ON wr.id = $2
      WHERE ar.id = $1
    `, [req.params.id, weekly_report_id]);
    if (!arRows.length) return res.status(404).json({ error: 'No encontrado' });
    const ar = arRows[0];
    if (ar.status !== 'accepted') {
      return res.status(400).json({ error: 'Solo se pueden pasar reportes aceptados' });
    }
    const amount = ar.amount_accepted ?? ar.amount_reported;

    // Upsert en report_entries
    await db.query(`
      INSERT INTO report_entries (report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes)
      VALUES ($1, $2, $3, 0, $4, $5)
      ON CONFLICT (report_id, contractor_id, project_id)
      DO UPDATE SET rep_a_cta = report_entries.rep_a_cta + EXCLUDED.rep_a_cta
    `, [weekly_report_id, ar.contractor_id, ar.project_id, amount,
        `Reporte #${ar.id} — ${ar.description || ''}`]);

    // Marcar como pasado
    const { rows } = await db.query(`
      UPDATE advancement_reports
         SET weekly_report_id = $1
       WHERE id = $2
      RETURNING *
    `, [weekly_report_id, req.params.id]);

    await req.logAudit('PASS_TO_WEEK', 'advancement_report', req.params.id,
      `${ar.contractor_name} → ${ar.project_name}`,
      { week_date: ar.week_date, amount });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/reportes/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM advancement_reports WHERE id = $1`, [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
