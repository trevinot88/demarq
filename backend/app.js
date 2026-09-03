'use strict';
/**
 * Configuración de la app Express — separada de server.js para poder
 * exportarla como Serverless Function de Vercel (ver /api/index.js).
 * La lógica de rutas en ./routes/ NO se modifica.
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path    = require('path');
const crypto  = require('crypto');

const { pool } = require('./db'); // inicializa el schema (idempotente, IF NOT EXISTS)
const { auditMiddleware } = require('./middleware/auditLogger');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Trust proxy (Vercel/Render) para cookies seguras sobre HTTPS
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Orígenes permitidos (lista separada por comas). En Vercel el frontend y el
// backend comparten dominio, así que en producción esto es redundante pero
// se mantiene para despliegues en dominios separados.
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Sin Origin = misma origen / curl → permitir
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// ── Sesiones (persistidas en Postgres — compatible con serverless) ───────────
// ⚠️ En producción SESSION_SECRET es OBLIGATORIO: un secreto aleatorio por
// proceso invalidaría las cookies de sesión entre invocaciones serverless.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && isProd) {
  throw new Error('SESSION_SECRET es requerido en producción');
}
app.use(session({
  store: new pgSession({
    pool,                             // reutiliza el Pool de db.js (Supabase)
    tableName: 'user_sessions',
    createTableIfMissing: true,       // idempotente
  }),
  secret: sessionSecret || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,                      // renueva TTL en cada request activo
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  },
}));

// ── Audit middleware ──────────────────────────────────────────────────────────
app.use(auditMiddleware);

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// ── API routes (sin cambios de lógica) ───────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/dashboard',   requireAuth, require('./routes/dashboard'));
app.use('/api/projects',    requireAuth, require('./routes/projects'));
app.use('/api/contractors', requireAuth, require('./routes/contractors'));
app.use('/api/reportes',    requireAuth, require('./routes/reportes'));
app.use('/api/reports',     requireAuth, require('./routes/reports'));
app.use('/api/fuel',        requireAuth, require('./routes/fuel'));
app.use('/api/audit',       requireAuth, require('./routes/audit'));

// ── Frontend estático (solo para despliegue local/Render monolítico) ─────────
// En Vercel el frontend se sirve como sitio estático separado (ver vercel.json),
// por lo que esto queda desactivado a menos que se defina SERVE_STATIC=1.
if (process.env.SERVE_STATIC === '1') {
  const dist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

module.exports = { app, requireAuth };
