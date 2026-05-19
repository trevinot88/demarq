'use strict';
const router  = require('express').Router();
const crypto  = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER || 'demarq';
const ADMIN_PASS = process.env.ADMIN_PASS || '2026';

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run the comparison to avoid timing leak on length
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Credenciales requeridas' });
  }
  const userOk = timingSafeEqual(username, ADMIN_USER);
  const passOk = timingSafeEqual(password, ADMIN_PASS);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth/me — check session
router.get('/me', (req, res) => {
  res.json({ authenticated: req.session.authenticated === true });
});

module.exports = router;
