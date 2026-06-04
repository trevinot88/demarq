#!/usr/bin/env node
'use strict';

/**
 * Script para actualizar los VPs de todas las relaciones semanales existentes
 * para incluir los extras que ya fueron agregados.
 */

const { Pool } = require('pg');

// Usar la URL de la base de datos directamente
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://demarq_db_user:0ZmtY5cNQ38wFD7uHsPHdhmOfpujTefF@dpg-d85p79vavr4c73d5eglg-a.oregon-postgres.render.com/demarq_db';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateAllVPs() {
  const client = await pool.connect();
  try {
    console.log('🔄 Actualizando VPs en todas las relaciones semanales...\n');

    // Obtener todas las combinaciones únicas de contractor_id y project_id en report_entries
    const { rows: pairs } = await client.query(`
      SELECT DISTINCT contractor_id, project_id
      FROM report_entries
    `);

    console.log(`📊 Encontradas ${pairs.length} combinaciones de contratista-proyecto\n`);

    for (const { contractor_id, project_id } of pairs) {
      // Calcular VP total (base + extras)
      const { rows: [vpData] } = await client.query(`
        SELECT 
          cpb.valor_presupuesto,
          COALESCE(
            (SELECT SUM(amount) FROM contractor_project_extras cpe
             WHERE cpe.contractor_id = $1 AND cpe.project_id = $2), 0
          ) AS total_extras,
          cpb.valor_presupuesto + COALESCE(
            (SELECT SUM(amount) FROM contractor_project_extras cpe
             WHERE cpe.contractor_id = $1 AND cpe.project_id = $2), 0
          ) AS total_vp,
          c.name AS contractor_name,
          p.name AS project_name
        FROM contractor_project_budgets cpb
        JOIN contractors c ON c.id = cpb.contractor_id
        JOIN projects p ON p.id = cpb.project_id
        WHERE cpb.contractor_id = $1 AND cpb.project_id = $2
      `, [contractor_id, project_id]);

      if (!vpData) {
        console.log(`⚠️  No se encontró presupuesto para contractor_id=${contractor_id}, project_id=${project_id}`);
        continue;
      }

      const { valor_presupuesto, total_extras, total_vp, contractor_name, project_name } = vpData;

      // Actualizar VP en todas las entries de este contratista/proyecto
      const { rowCount } = await client.query(`
        UPDATE report_entries
        SET vp = $1
        WHERE contractor_id = $2 AND project_id = $3
      `, [total_vp, contractor_id, project_id]);

      if (total_extras > 0) {
        console.log(`✅ ${contractor_name} → ${project_name}`);
        console.log(`   VP Base: $${valor_presupuesto.toLocaleString()}`);
        console.log(`   Extras:  $${total_extras.toLocaleString()}`);
        console.log(`   VP Total: $${total_vp.toLocaleString()}`);
        console.log(`   Semanas actualizadas: ${rowCount}\n`);
      }
    }

    console.log('\n✅ Actualización completada');
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

updateAllVPs().catch(err => {
  console.error(err);
  process.exit(1);
});
