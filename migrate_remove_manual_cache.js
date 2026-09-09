'use strict';
/**
 * 🔒 MIGRACIÓN — Eliminar la dualidad de fuentes de verdad del total pagado.
 *
 * ANTES: contractor_project_budgets.total_pagado_manual (cache congelado)
 *        competía con la cadena semanal (report_entries.ent_a_cta+rep_a_cta)
 *        vía Math.max, TOPANDO la herencia entre semanas y descartando el
 *        rep_a_cta reportado (el bug: "la semana siguiente vuelve a 0").
 *
 * AHORA: la cadena semanal es la ÚNICA fuente de verdad. Este script:
 *   1. Para cada par con total_pagado_manual NOT NULL:
 *        - Si manual > acumulado de la cadena (ent+rep de la entrada más
 *          reciente) → sube rep_a_cta de la entrada más reciente en la
 *          diferencia, de modo que ent+rep = manual (el pago manual se
 *          INCORPORA a la cadena, no se pierde). Recalcula vp de esa entrada.
 *        - Si el par NO tiene entrada en la semana más reciente → crea una
 *          con ent_a_cta = 0 y rep_a_cta = manual.
 *        - Si manual <= cadena → no toca nada (la cadena ya va adelante).
 *   2. Descongela el cache: UPDATE ... SET total_pagado_manual = NULL.
 *
 * Uso:   node migrate_remove_manual_cache.js            (simulación)
 *        node migrate_remove_manual_cache.js --apply    (aplica cambios)
 */
const db = require('./backend/db');

const APPLY = process.argv.includes('--apply');
const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-MX');

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const manualRows = (await client.query(`
      SELECT cpb.contractor_id, cpb.project_id, cpb.total_pagado_manual,
             p.name AS project_name, c.name AS contractor_name,
             cpb.valor_presupuesto,
             COALESCE((SELECT SUM(amount) FROM contractor_project_extras cpe
                       WHERE cpe.contractor_id = cpb.contractor_id
                         AND cpe.project_id   = cpb.project_id), 0) AS extras
      FROM contractor_project_budgets cpb
      JOIN projects    p ON p.id = cpb.project_id
      JOIN contractors c ON c.id = cpb.contractor_id
      WHERE cpb.total_pagado_manual IS NOT NULL
      ORDER BY p.name, c.name
    `)).rows;

    if (!manualRows.length) {
      console.log('✅ No hay valores total_pagado_manual congelados. Nada que migrar.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`\n═══ MIGRACIÓN: ${manualRows.length} par(es) con total_pagado_manual congelado ${APPLY ? '— APLICANDO' : '— SIMULACIÓN (usa --apply)'} ═══\n`);

    let migrated = 0, skipped = 0, created = 0;
    for (const r of manualRows) {
      const label = `${r.project_name} / ${r.contractor_name}`;
      const vpTotal = (Number(r.valor_presupuesto) || 0) + (Number(r.extras) || 0);
      const manual = Number(r.total_pagado_manual) || 0;

      const latestWeek = (await client.query(`
        SELECT wr.id AS report_id, wr.week_date
        FROM weekly_reports wr
        WHERE wr.week_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        ORDER BY TO_DATE(wr.week_date, 'YYYY-MM-DD') DESC
        LIMIT 1
      `)).rows[0];

      if (!latestWeek) {
        console.log(`  ⚠️  ${label}: no hay semanas en la BD. Se descongela el cache sin incorporar (no hay dónde registrar).`);
        skipped++;
        continue;
      }

      const entry = (await client.query(`
        SELECT id, ent_a_cta, rep_a_cta, vp
        FROM report_entries
        WHERE report_id = $1 AND contractor_id = $2 AND project_id = $3
      `, [latestWeek.report_id, r.contractor_id, r.project_id])).rows[0];

      const acumulado = entry ? (Number(entry.ent_a_cta) || 0) + (Number(entry.rep_a_cta) || 0) : 0;

      if (manual <= acumulado + 0.01) {
        console.log(`  ✓ ${label}: cadena=${fmt(acumulado)} >= manual=${fmt(manual)} → sin cambio (la cadena manda).`);
        skipped++;
        continue;
      }

      const diff = manual - acumulado;

      if (entry) {
        const newRep = (Number(entry.rep_a_cta) || 0) + diff;
        const newVp = vpTotal - (Number(entry.ent_a_cta) || 0);
        console.log(`  ↺ ${label}: cadena=${fmt(acumulado)} → ${fmt(manual)} (rep ${fmt(entry.rep_a_cta)} → ${fmt(newRep)}, vp → ${fmt(newVp)}) [semana ${latestWeek.week_date}]`);
        if (APPLY) {
          await client.query(
            `UPDATE report_entries SET rep_a_cta = $1, vp = $2 WHERE id = $3`,
            [newRep, newVp, entry.id]
          );
        }
        migrated++;
      } else {
        const vpInicial = vpTotal - manual;
        console.log(`  + ${label}: SIN entrada en semana ${latestWeek.week_date} → se crea con rep=${fmt(manual)}, ent=0, vp=${fmt(vpInicial)}`);
        if (APPLY) {
          await client.query(`
            INSERT INTO report_entries (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
            VALUES ($1, $2, $3, $4, 0, $5, 'Migración: pago manual incorporado a la cadena')
            ON CONFLICT (report_id, contractor_id, project_id) DO NOTHING
          `, [latestWeek.report_id, r.contractor_id, r.project_id, vpInicial, manual]);
        }
        created++;
      }
    }

    if (APPLY) {
      const { rowCount } = await client.query(
        `UPDATE contractor_project_budgets SET total_pagado_manual = NULL`
      );
      console.log(`\n  🔓 total_pagado_manual descongelado (NULL) en ${rowCount} fila(s).`);
      await client.query('COMMIT');
      console.log(`\n✅ Migración aplicada: incorporados=${migrated}, creados=${created}, sin cambio=${skipped}.`);
    } else {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS c FROM contractor_project_budgets WHERE total_pagado_manual IS NOT NULL`
      );
      console.log(`\n  (simulación) Se descongelarían ${rows[0].c} fila(s).`);
      await client.query('ROLLBACK');
      console.log(`\nℹ️  SIMULACIÓN completada (nada se modificó): incorporarías=${migrated}, crearías=${created}, sin cambio=${skipped}.`);
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