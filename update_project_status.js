'use strict';
/**
 * Actualiza el status de proyectos basado en la última semana de reporte.
 * - Proyectos con entradas en la última semana → status = 'active'
 * - Proyectos sin entradas en la última semana → status = 'closed'
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function updateProjectStatus() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener la última semana
    const { rows: [latestWeek] } = await client.query(`
      SELECT id, week_date FROM weekly_reports ORDER BY week_date DESC LIMIT 1
    `);

    if (!latestWeek) {
      console.log('No hay semanas registradas.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`\n📅 Última semana: ${latestWeek.week_date} (ID ${latestWeek.id})\n`);

    // Proyectos en la última semana
    const { rows: activeProjects } = await client.query(`
      SELECT DISTINCT p.id, p.name
      FROM projects p
      JOIN report_entries re ON re.project_id = p.id
      WHERE re.report_id = $1
      ORDER BY p.name
    `, [latestWeek.id]);

    const activeIds = activeProjects.map(p => p.id);

    // Activar proyectos que están en la última semana
    if (activeIds.length > 0) {
      const { rowCount: activated } = await client.query(`
        UPDATE projects 
        SET status = 'active' 
        WHERE id = ANY($1) AND status != 'active'
      `, [activeIds]);

      console.log(`✅ Proyectos ACTIVOS (en última semana): ${activeProjects.length}`);
      activeProjects.forEach(p => console.log(`   • ${p.name}`));
      if (activated > 0) console.log(`   → ${activated} proyecto(s) reactivado(s)`);
    }

    // Desactivar proyectos que NO están en la última semana
    const { rows: inactiveProjects, rowCount: deactivated } = await client.query(`
      UPDATE projects 
      SET status = 'closed' 
      WHERE status = 'active' 
        AND id NOT IN (
          SELECT DISTINCT project_id 
          FROM report_entries 
          WHERE report_id = $1
        )
      RETURNING id, name
    `, [latestWeek.id]);

    if (inactiveProjects.length > 0) {
      console.log(`\n⏸️  Proyectos CERRADOS (no en última semana): ${deactivated}`);
      inactiveProjects.forEach(p => console.log(`   • ${p.name}`));
    } else {
      console.log(`\n✓ No hay proyectos para cerrar`);
    }

    await client.query('COMMIT');
    console.log('\n─────────────────────────────────────────────');
    console.log('✅ Status de proyectos actualizado');
    console.log('─────────────────────────────────────────────\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

updateProjectStatus().catch(() => process.exit(1));
