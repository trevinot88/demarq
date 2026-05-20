'use strict';
const router  = require('express').Router();
const db      = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Credenciales requeridas' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, username, role FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = rows[0];
    req.session.authenticated = true;
    req.session.username = user.username;
    req.session.role = user.role;

    req.session.save(err => {
      if (err) return res.status(500).json({ error: 'Error al guardar sesión' });
      res.json({ ok: true, username: user.username, role: user.role });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me — check session
router.get('/me', (req, res) => {
  res.json({
    authenticated: req.session.authenticated === true,
    username: req.session.username || null,
    role: req.session.role || null,
  });
});

module.exports = router;
