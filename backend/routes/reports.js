'use strict';
const router = require('express').Router();
const db = require('../db');
const ExcelJS = require('exceljs');

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Actualiza el status de proyectos basado en la última semana.
 * Proyectos en la última semana → 'active'
 * Proyectos NO en la última semana → 'closed'
 */
async function updateProjectStatus(client = null) {
  const conn = client || db.pool;
  try {
    // Obtener la última semana
    const { rows: [latestWeek] } = await conn.query(`
      SELECT id FROM weekly_reports ORDER BY week_date DESC LIMIT 1
    `);

    if (!latestWeek) return; // No hay semanas, no hacer nada

    // Activar proyectos que están en la última semana
    await conn.query(`
      UPDATE projects 
      SET status = 'active' 
      WHERE id IN (
        SELECT DISTINCT project_id 
        FROM report_entries 
        WHERE report_id = $1
      )
      AND status != 'active'
    `, [latestWeek.id]);

    // Cerrar proyectos que NO están en la última semana
    await conn.query(`
      UPDATE projects 
      SET status = 'closed' 
      WHERE status = 'active' 
        AND id NOT IN (
          SELECT DISTINCT project_id 
          FROM report_entries 
          WHERE report_id = $1
        )
    `, [latestWeek.id]);
  } catch (err) {
    console.error('Error updating project status:', err.message);
  }
}

