'use strict';
/**
 * Launcher local (dev / Render monolítico). En Vercel la app se consume
 * como Serverless Function a través de /api/index.js — este archivo no
 * se ejecuta ahí.
 */
const { app } = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🏗️  Constructor Admin → http://localhost:${PORT}`)
);

