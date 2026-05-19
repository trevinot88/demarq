const { Client } = require('pg');

const DATA = {
  "week_date": "2026-05-08", // Convertido de "08 DE MAYO DEL 2026"
  "entries": [
    {"project": "BOCAPALMA BARANDALES", "contractor": "ARTURO LOPEZ", "vp": 420430, "ent_a_cta": 328400, "rep_a_cta": 92030},
    {"project": "BOCAPALMA BARANDALES", "contractor": "CUAUHTEMOC SALAS", "vp": 41400, "ent_a_cta": 29500, "rep_a_cta": 11900},
    {"project": "BOCAPALMA BANOS", "contractor": "CUAUHTEMOC SALAS", "vp": 376000, "ent_a_cta": 376000, "rep_a_cta": 0},
    {"project": "BOCAPALMA BANOS", "contractor": "JOSE DURAN", "vp": 70317, "ent_a_cta": 39000, "rep_a_cta": 31018},
    {"project": "BOCAPALMA BANOS", "contractor": "PEDRO YANEZ", "vp": 23610, "ent_a_cta": 19610, "rep_a_cta": 4000},
    {"project": "BOCAPALMA BANOS", "contractor": "JORGE MARTINEZ", "vp": 40590, "ent_a_cta": 20000, "rep_a_cta": 0},
    {"project": "BOCAPALMA BANOS", "contractor": "ARTURO LOPEZ", "vp": 82000, "ent_a_cta": 41000, "rep_a_cta": 0},
    {"project": "BOCAPALMA BANOS", "contractor": "ANTONIO GUTIERREZ", "vp": 69300, "ent_a_cta": 64800, "rep_a_cta": 4500},
    {"project": "BOCAPALMA BANOS", "contractor": "RODO ALEMAN", "vp": 7600, "ent_a_cta": 3800, "rep_a_cta": 3800},
    {"project": "BOCAPALMA ESCALERA Y RAMPA", "contractor": "CUAUHTEMOC SALAS", "vp": 71335, "ent_a_cta": 31288, "rep_a_cta": 23100},
    {"project": "LOCAL GOMEZ MORIN", "contractor": "CUAUHTEMOC SALAS", "vp": 20700, "ent_a_cta": 7500, "rep_a_cta": 0},
    {"project": "LOCAL GOMEZ MORIN", "contractor": "PEDRO YANEZ", "vp": 1900, "ent_a_cta": 0, "rep_a_cta": 0},
    {"project": "LOCAL GOMEZ MORIN", "contractor": "MARIO CABALLERO", "vp": 38460, "ent_a_cta": 28120, "rep_a_cta": 10340},
    {"project": "SIERRA DEL VALLE", "contractor": "GENARO MARTINEZ", "vp": 9200, "ent_a_cta": 0, "rep_a_cta": 0},
    {"project": "SIERRA DEL VALLE", "contractor": "PEDRO YANEZ", "vp": 2900, "ent_a_cta": 0, "rep_a_cta": 0}
  ]
};

async function loadData() {
  const client = new Client({
    connectionString: 'postgresql://demarq_db_user:0ZmtY5cNQ38wFD7uHsPHdhmOfpujTefF@dpg-d85p79vavr4c73d5eglg-a.oregon-postgres.render.com/demarq_db',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Borrar semanas anteriores (ID 4 y 6 si existe)
    await client.query('DELETE FROM weekly_reports WHERE id IN (4, 6)');
    console.log('✓ Semanas anteriores eliminadas');

    // 2. Crear nueva semana del 8 de mayo
    const weekRes = await client.query(
      `INSERT INTO weekly_reports (week_date) VALUES ($1) RETURNING id`,
      [DATA.week_date]
    );
    const reportId = weekRes.rows[0].id;
    console.log(`✓ Semana creada: ${DATA.week_date} (ID: ${reportId})`);

    // 3. Obtener mapeo de proyectos y contratistas
    const projects = await client.query('SELECT id, name FROM projects');
    const contractors = await client.query('SELECT id, name FROM contractors');

    const projectMap = new Map(projects.rows.map(p => [p.name.toUpperCase(), p.id]));
    const contractorMap = new Map(contractors.rows.map(c => [c.name.toUpperCase(), c.id]));

    // 4. Procesar cada entrada
    let entriesLoaded = 0;
    for (const entry of DATA.entries) {
      const projectId = projectMap.get(entry.project.toUpperCase());
      const contractorId = contractorMap.get(entry.contractor.toUpperCase());

      if (!projectId) {
        console.warn(`⚠ Proyecto no encontrado: ${entry.project}`);
        continue;
      }
      if (!contractorId) {
        console.warn(`⚠ Contratista no encontrado: ${entry.contractor}`);
        continue;
      }

      // Actualizar/crear presupuesto
      await client.query(
        `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto)
         VALUES ($1, $2, $3)
         ON CONFLICT (contractor_id, project_id)
         DO UPDATE SET valor_presupuesto = EXCLUDED.valor_presupuesto`,
        [contractorId, projectId, entry.vp]
      );

      // Crear entrada en reporte semanal
      await client.query(
        `INSERT INTO report_entries (report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes)
         VALUES ($1, $2, $3, $4, $5, '')`,
        [reportId, contractorId, projectId, entry.ent_a_cta, entry.rep_a_cta]
      );

      entriesLoaded++;
    }

    await client.query('COMMIT');
    console.log(`✓ ${entriesLoaded} entradas cargadas exitosamente`);
    console.log(`✓ Total reportado: $${DATA.entries.reduce((s, e) => s + e.rep_a_cta, 0).toLocaleString()}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

loadData().catch(console.error);
