'use strict';
// Suppress the node:sqlite experimental warning in production
process.on('warning', w => {
  if (w.name === 'ExperimentalWarning' && w.message.includes('SQLite')) return;
  console.warn(w.name, w.message);
});

const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // initialise schema on startup

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = process.env.NODE_ENV === 'production'
  ? { origin: 'https://demarq.onrender.com' }
  : {};
app.use(cors(corsOptions));
app.use(express.json());

// ── API routes ──────────────────────────────────────────────
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/projects',    require('./routes/projects'));
app.use('/api/contractors', require('./routes/contractors'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/fuel',        require('./routes/fuel'));

// ── Frontend (production) ───────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () =>
  console.log(`🏗️  Constructor Admin → http://localhost:${PORT}`)
);
