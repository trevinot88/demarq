'use strict';
/**
 * Carga los datos de la Relación Semanal del 22 de Mayo del 2026.
 *
 * Uso:
 *   DATABASE_URL=<tu-url> node load_week_may22.js
 *
 * O con .env en la raíz del proyecto:
 *   node load_week_may22.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Datos del Excel ───────────────────────────────────────────────────────────
const WEEK_DATE = '2026-05-22';

// Proyectos nuevos a crear si no existen
const NEW_PROJECTS = [
  { name: 'BOCAPALMA BARANDAL RAMPA', client_name: 'Fernando Marroquin', status: 'active' },
  { name: 'VIA SISTINA',              client_name: null,                  status: 'active' },
];

const ENTRIES = [
  // TERRENO
  { project: 'TERRENO',                  contractor: 'GILDARDO DE HOYOS',   vp: 10000, ent_a_cta:  5000, rep_a_cta:     0 },
  // BOCAPALMA
  { project: 'BOCAPALMA',               contractor: 'GILDARDO DE HOYOS',   vp:  3000, ent_a_cta:  1500, rep_a_cta:     0 },
  // BOCAPALMA BANOS
  { project: 'BOCAPALMA BANOS',         contractor: 'CUAUHTEMOC SALAS',    vp: 376000, ent_a_cta: 376000, rep_a_cta:     0 },
  { project: 'BOCAPALMA BANOS',         contractor: 'JOSE DURAN',           vp:  72917, ent_a_cta:  70018, rep_a_cta:  2600 },
  { project: 'BOCAPALMA BANOS',         contractor: 'PEDRO YANEZ',          vp:  26110, ent_a_cta:  26110, rep_a_cta:     0 },
  { project: 'BOCAPALMA BANOS',         contractor: 'JORGE MARTINEZ',       vp:  48690, ent_a_cta:  48690, rep_a_cta:     0 },
  { project: 'BOCAPALMA BANOS',         contractor: 'ARTURO LOPEZ',         vp:  85500, ent_a_cta:  41000, rep_a_cta: 44500 },
  { project: 'BOCAPALMA BANOS',         contractor: 'ANTONIO GUTIERREZ',    vp:  69300, ent_a_cta:  69300, rep_a_cta:     0 },
  { project: 'BOCAPALMA BANOS',         contractor: 'RODO ALEMAN',          vp:   7600, ent_a_cta:   7600, rep_a_cta:     0 },
  { project: 'BOCAPALMA BANOS',         contractor: 'LUIS OROPEZA',         vp:  38742, ent_a_cta:  38742, rep_a_cta:     0 },
  // BOCAPALMA ESCALERA Y RAMPA
  { project: 'BOCAPALMA ESCALERA Y RAMPA', contractor: 'CUAUHTEMOC SALAS', vp: 90835, ent_a_cta: 69388, rep_a_cta: 17000 },
  // BOCAPALMA BARANDAL RAMPA (proyecto nuevo)
  { project: 'BOCAPALMA BARANDAL RAMPA', contractor: 'ARTURO LOPEZ',        vp:  41410, ent_a_cta:     0, rep_a_cta:     0 },
  // LOCAL GOMEZ MORIN
  { project: 'LOCAL GOMEZ MORIN',        contractor: 'CUAUHTEMOC SALAS',    vp:  11000, ent_a_cta:  11000, rep_a_cta:     0 },
  { project: 'LOCAL GOMEZ MORIN',        contractor: 'PEDRO YANEZ',         vp:   7500, ent_a_cta:      0, rep_a_cta:  4000 },
  { project: 'LOCAL GOMEZ MORIN',        contractor: 'MARIO CABALLERO',     vp:  38460, ent_a_cta:  38460, rep_a_cta:     0 },
  // VIA SISTINA (proyecto nuevo)
  { project: 'VIA SISTINA',              contractor: 'BERNARDO ZAMORA',     vp:  36000, ent_a_cta:      0, rep_a_cta:     0 },
  { project: 'VIA SISTINA',              contractor: 'LUIS OROPEZA',        vp:      0, ent_a_cta:      0, rep_a_cta:  3500 },
  { project: 'VIA SISTINA',              contractor: 'MATERIALES S.F.',     vp:   4500, ent_a_cta:      0, rep_a_cta:  4500, notes: 'EFE 21 MAYO' },
  // SIERRA DEL VALLE
  { project: 'SIERRA DEL VALLE',         contractor: 'GENARO MARTINEZ',     vp:  14500, ent_a_cta:  14500, rep_a_cta:     0 },
  { project: 'SIERRA DEL VALLE',         contractor: 'JOSE DURAN',          vp:    200, ent_a_cta:    200, rep_a_cta:     0 },
  { project: 'SIERRA DEL VALLE',         contractor: 'JOSE LUIS TORRES',    vp:   1350, ent_a_cta:      0, rep_a_cta:     0 },
  { project: 'SIERRA DEL VALLE',         contractor: 'ARTURO LOPEZ',        vp:  17000, ent_a_cta:   8500, rep_a_cta:     0 },
];

// Pagos de oficina
const OFFICE_PAYMENTS = [
  { person_name: 'EMILIO',                      amount:   250 },
  { person_name: 'ROLAND',                      amount:  3250 },
  { person_name: 'CUAUHTEMOC SALAS - FACTORES MUTUOS', amount: 7500 },
  { person_name: 'JOSE DURAN - CASA 70',        amount:  1200 },
];

// ── Script principal ──────────────────────────────────────────────────────────
async function load() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Construir mapa de proyectos y contratistas
    const { rows: projects }    = await client.query('SELECT id, name FROM projects');
    const { rows: contractors } = await client.query('SELECT id, name FROM contractors');

    const projectMap    = new Map(projects.map(p    => [p.name.toUpperCase().trim(), p.id]));
    const contractorMap = new Map(contractors.map(c => [c.name.toUpperCase().trim(), c.id]));

    // 2. Crear proyectos nuevos si no existen
    for (const np of NEW_PROJECTS) {
      if (!projectMap.has(np.name)) {
        const { rows } = await client.query(
          `INSERT INTO projects (name, client_name, status) VALUES ($1, $2, $3) RETURNING id`,
          [np.name, np.client_name, np.status]
        );
        projectMap.set(np.name, rows[0].id);
        console.log(`✓ Proyecto creado: ${np.name} (ID ${rows[0].id})`);
      } else {
        console.log(`  Proyecto ya existe: ${np.name}`);
      }
    }

    // 3. Eliminar semana del 22 de mayo si ya existía
    const existing = (await client.query(
      `SELECT id FROM weekly_reports WHERE week_date = $1`, [WEEK_DATE]
    )).rows[0];

    if (existing) {
      await client.query(`DELETE FROM weekly_reports WHERE id = $1`, [existing.id]);
      console.log(`✓ Semana ${WEEK_DATE} anterior eliminada (ID ${existing.id})`);
    }

    // 4. Crear la semana nueva
    const { rows: [week] } = await client.query(
      `INSERT INTO weekly_reports (week_date) VALUES ($1) RETURNING id`, [WEEK_DATE]
    );
    const reportId = week.id;
    console.log(`✓ Semana creada: ${WEEK_DATE} (ID ${reportId})`);

    // 5. Cargar entradas
    let loaded = 0;
    let warns  = 0;

    for (const e of ENTRIES) {
      const projectId    = projectMap.get(e.project.toUpperCase().trim());
      const contractorId = contractorMap.get(e.contractor.toUpperCase().trim());

      if (!projectId) {
        console.warn(`  ⚠ Proyecto no encontrado: "${e.project}"`);
        warns++;
        continue;
      }
      if (!contractorId) {
        console.warn(`  ⚠ Contratista no encontrado: "${e.contractor}"`);
        warns++;
        continue;
      }

      // Crear/actualizar presupuesto (solo si VP > 0)
      if (e.vp > 0) {
        await client.query(
          `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto)
           VALUES ($1, $2, $3)
           ON CONFLICT (contractor_id, project_id)
           DO UPDATE SET valor_presupuesto = EXCLUDED.valor_presupuesto`,
          [contractorId, projectId, e.vp]
        );
      } else {
        // Asegurar que existe el registro aunque VP sea 0
        await client.query(
          `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto)
           VALUES ($1, $2, 0)
           ON CONFLICT (contractor_id, project_id) DO NOTHING`,
          [contractorId, projectId]
        );
      }

      // Insertar entrada semanal (con vp almacenado para historial correcto)
      await client.query(
        `INSERT INTO report_entries
           (report_id, contractor_id, project_id, vp, ent_a_cta, rep_a_cta, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reportId, contractorId, projectId, e.vp, e.ent_a_cta, e.rep_a_cta, e.notes || '']
      );
      loaded++;
    }

    // 6. Cargar pagos de oficina
    let officeLoaded = 0;
    for (const op of OFFICE_PAYMENTS) {
      if (op.amount > 0) {
        await client.query(
          `INSERT INTO office_payments (report_id, person_name, amount) VALUES ($1, $2, $3)`,
          [reportId, op.person_name, op.amount]
        );
        officeLoaded++;
      }
    }

    await client.query('COMMIT');

    const totalRep    = ENTRIES.reduce((s, e) => s + e.rep_a_cta, 0);
    const totalOffice = OFFICE_PAYMENTS.reduce((s, o) => s + o.amount, 0);

    console.log('\n─────────────────────────────────────────────');
    console.log(`✅ Semana ${WEEK_DATE} cargada exitosamente`);
    console.log(`   Entradas cargadas:       ${loaded}`);
    console.log(`   Pagos de oficina:        ${officeLoaded}`);
    console.log(`   Rep. A Cta. (proyectos): $${totalRep.toLocaleString('es-MX')}`);
    console.log(`   Pagos oficina:           $${totalOffice.toLocaleString('es-MX')}`);
    console.log(`   TOTAL GENERAL:           $${(totalRep + totalOffice).toLocaleString('es-MX')}`);
    if (warns > 0) console.warn(`\n   ⚠ ${warns} entradas omitidas por nombre no encontrado`);
    console.log('─────────────────────────────────────────────\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Error — se hizo ROLLBACK:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

load().catch(() => process.exit(1));
