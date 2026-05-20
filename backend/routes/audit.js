'use strict';
const router = require('express').Router();
const db = require('../db');

// GET /api/audit — Obtener todos los logs de auditoría
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        id,
        username,
        action,
        entity_type,
        entity_id,
        entity_name,
        details,
        created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 500
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Error al cargar logs' });
  }
});

module.exports = router;
