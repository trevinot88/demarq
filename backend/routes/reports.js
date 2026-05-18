'use strict';
const router = require('express').Router();
const db = require('../db');
const ExcelJS = require('exceljs');

// ── Helpers ───────────────────────────────────────────────────────────────────
function getReportDetail(id) {
  const report = db.prepare(`SELECT * FROM weekly_reports WHERE id = ?`).get(id);
  if (!report) return null;

  const entries = db.prepare(`
    SELECT re.id, re.contractor_id, re.project_id,
           re.ent_a_cta, re.rep_a_cta, re.notes,
           c.name  AS contractor_name,
           p.name  AS project_name,
           COALESCE(cpb.valor_presupuesto, 0) AS vp
    FROM report_entries re
    JOIN contractors c ON c.id = re.contractor_id
    JOIN projects    p ON p.id = re.project_id
    LEFT JOIN contractor_project_budgets cpb
           ON cpb.contractor_id = re.contractor_id
          AND cpb.project_id   = re.project_id
    WHERE re.report_id = ?
    ORDER BY p.name, c.name
  `).all(id);

  const enriched = entries.map(e => ({
    ...e,
    saldo:       e.vp - e.ent_a_cta,
    saldo_final: e.vp - e.ent_a_cta - e.rep_a_cta,
  }));

  // Agrupar por proyecto
  const projectMap = new Map();
  for (const e of enriched) {
    if (!projectMap.has(e.project_id)) {
      projectMap.set(e.project_id, { project_id: e.project_id, project_name: e.project_name, entries: [] });
    }
    projectMap.get(e.project_id).entries.push(e);
  }

  const officePayments = db.prepare(
    `SELECT * FROM office_payments WHERE report_id = ? ORDER BY id`
  ).all(id);

  // Resumen por contratista (suma todos sus proyectos)
  const summaryMap = new Map();
  for (const e of enriched) {
    if (!summaryMap.has(e.contractor_id)) {
      summaryMap.set(e.contractor_id, { contractor_id: e.contractor_id, contractor_name: e.contractor_name, total_rep_a_cta: 0 });
    }
    summaryMap.get(e.contractor_id).total_rep_a_cta += e.rep_a_cta;
  }
  const summary = [...summaryMap.values()]
    .filter(s => s.total_rep_a_cta > 0)
    .sort((a, b) => b.total_rep_a_cta - a.total_rep_a_cta);

  const total_projects = enriched.reduce((s, e) => s + e.rep_a_cta, 0);
  const total_office   = officePayments.reduce((s, o) => s + o.amount, 0);

  return {
    report,
    projects: [...projectMap.values()],
    office_payments: officePayments,
    summary,
    total_projects,
    total_office,
    total_general: total_projects + total_office,
  };
}

