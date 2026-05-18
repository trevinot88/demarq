'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/fuel/summary
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT type, COALESCE(SUM(amount), 0) AS total FROM fuel_transactions GROUP BY type`
    );
    const map = { FACTURA_GAS: 0, APORTACION: 0, RETIRO: 0 };
    for (const r of rows) map[r.type] = Number(r.total);
    res.json({
      total_gas:        map.FACTURA_GAS,
      total_aportacion: map.APORTACION,
      total_retiro:     map.RETIRO,
      disponible:       map.FACTURA_GAS + map.APORTACION - map.RETIRO,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/fuel
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let sql = `SELECT * FROM fuel_transactions`;

    if (from && to) {
      params.push(from, to);
      sql += ` WHERE date BETWEEN $1 AND $2`;
    } else if (from) {
      params.push(from);
      sql += ` WHERE date >= $1`;
    } else if (to) {
      params.push(to);
      sql += ` WHERE date <= $1`;
    }

    sql += ` ORDER BY date DESC, id DESC`;
    res.json((await db.query(sql, params)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/fuel
router.post('/', async (req, res) => {
  try {
    const { date, type, amount, description = '' } = req.body;
    if (!date || !type || amount === undefined)
      return res.status(400).json({ error: 'date, type y amount son requeridos' });
    if (!['FACTURA_GAS', 'APORTACION', 'RETIRO'].includes(type))
      return res.status(400).json({ error: 'Tipo inválido' });
    const { rows } = await db.query(
      `INSERT INTO fuel_transactions (date, type, amount, description) VALUES ($1, $2, $3, $4) RETURNING id`,
      [date, type, Math.abs(amount), description]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/fuel/:id
router.put('/:id', async (req, res) => {
  try {
    const { date, type, amount, description } = req.body;
    await db.query(`
      UPDATE fuel_transactions
         SET date        = COALESCE($1, date),
             type        = COALESCE($2, type),
             amount      = COALESCE($3, amount),
             description = COALESCE($4, description)
       WHERE id = $5
    `, [date ?? null, type ?? null, amount !== undefined ? Math.abs(amount) : null, description ?? null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/fuel/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM fuel_transactions WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
