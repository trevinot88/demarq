'use strict';
/**
 * Serverless entry point de Vercel.
 * Exporta la MISMA app de Express (backend/app.js) — las rutas no cambian.
 * vercel.json enruta /api/(.*) hacia este archivo.
 */
const { app } = require('../backend/app');

module.exports = app;
