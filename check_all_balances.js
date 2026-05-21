'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function checkBalances() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Análisis de saldos de todos los proyectos ===\n');
    
    // Obtener todos los contratistas por proyecto con sus cálculos
    const { rows } = await client.query(`
      SELECT 
        p.name AS project_name,
        c.name AS contractor_name,
        cpb.valor_presupuesto,
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
        , 0) AS total_pagado,
        cpb.total_pagado_manual
      FROM contractor_project_budgets cpb
      JOIN contractors c ON c.id = cpb.contractor_id
      JOIN projects p ON p.id = cpb.project_id
      WHERE p.status = 'active'
      ORDER BY p.name, c.name
    `);
    
    console.log('Proyecto → Contratista | VP Base | Extras | VP Total | Pagado | Saldo\n');
    console.log('─'.repeat(90) + '\n');
    
    rows.forEach(r => {
      const vpBase = r.valor_presupuesto || 0;
      const extras = r.total_extras || 0;
      const vpTotal = vpBase + extras;
      const pagado = r.total_pagado || 0;
      const saldo = vpTotal - pagado;
      
      const fmt = (n) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
      
      let indicator = '  ';
      if (saldo < 0) indicator = '⚠️ '; // Negativo
      if (saldo === 0 && vpTotal > 0) indicator = '✓ '; // Completo
      
      console.log(`${indicator}${r.project_name} → ${r.contractor_name}`);
      console.log(`   VP Base: ${fmt(vpBase)} | Extras: ${fmt(extras)} | VP Total: ${fmt(vpTotal)}`);
      console.log(`   Pagado: ${fmt(pagado)}${r.total_pagado_manual ? ' (MANUAL)' : ''} | Saldo: ${fmt(saldo)}`);
      console.log('');
    });
    
    const negativos = rows.filter(r => {
      const vpTotal = (r.valor_presupuesto || 0) + (r.total_extras || 0);
      const saldo = vpTotal - (r.total_pagado || 0);
      return saldo < 0;
    });
    
    if (negativos.length > 0) {
      console.log('\n⚠️  SALDOS NEGATIVOS DETECTADOS:\n');
      negativos.forEach(r => {
        const vpTotal = (r.valor_presupuesto || 0) + (r.total_extras || 0);
        const saldo = vpTotal - (r.total_pagado || 0);
        console.log(`   ${r.contractor_name} → ${r.project_name}: $${saldo.toLocaleString()}`);
      });
    } else {
      console.log('\n✓ No hay saldos negativos.\n');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkBalances();
