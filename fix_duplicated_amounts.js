'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function analyzeAndFix() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Análisis de report_entries con posibles duplicaciones ===\n');
    
    // Buscar entradas donde ent_a_cta = rep_a_cta y ambos > 0
    // Esto indica que probablemente se duplicó el monto
    const { rows } = await client.query(`
      SELECT 
        re.id,
        re.report_id,
        wr.week_date,
        c.name AS contractor_name,
        p.name AS project_name,
        re.ent_a_cta,
        re.rep_a_cta,
        re.notes
      FROM report_entries re
      JOIN weekly_reports wr ON wr.id = re.report_id
      JOIN contractors c ON c.id = re.contractor_id
      JOIN projects p ON p.id = re.project_id
      WHERE re.ent_a_cta = re.rep_a_cta 
        AND re.ent_a_cta > 0
        AND re.notes LIKE 'Reporte #%'
      ORDER BY wr.week_date DESC, c.name, p.name
    `);
    
    if (rows.length === 0) {
      console.log('✓ No se encontraron duplicaciones obvias.');
      return;
    }
    
    console.log(`Encontrados ${rows.length} registros con posible duplicación:\n`);
    
    rows.forEach((r, i) => {
      console.log(`${i + 1}. ${r.contractor_name} → ${r.project_name}`);
      console.log(`   Semana: ${r.week_date}`);
      console.log(`   Ent A Cta: $${r.ent_a_cta.toLocaleString()}`);
      console.log(`   Rep A Cta: $${r.rep_a_cta.toLocaleString()}`);
      console.log(`   TOTAL DUPLICADO: $${(r.ent_a_cta + r.rep_a_cta).toLocaleString()}`);
      console.log(`   Notas: ${r.notes}`);
      console.log('');
    });
    
    console.log('\n=== Corrección Automática ===\n');
    console.log('Para estos registros que vienen de "Reporte #X", el monto debería estar SOLO en rep_a_cta.');
    console.log('Voy a poner ent_a_cta = 0 en estos registros.\n');
    
    // Corregir: poner ent_a_cta = 0 donde se duplicó
    const { rowCount } = await client.query(`
      UPDATE report_entries
      SET ent_a_cta = 0
      WHERE ent_a_cta = rep_a_cta 
        AND ent_a_cta > 0
        AND notes LIKE 'Reporte #%'
    `);
    
    console.log(`✓ Corregidos ${rowCount} registros.\n`);
    
    // Mostrar resumen por contratista-proyecto afectado
    console.log('=== Resumen de montos corregidos ===\n');
    const { rows: summary } = await client.query(`
      SELECT 
        c.name AS contractor_name,
        p.name AS project_name,
        SUM(re.rep_a_cta) AS total_pagado_correcto
      FROM report_entries re
      JOIN contractors c ON c.id = re.contractor_id
      JOIN projects p ON p.id = re.project_id
      WHERE re.notes LIKE 'Reporte #%'
      GROUP BY c.name, p.name
      ORDER BY c.name, p.name
    `);
    
    summary.forEach(s => {
      console.log(`${s.contractor_name} → ${s.project_name}: $${Number(s.total_pagado_correcto).toLocaleString()}`);
    });
    
    console.log('\n✓ Corrección completada.');
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeAndFix();
