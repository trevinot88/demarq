'use strict';
/**
 * 🔒 MIGRACIÓN — Corregir report_entries.vp: de "saldo pendiente" a "presupuesto total".
 *
 * ANTES (bug): al crear semanas desde la app, report_entries.vp guardaba el
 *   SALDO pendiente (VP_TOTAL − pagos acumulados) en lugar del PRESUPUESTO.
 *   Por eso la columna "V.P." de la Relación Semanal mostraba el saldo y el
 *   cálculo "Saldo = V.P. − Ent. A Cta." quedaba mal.
 *
 * AHORA: report_entries.vp = VP_TOTAL (valor_presupuesto + extras), que es lo
 *   que la columna "V.P." debe mostrar. El saldo se deriva en la vista como
 *   vp − ent_a_cta − rep_a_cta.
 *
 * Este script reescribe vp = VP_TOTAL (presupuesto actual del par) en todas las
 * entradas semanales. Nota: si el presupuesto cambió con el tiempo, las semanas
 * históricas pasan a mostrar el presupuesto ACTUAL (aproximación razonable:
 * la columna V.P. representa el presupuesto vigente del contrato).
 *
 * Uso:   node migrate_fix_vp_presupuesto.js            (simulación)
 *        node migrate_fix_vp_presupuesto.js --apply    (aplica cambios)
 */
const db = require('./backend/db');

const APPLY = process.argv.includes('--apply');
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-MX');

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Pares con presupuesto y su VP_TOTAL actual (base + extras)
    const pairs = (await client.query(`
      SELECT cpb.contractor_id, cpb.project_id,
             p.name AS project_name, c.name AS contractor_name,
             cpb.valor_presupuesto,
             COALESCE((SELECT SUM(amount) FROM contractor_project_extras cpe
                       WHERE cpe.contractor_id = cpb.contractor_id
                         AND cpe.project_id   = cpb.project_id), 0) AS extras
      FROM contractor_project_budgets cpb
      JOIN projects    p ON p.id = cpb.project_id
      JOIN contractors c ON c.id = cpb.contractor_id
      ORDER BY p.name, c.name
    `)).rows;

    if (!pairs.length) {
      console.log('✅ No hay pares con presupuesto. Nada que migrar.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`\n═══ MIGRACIÓN VP: ${pairs.length} par(es) a revisar ${APPLY ? '— APLICANDO' : '— SIMULACIÓN (usa --apply)'} ═══\n`);

    let fixed = 0, ok = 0, noEntries = 0;
    for (const r of pairs) {
      const label = `${r.project_name} / ${r.contractor_name}`;
      const vpTotal = (Number(r.valor_presupuesto) || 0) + (Number(r.extras) || 0);

      const entries = (await client.query(`
        SELECT id, vp FROM report_entries
        WHERE contractor_id = $1 AND project_id = $2
      `, [r.contractor_id, r.project_id])).rows;

      if (!entries.length) { noEntries++; continue; }

      for (const e of entries) {
        if (Math.abs((Number(e.vp) || 0) - vpTotal) < 0.01) {
          ok++;
          continue;
        }
        console.log(`  ↺ ${label}: entry ${e.id} vp ${fmt(e.vp)} → ${fmt(vpTotal)}`);
        if (APPLY) {
          await client.query(`UPDATE report_entries SET vp = $1 WHERE id = $2`, [vpTotal, e.id]);
        }
        fixed++;
      }
    }

    if (APPLY) {
      await client.query('COMMIT');
      console.log(`\n✅ Migración aplicada: ${fixed} entrada(s) corregida(s), ${ok} ya correcta(s), ${noEntries} par(es) sin entradas.`);
    } else {
      await client.query('ROLLBACK');
      console.log(`\nℹ️  SIMULACIÓN completada (nada se modificó): corregirías ${fixed} entrada(s), ${ok} ya correcta(s), ${noEntries} par(es) sin entradas.`);
      console.log('   Ejecuta con --apply para aplicar los cambios.');
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('⛔ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
})();