async function getReportDetail(id) {
  const report = (await db.query(`SELECT * FROM weekly_reports WHERE id = $1`, [id])).rows[0];
  if (!report) return null;

  const { rows: entries } = await db.query(`
    SELECT re.id, re.contractor_id, re.project_id,
           re.ent_a_cta, re.rep_a_cta, re.notes,
           c.name  AS contractor_name,
           p.name  AS project_name,
           COALESCE(NULLIF(re.vp, 0), cpb.valor_presupuesto, 0) AS vp
    FROM report_entries re
    JOIN contractors c ON c.id = re.contractor_id
    JOIN projects    p ON p.id = re.project_id
    LEFT JOIN contractor_project_budgets cpb
           ON cpb.contractor_id = re.contractor_id
          AND cpb.project_id   = re.project_id
    WHERE re.report_id = $1
    ORDER BY p.name, c.name
  `, [id]);

  const enriched = entries.map(e => ({
    ...e,
    saldo:       e.vp - e.ent_a_cta,
    saldo_final: e.vp - e.ent_a_cta - e.rep_a_cta,
  }));

  const projectMap = new Map();
  for (const e of enriched) {
    if (!projectMap.has(e.project_id)) {
      projectMap.set(e.project_id, { project_id: e.project_id, project_name: e.project_name, entries: [] });
    }
    projectMap.get(e.project_id).entries.push(e);
  }

  const { rows: officePayments } = await db.query(
    `SELECT * FROM office_payments WHERE report_id = $1 ORDER BY id`, [id]
  );

  const summaryMap = new Map();
  for (const e of enriched) {
    if (!summaryMap.has(e.contractor_id)) {
      summaryMap.set(e.contractor_id, { contractor_id: e.contractor_id, contractor_name: e.contractor_name, total_rep_a_cta: 0, is_office: false });
    }
    summaryMap.get(e.contractor_id).total_rep_a_cta += e.rep_a_cta;
  }
  
  // Agregar pagos de oficina al resumen
  for (const op of officePayments) {
    const key = `office_${op.person_name}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, { contractor_id: null, contractor_name: op.person_name, total_rep_a_cta: 0, is_office: true });
    }
    summaryMap.get(key).total_rep_a_cta += op.amount;
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

// ── GET /api/reports ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT wr.*,
        COALESCE(SUM(re.rep_a_cta), 0) AS total_rep_proyectos,
        COALESCE((SELECT SUM(amount) FROM office_payments op WHERE op.report_id = wr.id), 0) AS total_oficina
      FROM weekly_reports wr
      LEFT JOIN report_entries re ON re.report_id = wr.id
      GROUP BY wr.id
      ORDER BY wr.week_date DESC
    `);
    const result = rows.map(r => ({
      ...r,
      total_general: Number(r.total_rep_proyectos) + Number(r.total_oficina),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/reports ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { week_date } = req.body;
  if (!week_date) return res.status(400).json({ error: 'week_date requerido' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const exists = (await client.query(
      `SELECT id FROM weekly_reports WHERE week_date = $1`, [week_date]
    )).rows[0];
    if (exists) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Semana ya registrada' });
    }

    const reportId = (await client.query(
      `INSERT INTO weekly_reports (week_date) VALUES ($1) RETURNING id`, [week_date]
    )).rows[0].id;

    const prev = (await client.query(
      `SELECT id FROM weekly_reports WHERE week_date < $1 ORDER BY week_date DESC LIMIT 1`, [week_date]
    )).rows[0];

    const { rows: pairs } = await client.query(`
      SELECT cpb.contractor_id, cpb.project_id, cpb.valor_presupuesto
      FROM contractor_project_budgets cpb
      JOIN projects p ON p.id = cpb.project_id
      WHERE p.status = 'active'
    `);

    for (const { contractor_id, project_id, valor_presupuesto } of pairs) {
      let ent_a_cta = 0;
      
      // Primero verificar si hay un valor manual configurado en el proyecto
      const manualValue = (await client.query(
        `SELECT total_pagado_manual FROM contractor_project_budgets
         WHERE contractor_id = $1 AND project_id = $2`,
        [contractor_id, project_id]
      )).rows[0];
      
      if (manualValue && manualValue.total_pagado_manual != null) {
        // Usar el valor manual si existe
        ent_a_cta = manualValue.total_pagado_manual;
      } else if (prev) {
        // Si no hay manual, usar la suma de la semana anterior
        const prevEntry = (await client.query(
          `SELECT ent_a_cta, rep_a_cta FROM report_entries
           WHERE report_id = $1 AND contractor_id = $2 AND project_id = $3`,
          [prev.id, contractor_id, project_id]
        )).rows[0];
        if (prevEntry) ent_a_cta = prevEntry.ent_a_cta + prevEntry.rep_a_cta;
      }
      
      await client.query(`
        INSERT INTO report_entries (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
        VALUES ($1, $2, $3, $4, $5, 0, '')
        ON CONFLICT (report_id, contractor_id, project_id) DO NOTHING
      `, [reportId, contractor_id, project_id, valor_presupuesto || 0, ent_a_cta]);
    }

    await client.query('COMMIT');
    await updateProjectStatus(); // Actualizar status de proyectos
    res.status(201).json({ id: reportId, week_date });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/reports/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const detail = await getReportDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Semana no encontrada' });
    res.json(detail);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/reports/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Desvincular advancement_reports primero (FK constraint)
    await client.query(`
      UPDATE advancement_reports 
      SET weekly_report_id = NULL 
      WHERE weekly_report_id = $1
    `, [req.params.id]);
    
    // Eliminar entries (FK constraint)
    await client.query(`DELETE FROM report_entries WHERE report_id = $1`, [req.params.id]);
    
    // Eliminar office payments (FK constraint)
    await client.query(`DELETE FROM office_payments WHERE report_id = $1`, [req.params.id]);
    
    // Ahora sí eliminar el weekly report
    await client.query(`DELETE FROM weekly_reports WHERE id = $1`, [req.params.id]);
    
    await client.query('COMMIT');
    await updateProjectStatus(); // Actualizar status de proyectos
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/reports/:id/entries/:entryId ────────────────────────────────────
router.put('/:id/entries/:entryId', async (req, res) => {
  try {
    const { ent_a_cta, rep_a_cta, notes, vp } = req.body;
    
    // Obtener los datos de la entrada actual
    const { rows: entryData } = await db.query(`
      SELECT contractor_id, project_id FROM report_entries
      WHERE id = $1 AND report_id = $2
    `, [req.params.entryId, req.params.id]);
    
    if (!entryData.length) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }
    
    const { contractor_id, project_id } = entryData[0];
    
    // Actualizar la entrada de la relación semanal
    await db.query(`
      UPDATE report_entries
         SET ent_a_cta = COALESCE($1, ent_a_cta),
             rep_a_cta = COALESCE($2, rep_a_cta),
             notes     = COALESCE($3, notes),
             vp        = COALESCE($4, vp)
       WHERE id = $5 AND report_id = $6
    `, [ent_a_cta ?? null, rep_a_cta ?? null, notes ?? null, vp ?? null, req.params.entryId, req.params.id]);
    
    // Si se editó ent_a_cta, actualizar el total_pagado_manual en el proyecto
    if (ent_a_cta !== undefined && ent_a_cta !== null) {
      await db.query(`
        UPDATE contractor_project_budgets
        SET total_pagado_manual = $1
        WHERE contractor_id = $2 AND project_id = $3
      `, [ent_a_cta, contractor_id, project_id]);
    }
    
    // Si se editó VP, actualizar el valor_presupuesto en el proyecto
    if (vp !== undefined && vp !== null) {
      await db.query(`
        INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto)
        VALUES ($1, $2, $3)
        ON CONFLICT (contractor_id, project_id) 
        DO UPDATE SET valor_presupuesto = EXCLUDED.valor_presupuesto
      `, [contractor_id, project_id, vp]);
    }
    
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/reports/:id/entries ─────────────────────────────────────────────
router.post('/:id/entries', async (req, res) => {
  const { contractor_id, project_id, ent_a_cta = 0, rep_a_cta = 0, notes = '', vp } = req.body;
  if (!contractor_id || !project_id) return res.status(400).json({ error: 'contractor_id y project_id requeridos' });
  try {
    if (vp !== undefined) {
      await db.query(`
        INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto)
        VALUES ($1, $2, $3)
        ON CONFLICT (contractor_id, project_id) DO UPDATE SET valor_presupuesto = EXCLUDED.valor_presupuesto
      `, [contractor_id, project_id, vp]);
    }
    const { rows } = await db.query(`
      INSERT INTO report_entries (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [req.params.id, contractor_id, project_id, vp || 0, ent_a_cta, rep_a_cta, notes]);
    await updateProjectStatus(); // Actualizar status de proyectos
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    res.status(409).json({ error: 'Entrada ya existe para ese contratista/proyecto' });
  }
});

// ── DELETE /api/reports/:id/entries/:entryId ──────────────────────────────────
router.delete('/:id/entries/:entryId', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM report_entries WHERE id = $1 AND report_id = $2`,
      [req.params.entryId, req.params.id]
    );
    await updateProjectStatus(); // Actualizar status de proyectos
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/reports/history/:contractorId/:projectId ─────────────────────────
router.get('/history/:contractorId/:projectId', async (req, res) => {
  try {
    const { contractorId, projectId } = req.params;
    const { rows } = await db.query(`
      SELECT 
        wr.week_date,
        re.rep_a_cta,
        re.notes
      FROM report_entries re
      JOIN weekly_reports wr ON wr.id = re.report_id
      WHERE re.contractor_id = $1 AND re.project_id = $2
        AND re.rep_a_cta > 0
      ORDER BY wr.week_date ASC
    `, [contractorId, projectId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/reports/:id/office ──────────────────────────────────────────────
router.post('/:id/office', async (req, res) => {
  try {
    const { person_name, amount } = req.body;
    if (!person_name) return res.status(400).json({ error: 'person_name requerido' });
    const { rows } = await db.query(
      `INSERT INTO office_payments (report_id, person_name, amount) VALUES ($1, $2, $3) RETURNING id`,
      [req.params.id, person_name, amount || 0]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/reports/:id/office/:payId ───────────────────────────────────────
router.put('/:id/office/:payId', async (req, res) => {
  try {
    const { person_name, amount } = req.body;
    await db.query(`
      UPDATE office_payments
         SET person_name = COALESCE($1, person_name),
             amount      = COALESCE($2, amount)
       WHERE id = $3 AND report_id = $4
    `, [person_name ?? null, amount ?? null, req.params.payId, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/reports/:id/office/:payId ────────────────────────────────────
router.delete('/:id/office/:payId', async (req, res) => {
  try {
    await db.query(
      `DELETE FROM office_payments WHERE id = $1 AND report_id = $2`,
      [req.params.payId, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// ── GET /api/reports/:id/export — xlsx ──────────────────────────────────────
router.get('/:id/export', async (req, res) => {
  try {
    const detail = await getReportDetail(req.params.id);
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
