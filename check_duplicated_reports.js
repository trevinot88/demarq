'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function checkDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Verificando reportes de avance pasados ===\n');
    
    // Verificar reportes que ya fueron pasados
    const { rows: passed } = await client.query(`
      SELECT ar.id, ar.weekly_report_id, ar.status,
             c.name AS contractor_name, p.name AS project_name,
             ar.amount_reported, ar.amount_accepted,
             wr.week_date
      FROM advancement_reports ar
      JOIN contractors c ON c.id = ar.contractor_id
      JOIN projects p ON p.id = ar.project_id
      LEFT JOIN weekly_reports wr ON wr.id = ar.weekly_report_id
      WHERE ar.weekly_report_id IS NOT NULL
      ORDER BY ar.id
    `);
    
    console.log(`Reportes ya pasados a relación semanal: ${passed.length}\n`);
    
    passed.forEach(r => {
      const amount = r.amount_accepted ?? r.amount_reported;
      console.log(`#${r.id} - ${r.contractor_name} → ${r.project_name}`);
      console.log(`  Monto: $${amount.toLocaleString()} | Semana: ${r.week_date}`);
      console.log('');
    });
    
    // Ahora verificar si algún contratista-proyecto tiene valores sospechosos en report_entries
    console.log('\n=== Verificando posibles duplicaciones en report_entries ===\n');
    
    const { rows: entries } = await client.query(`
      SELECT 
        wr.week_date,
        c.name AS contractor_name,
        p.name AS project_name,
        re.rep_a_cta,
        (SELECT COUNT(*) FROM advancement_reports ar
         WHERE ar.weekly_report_id = wr.id 
           AND ar.contractor_id = re.contractor_id
           AND ar.project_id = re.project_id) AS num_reports_passed
      FROM report_entries re
      JOIN weekly_reports wr ON wr.id = re.report_id
      JOIN contractors c ON c.id = re.contractor_id
      JOIN projects p ON p.id = re.project_id
      WHERE re.rep_a_cta > 0
      ORDER BY wr.week_date, c.name, p.name
    `);
    
    entries.forEach(e => {
      if (e.num_reports_passed > 1) {
        console.log(`⚠️  ${e.week_date} - ${e.contractor_name} → ${e.project_name}`);
        console.log(`   Rep A Cta: $${e.rep_a_cta.toLocaleString()}`);
        console.log(`   Reportes pasados a esta semana: ${e.num_reports_passed} (POSIBLE DUPLICACIÓN)`);
        console.log('');
      }
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDuplicates();
