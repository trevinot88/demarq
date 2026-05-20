'use strict';
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const path    = require('path');
const crypto  = require('crypto');

require('./db'); // initialise schema on startup
const { auditMiddleware } = require('./middleware/auditLogger');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust Render's reverse proxy so secure cookies work over HTTPS
app.set('trust proxy', 1);

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? 'https://demarq.onrender.com'
    : 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// ── Sessions ──────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  },
}));

// ── Audit middleware ──────────────────────────────────────────────────────────
app.use(auditMiddleware);

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/dashboard',   requireAuth, require('./routes/dashboard'));
app.use('/api/projects',    requireAuth, require('./routes/projects'));
app.use('/api/contractors', requireAuth, require('./routes/contractors'));
app.use('/api/reportes',    requireAuth, require('./routes/reportes'));
app.use('/api/reports',     requireAuth, require('./routes/reports'));
app.use('/api/fuel',        requireAuth, require('./routes/fuel'));
app.use('/api/audit',       requireAuth, require('./routes/audit'));

// ── Frontend (production) ─────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () =>
  console.log(`🏗️  Constructor Admin → http://localhost:${PORT}`)
);
