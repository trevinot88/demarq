'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/fuel/summary  (ANTES de la ruta /:id para evitar conflicto)
router.get('/summary', (req, res) => {
  const rows = db.prepare(
    `SELECT type, COALESCE(SUM(amount), 0) AS total FROM fuel_transactions GROUP BY type`
  ).all();

  const map = { FACTURA_GAS: 0, APORTACION: 0, RETIRO: 0 };
  for (const r of rows) map[r.type] = r.total;

  res.json({
    total_gas:        map.FACTURA_GAS,
    total_aportacion: map.APORTACION,
    total_retiro:     map.RETIRO,
    disponible:       map.FACTURA_GAS + map.APORTACION - map.RETIRO,
  });
});

// GET /api/fuel
router.get('/', (req, res) => {
  const { from, to } = req.query;
  let sql = `SELECT * FROM fuel_transactions`;
  const params = [];

  if (from && to) {
    sql += ` WHERE date BETWEEN ? AND ?`;
    params.push(from, to);
  } else if (from) {
    sql += ` WHERE date >= ?`;
    params.push(from);
  } else if (to) {
    sql += ` WHERE date <= ?`;
    params.push(to);
  }

  sql += ` ORDER BY date DESC, id DESC`;
  res.json(db.prepare(sql).all(...params));
});

// POST /api/fuel
router.post('/', (req, res) => {
  const { date, type, amount, description = '' } = req.body;
  if (!date || !type || amount === undefined)
    return res.status(400).json({ error: 'date, type y amount son requeridos' });
  if (!['FACTURA_GAS','APORTACION','RETIRO'].includes(type))
    return res.status(400).json({ error: 'Tipo inválido' });

  const r = db.prepare(
    `INSERT INTO fuel_transactions (date, type, amount, description) VALUES (?, ?, ?, ?)`
  ).run(date, type, Math.abs(amount), description);
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /api/fuel/:id
router.put('/:id', (req, res) => {
  const { date, type, amount, description } = req.body;
  db.prepare(`
    UPDATE fuel_transactions
       SET date        = COALESCE(?, date),
           type        = COALESCE(?, type),
           amount      = COALESCE(?, amount),
           description = COALESCE(?, description)
     WHERE id = ?
  `).run(date, type, amount !== undefined ? Math.abs(amount) : null, description, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/fuel/:id
router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM fuel_transactions WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