// ── GET /api/reports  ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT wr.*,
      COALESCE(SUM(re.rep_a_cta), 0) AS total_rep_proyectos,
      COALESCE((SELECT SUM(amount) FROM office_payments op WHERE op.report_id = wr.id), 0) AS total_oficina
    FROM weekly_reports wr
    LEFT JOIN report_entries re ON re.report_id = wr.id
    GROUP BY wr.id
    ORDER BY wr.week_date DESC
  `).all();
  const result = rows.map(r => ({
    ...r,
    total_general: r.total_rep_proyectos + r.total_oficina,
  }));
  res.json(result);
});

// ── POST /api/reports  ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { week_date } = req.body;
  if (!week_date) return res.status(400).json({ error: 'week_date requerido' });

  const exists = db.prepare(`SELECT id FROM weekly_reports WHERE week_date = ?`).get(week_date);
  if (exists) return res.status(409).json({ error: 'Semana ya registrada' });

  const reportId = db.prepare(`INSERT INTO weekly_reports (week_date) VALUES (?)`).run(week_date).lastInsertRowid;

  // Semana anterior
  const prev = db.prepare(`
    SELECT id FROM weekly_reports WHERE week_date < ? ORDER BY week_date DESC LIMIT 1
  `).get(week_date);

  // Todos los pares contratista-proyecto activos
  const pairs = db.prepare(`
    SELECT cpb.contractor_id, cpb.project_id
    FROM contractor_project_budgets cpb
    JOIN projects p ON p.id = cpb.project_id
    WHERE p.status = 'active'
  `).all();

  const insEntry = db.prepare(`
    INSERT OR IGNORE INTO report_entries (report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes)
    VALUES (?, ?, ?, ?, 0, '')
  `);

  for (const { contractor_id, project_id } of pairs) {
    let ent_a_cta = 0;
    if (prev) {
      const prevEntry = db.prepare(`
        SELECT ent_a_cta, rep_a_cta FROM report_entries
        WHERE report_id = ? AND contractor_id = ? AND project_id = ?
      `).get(prev.id, contractor_id, project_id);
      if (prevEntry) {
        ent_a_cta = prevEntry.ent_a_cta + prevEntry.rep_a_cta;
      }
    }
    insEntry.run(reportId, contractor_id, project_id, ent_a_cta);
  }

  res.status(201).json({ id: reportId, week_date });
});

// ── GET /api/reports/:id  ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const detail = getReportDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Semana no encontrada' });
  res.json(detail);
});

// ── DELETE /api/reports/:id  ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM weekly_reports WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ── PUT /api/reports/:id/entries/:entryId  ────────────────────────────────────
router.put('/:id/entries/:entryId', (req, res) => {
  const { ent_a_cta, rep_a_cta, notes } = req.body;
  db.prepare(`
    UPDATE report_entries
       SET ent_a_cta = COALESCE(?, ent_a_cta),
           rep_a_cta = COALESCE(?, rep_a_cta),
           notes     = COALESCE(?, notes)
     WHERE id = ? AND report_id = ?
  `).run(ent_a_cta, rep_a_cta, notes, req.params.entryId, req.params.id);
  res.json({ ok: true });
});

// ── POST /api/reports/:id/entries  — agregar contratista ad-hoc ───────────────
router.post('/:id/entries', (req, res) => {
  const { contractor_id, project_id, ent_a_cta = 0, rep_a_cta = 0, notes = '', vp } = req.body;
  if (!contractor_id || !project_id) return res.status(400).json({ error: 'contractor_id y project_id requeridos' });

  // Actualizar VP si se envió
  if (vp !== undefined) {
    db.prepare(`
      INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto)
      VALUES (?, ?, ?)
      ON CONFLICT(contractor_id, project_id) DO UPDATE SET valor_presupuesto = excluded.valor_presupuesto
    `).run(contractor_id, project_id, vp);
  }

  try {
    const r = db.prepare(`
      INSERT INTO report_entries (report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(409).json({ error: 'Entrada ya existe para ese contratista/proyecto' });
  }
});

// ── DELETE /api/reports/:id/entries/:entryId  ────────────────────────────────
router.delete('/:id/entries/:entryId', (req, res) => {
  db.prepare(`DELETE FROM report_entries WHERE id = ? AND report_id = ?`).run(req.params.entryId, req.params.id);
  res.json({ ok: true });
});

// ── POST /api/reports/:id/office  ────────────────────────────────────────────
router.post('/:id/office', (req, res) => {
  const { person_name, amount } = req.body;
  if (!person_name) return res.status(400).json({ error: 'person_name requerido' });
  const r = db.prepare(
    `INSERT INTO office_payments (report_id, person_name, amount) VALUES (?, ?, ?)`
  ).run(req.params.id, person_name, amount || 0);
  res.status(201).json({ id: r.lastInsertRowid });
});

