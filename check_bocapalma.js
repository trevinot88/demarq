'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function checkBocapalmaBanos() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Verificando BOCAPALMA BANOS ===\n');
    
    // Buscar el proyecto
    const { rows: projects } = await client.query(`
      SELECT id, name FROM projects WHERE name LIKE '%BOCAPALMA BANOS%'
    `);
    
    if (projects.length === 0) {
      console.log('No se encontró el proyecto BOCAPALMA BANOS');
      return;
    }
    
    const projectId = projects[0].id;
    console.log(`Proyecto ID: ${projectId} - ${projects[0].name}\n`);
    
    // Obtener historial semanal para este proyecto
    const { rows: history } = await client.query(`
      SELECT wr.week_date,
        SUM(re.ent_a_cta) AS total_ent,
        SUM(re.rep_a_cta) AS total_rep,
        COUNT(DISTINCT re.contractor_id)::int AS contractors_active
      FROM report_entries re
      JOIN weekly_reports wr ON wr.id = re.report_id
      WHERE re.project_id = $1
      GROUP BY wr.id, wr.week_date
      ORDER BY wr.week_date DESC
    `, [projectId]);
    
    console.log('Historial Semanal del proyecto:\n');
    history.forEach(h => {
      console.log(`${h.week_date}:`);
      console.log(`  Ent. A Cta: $${h.total_ent.toLocaleString('es-MX')}`);
      console.log(`  Rep. A Cta: $${h.total_rep.toLocaleString('es-MX')}`);
      console.log(`  Contratistas: ${h.contractors_active}`);
      console.log('');
    });
    
    // Verificar contratistas asignados
    console.log('\nContratistas asignados:\n');
    const { rows: contractors } = await client.query(`
      SELECT cpb.*, c.name AS contractor_name,
        COALESCE(
          (SELECT SUM(amount)
           FROM contractor_project_extras cpe
           WHERE cpe.contractor_id = cpb.contractor_id
             AND cpe.project_id = cpb.project_id), 0
        ) AS total_extras,
        COALESCE(
          cpb.total_pagado_manual,
          (SELECT SUM(re.ent_a_cta + re.rep_a_cta)
           FROM report_entries re
           WHERE re.contractor_id = cpb.contractor_id
             AND re.project_id = cpb.project_id)
        , 0) AS total_pagado
      FROM contractor_project_budgets cpb
      JOIN contractors c ON c.id = cpb.contractor_id
      WHERE cpb.project_id = $1
      ORDER BY c.name
    `, [projectId]);
    
    contractors.forEach(c => {
      const vpBase = c.valor_presupuesto || 0;
      const extras = c.total_extras || 0;
      const vpTotal = vpBase + extras;
      const pagado = c.total_pagado || 0;
      const saldo = vpTotal - pagado;
      
      console.log(`${c.contractor_name}:`);
      console.log(`  VP Base: $${vpBase.toLocaleString('es-MX')}`);
      console.log(`  Pagado: $${pagado.toLocaleString('es-MX')} ${c.total_pagado_manual ? '(MANUAL)' : '(CALCULADO)'}`);
      console.log(`  Saldo: $${saldo.toLocaleString('es-MX')}`);
      console.log('');
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkBocapalmaBanos();
