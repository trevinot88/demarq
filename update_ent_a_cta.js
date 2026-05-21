'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function updateEntACta() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Actualizando Ent. A Cta. en todas las semanas ===\n');
    
    // Obtener todas las semanas ordenadas por fecha
    const { rows: weeks } = await client.query(`
      SELECT id, week_date FROM weekly_reports
      ORDER BY week_date ASC
    `);
    
    if (weeks.length === 0) {
      console.log('No hay semanas para actualizar.');
      return;
    }
    
    console.log(`Encontradas ${weeks.length} semanas.\n`);
    
    let totalUpdated = 0;
    
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      const prevWeek = i > 0 ? weeks[i - 1] : null;
      
      console.log(`Procesando semana ${week.week_date}...`);
      
      // Obtener todas las entradas de esta semana
      const { rows: entries } = await client.query(`
        SELECT re.id, re.contractor_id, re.project_id, re.ent_a_cta, re.rep_a_cta
        FROM report_entries re
        WHERE re.report_id = $1
      `, [week.id]);
      
      for (const entry of entries) {
        let newEntACta = 0;
        
        // 1. Verificar si hay valor manual en el proyecto
        const { rows: manual } = await client.query(`
          SELECT total_pagado_manual FROM contractor_project_budgets
          WHERE contractor_id = $1 AND project_id = $2
        `, [entry.contractor_id, entry.project_id]);
        
        if (manual[0] && manual[0].total_pagado_manual != null) {
          // Usar el valor manual
          newEntACta = manual[0].total_pagado_manual;
        } else if (prevWeek) {
          // Si no hay manual, usar la suma de la semana anterior
          const { rows: prevEntry } = await client.query(`
            SELECT ent_a_cta, rep_a_cta FROM report_entries
            WHERE report_id = $1 AND contractor_id = $2 AND project_id = $3
          `, [prevWeek.id, entry.contractor_id, entry.project_id]);
          
          if (prevEntry[0]) {
            newEntACta = prevEntry[0].ent_a_cta + prevEntry[0].rep_a_cta;
          }
        }
        
        // Actualizar solo si cambió
        if (newEntACta !== entry.ent_a_cta) {
          await client.query(`
            UPDATE report_entries
            SET ent_a_cta = $1
            WHERE id = $2
          `, [newEntACta, entry.id]);
          
          console.log(`  ✓ Actualizado entry ID ${entry.id}: $${entry.ent_a_cta} → $${newEntACta}`);
          totalUpdated++;
        }
      }
    }
    
    console.log(`\n✓ Actualización completa: ${totalUpdated} entradas modificadas.\n`);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateEntACta();
