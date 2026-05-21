'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function checkWeekDetails() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Detalle de Relación Semanal 2026-05-22 ===\n');
    
    // Obtener la semana
    const { rows: weeks } = await client.query(`
      SELECT id, week_date FROM weekly_reports
      WHERE week_date = '2026-05-22'
    `);
    
    if (weeks.length === 0) {
      console.log('No se encontró la semana 2026-05-22');
      return;
    }
    
    const weekId = weeks[0].id;
    
    // Obtener todas las entradas de esta semana
    const { rows: entries } = await client.query(`
      SELECT 
        re.id,
        p.name AS project_name,
        c.name AS contractor_name,
        re.ent_a_cta,
        re.rep_a_cta,
        cpb.total_pagado_manual
      FROM report_entries re
      JOIN projects p ON p.id = re.project_id
      JOIN contractors c ON c.id = re.contractor_id
      LEFT JOIN contractor_project_budgets cpb ON cpb.contractor_id = re.contractor_id AND cpb.project_id = re.project_id
      WHERE re.report_id = $1
      ORDER BY p.name, c.name
    `, [weekId]);
    
    console.log('Proyecto → Contratista | Ent. A Cta. | Rep. A Cta. | Manual en Proyecto\n');
    console.log('─'.repeat(100) + '\n');
    
    let totalEnt = 0;
    let totalRep = 0;
    
    entries.forEach(e => {
      const fmt = (n) => n ? `$${n.toLocaleString('es-MX')}` : '$0';
      console.log(`${e.project_name} → ${e.contractor_name}`);
      console.log(`  Ent: ${fmt(e.ent_a_cta)} | Rep: ${fmt(e.rep_a_cta)} | Manual: ${fmt(e.total_pagado_manual)}`);
      
      if (e.total_pagado_manual != null && e.ent_a_cta !== e.total_pagado_manual) {
        console.log(`  ⚠️  DESINCRONIZADO: Debería ser ${fmt(e.total_pagado_manual)}`);
      }
      console.log('');
      
      totalEnt += e.ent_a_cta || 0;
      totalRep += e.rep_a_cta || 0;
    });
    
    console.log('\n' + '─'.repeat(100));
    console.log(`TOTALES: Ent. A Cta: $${totalEnt.toLocaleString('es-MX')} | Rep. A Cta: $${totalRep.toLocaleString('es-MX')}`);
    console.log('─'.repeat(100) + '\n');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkWeekDetails();