// ── PUT /api/reports/:id/office/:payId  ──────────────────────────────────────
router.put('/:id/office/:payId', (req, res) => {
  const { person_name, amount } = req.body;
  db.prepare(`
    UPDATE office_payments
       SET person_name = COALESCE(?, person_name),
           amount      = COALESCE(?, amount)
     WHERE id = ? AND report_id = ?
  `).run(person_name, amount, req.params.payId, req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/reports/:id/office/:payId  ───────────────────────────────────
router.delete('/:id/office/:payId', (req, res) => {
  db.prepare(`DELETE FROM office_payments WHERE id = ? AND report_id = ?`).run(req.params.payId, req.params.id);
  res.json({ ok: true });
});

// ── GET /api/reports/:id/export  — xlsx  ─────────────────────────────────────
router.get('/:id/export', async (req, res) => {
  const detail = getReportDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Semana no encontrada' });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Constructor Admin';
  const ws = wb.addWorksheet('Relación Semanal');

  // ── Estilos ──────────────────────────────────────────────────────
  const navyFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
  const grayFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  const redFont   = { color: { argb: 'FFCC0000' } };
  const greenFont = { color: { argb: 'FF006600' } };
  const grayFont  = { color: { argb: 'FF888888' } };
  const whiteFont = { bold: true, color: { argb: 'FFFFFFFF' } };
  const mxnFmt    = '"$"#,##0.00';
  const center    = { horizontal: 'center' };

  ws.columns = [
    { key: 'proyecto',    width: 30 },
    { key: 'contratista', width: 28 },
    { key: 'vp',          width: 16 },
    { key: 'ent_a_cta',   width: 16 },
    { key: 'saldo',       width: 16 },
    { key: 'rep_a_cta',   width: 16 },
    { key: 'saldo_final', width: 16 },
    { key: 'notas',       width: 35 },
  ];

  // Título
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `RELACIÓN SEMANAL — ${detail.report.week_date}`;
  titleCell.font  = { bold: true, size: 14, color: { argb: 'FF1A1A2E' } };
  titleCell.alignment = center;
  ws.getRow(1).height = 28;

  // Encabezados
  const hdrs = ['PROYECTO','CONTRATISTA','V.P.','ENT. A CTA.','SALDO','REP. A CTA.','SALDO FINAL','NOTAS'];
  const hRow = ws.addRow(hdrs);
  hRow.eachCell(cell => {
    cell.fill      = navyFill;
    cell.font      = whiteFont;
    cell.alignment = center;
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FFE94560' } } };
  });
  hRow.height = 22;

  // Datos por proyecto
  for (const proj of detail.projects) {
    const pRow = ws.addRow([proj.project_name]);
    pRow.getCell(1).font      = { bold: true, color: { argb: 'FF1A1A2E' } };
    pRow.getCell(1).fill      = grayFill;
    pRow.height = 18;

    for (const e of proj.entries) {
      const row = ws.addRow(['', e.contractor_name, e.vp, e.ent_a_cta, e.saldo, e.rep_a_cta, e.saldo_final, e.notes || '']);
      [3,4,5,6,7].forEach(col => { row.getCell(col).numFmt = mxnFmt; });
      const sf = row.getCell(7);
      if (e.saldo_final < 0)     sf.font = redFont;
      else if (e.saldo_final === 0) sf.font = grayFont;
      else                        sf.font = greenFont;
    }
  }

  // Oficina
  ws.addRow([]);
  const oHdr = ws.addRow(['OFICINA']);
  oHdr.getCell(1).font = { bold: true };
  oHdr.getCell(1).fill = grayFill;

  for (const op of detail.office_payments) {
    const row = ws.addRow(['', op.person_name, '', '', '', op.amount]);
    row.getCell(6).numFmt = mxnFmt;
  }

  // Total oficina
  const toRow = ws.addRow(['', 'TOTAL OFICINA', '', '', '', detail.total_office]);
  toRow.getCell(6).numFmt  = mxnFmt;
  toRow.getCell(6).font    = { bold: true };

  // Resumen
  ws.addRow([]);
  const sumHdr = ws.addRow(['RESUMEN — CONTRATISTAS']);
  sumHdr.getCell(1).font = { bold: true };
  sumHdr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE94560' } };
  sumHdr.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const s of detail.summary) {
    const row = ws.addRow(['', s.contractor_name, '', '', '', s.total_rep_a_cta]);
    row.getCell(6).numFmt = mxnFmt;
  }

  ws.addRow([]);
  const tRow = ws.addRow(['', 'TOTAL GENERAL', '', '', '', detail.total_general]);
  tRow.getCell(6).numFmt = mxnFmt;
  tRow.getCell(6).font   = { bold: true, size: 12 };

  // Hoja resumen
  const ws2 = wb.addWorksheet('Resumen');
  ws2.columns = [{ width: 30 }, { width: 18 }];
  ws2.addRow(['CONTRATISTA', 'REP. A CTA.']).eachCell(c => {
    c.font = whiteFont; c.fill = navyFill;
  });
  for (const s of detail.summary) {
    const row = ws2.addRow([s.contractor_name, s.total_rep_a_cta]);
    row.getCell(2).numFmt = mxnFmt;
  }
  const t2 = ws2.addRow(['TOTAL', detail.total_general]);
  t2.getCell(2).numFmt = mxnFmt; t2.getCell(2).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="relacion-${detail.report.week_date}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
