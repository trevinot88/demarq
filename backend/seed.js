'use strict';
/**
 * Seed script — popula la BD con datos de ejemplo basados en los xlsx.
 * Ejecutar: npm run seed
 */
const db = require('./db');

// ── Limpiar todo ──────────────────────────────────────────────────────────────
db.exec(`
  DELETE FROM fuel_transactions;
  DELETE FROM office_payments;
  DELETE FROM report_entries;
  DELETE FROM weekly_reports;
  DELETE FROM contractor_project_budgets;
  DELETE FROM contractors;
  DELETE FROM projects;
`);

// ── Proyectos ─────────────────────────────────────────────────────────────────
const insProject = db.prepare(
  `INSERT INTO projects (name, client_name, status) VALUES (?, ?, ?)`
);

const P = {
  terreno:          insProject.run('TERRENO',                   'Fernando Marroquin', 'active').lastInsertRowid,
  bocapalma:        insProject.run('BOCAPALMA',                 'Fernando Marroquin', 'active').lastInsertRowid,
  barandales:       insProject.run('BOCAPALMA BARANDALES',      null,                 'active').lastInsertRowid,
  banos:            insProject.run('BOCAPALMA BAÑOS',           null,                 'active').lastInsertRowid,
  escalera:         insProject.run('BOCAPALMA ESCALERA Y RAMPA',null,                 'active').lastInsertRowid,
  amacuzac:         insProject.run('AMACUZAC',                  null,                 'active').lastInsertRowid,
  factores:         insProject.run('FACTORES MUTUOS',           null,                 'active').lastInsertRowid,
  gomezMorin:       insProject.run('LOCAL GOMEZ MORIN',         null,                 'active').lastInsertRowid,
  sierraDelValle:   insProject.run('SIERRA DEL VALLE',          null,                 'active').lastInsertRowid,
};

// ── Contratistas ──────────────────────────────────────────────────────────────
const insContractor = db.prepare(`INSERT INTO contractors (name) VALUES (?)`);

const C = {
  gildardo:      insContractor.run('GILDARDO DE HOYOS').lastInsertRowid,
  arturo:        insContractor.run('ARTURO LOPEZ').lastInsertRowid,
  temo:          insContractor.run('CUAUHTEMOC SALAS').lastInsertRowid,
  joseDuran:     insContractor.run('JOSE DURAN').lastInsertRowid,
  pedroYanez:    insContractor.run('PEDRO YAÑEZ').lastInsertRowid,
  jorgeMtz:      insContractor.run('JORGE MARTINEZ').lastInsertRowid,
  antonio:       insContractor.run('ANTONIO GUTIERREZ').lastInsertRowid,
  rodo:          insContractor.run('RODO ALEMAN').lastInsertRowid,
  luis:          insContractor.run('LUIS OROPEZA').lastInsertRowid,
  jaime:         insContractor.run('JAIME BAUTISTA').lastInsertRowid,
  guadalupe:     insContractor.run('GUADALUPE MORENO').lastInsertRowid,
  joseLuis:      insContractor.run('JOSE LUIS TORRES').lastInsertRowid,
  solatube:      insContractor.run('SOLATUBE').lastInsertRowid,
  mosquiteros:   insContractor.run('MOSQUITEROS').lastInsertRowid,
  mario:         insContractor.run('MARIO CABALLERO').lastInsertRowid,
  genaroMtz:     insContractor.run('GENARO MARTINEZ').lastInsertRowid,
  bernardo:      insContractor.run('BERNARDO ZAMORA').lastInsertRowid,
  orlando:       insContractor.run('ORLANDO TREJO').lastInsertRowid,
  maryTere:      insContractor.run('MARY TERE').lastInsertRowid,
  ingCarlos:     insContractor.run('ING CARLOS LUCIO').lastInsertRowid,
  control2000:   insContractor.run('CONTROL 2000').lastInsertRowid,
  materialesSF:  insContractor.run('MATERIALES S.F.').lastInsertRowid,
};

// ── Presupuestos (VP por contratista por proyecto) ────────────────────────────
const insBudget = db.prepare(
  `INSERT INTO contractor_project_budgets (contractor_id, project_id, valor_presupuesto) VALUES (?, ?, ?)`
);

// TERRENO
insBudget.run(C.gildardo,  P.terreno,     180000);
insBudget.run(C.arturo,    P.terreno,     120000);
insBudget.run(C.temo,      P.terreno,      95000);
insBudget.run(C.joseDuran, P.terreno,      75000);
insBudget.run(C.orlando,   P.terreno,      60000);

// BOCAPALMA
insBudget.run(C.pedroYanez, P.bocapalma,  200000);
insBudget.run(C.jorgeMtz,   P.bocapalma,  150000);
insBudget.run(C.antonio,    P.bocapalma,  130000);
insBudget.run(C.gildardo,   P.bocapalma,  110000);
insBudget.run(C.rodo,       P.bocapalma,   90000);

// BARANDALES
insBudget.run(C.bernardo,  P.barandales,   85000);
insBudget.run(C.luis,      P.barandales,   60000);

// BAÑOS
insBudget.run(C.jaime,     P.banos,        90000);
insBudget.run(C.guadalupe, P.banos,        70000);

// ESCALERA Y RAMPA
insBudget.run(C.joseLuis,  P.escalera,    110000);
insBudget.run(C.mario,     P.escalera,     80000);

// AMACUZAC
insBudget.run(C.genaroMtz, P.amacuzac,   160000);
insBudget.run(C.temo,      P.amacuzac,   120000);
insBudget.run(C.bernardo,  P.amacuzac,    95000);

// FACTORES MUTUOS
insBudget.run(C.solatube,    P.factores,   45000);
insBudget.run(C.mosquiteros, P.factores,   35000);
insBudget.run(C.control2000, P.factores,   55000);

// LOCAL GOMEZ MORIN
insBudget.run(C.maryTere,   P.gomezMorin,  80000);
insBudget.run(C.ingCarlos,  P.gomezMorin, 100000);
insBudget.run(C.materialesSF,P.gomezMorin, 65000);

// SIERRA DEL VALLE
insBudget.run(C.temo,      P.sierraDelValle, 140000);
insBudget.run(C.joseDuran, P.sierraDelValle, 110000);
insBudget.run(C.arturo,    P.sierraDelValle,  90000);

// ── Semana 1: 30 de abril 2026 ───────────────────────────────────────────────
const w1 = db.prepare(`INSERT INTO weekly_reports (week_date) VALUES (?)`).run('2026-04-30').lastInsertRowid;

const insEntry = db.prepare(`
  INSERT INTO report_entries (report_id, contractor_id, project_id, ent_a_cta, rep_a_cta, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// TERRENO — semana 1
insEntry.run(w1, C.gildardo,  P.terreno,  45000,  15000, '');
insEntry.run(w1, C.arturo,    P.terreno,  30000,  10000, '');
insEntry.run(w1, C.temo,      P.terreno,  20000,   8000, '12 EFE 27 ABR');
insEntry.run(w1, C.joseDuran, P.terreno,  15000,   5000, '');
insEntry.run(w1, C.orlando,   P.terreno,  12000,   4000, '');

// BOCAPALMA — semana 1
insEntry.run(w1, C.pedroYanez, P.bocapalma,  65000, 20000, '');
insEntry.run(w1, C.jorgeMtz,   P.bocapalma,  50000, 15000, '');
insEntry.run(w1, C.antonio,    P.bocapalma,  40000, 12000, '');
insEntry.run(w1, C.gildardo,   P.bocapalma,  30000, 10000, '');
insEntry.run(w1, C.rodo,       P.bocapalma,  20000,  7000, '');

// BARANDALES — semana 1
insEntry.run(w1, C.bernardo, P.barandales,  25000,  8000, '');
insEntry.run(w1, C.luis,     P.barandales,  18000,  6000, '');

// BAÑOS — semana 1
insEntry.run(w1, C.jaime,     P.banos,  28000,  9000, '');
insEntry.run(w1, C.guadalupe, P.banos,  20000,  7000, '');

// ESCALERA Y RAMPA — semana 1
insEntry.run(w1, C.joseLuis, P.escalera,  35000, 12000, '');
insEntry.run(w1, C.mario,    P.escalera,  25000,  9000, '');

// AMACUZAC — semana 1
insEntry.run(w1, C.genaroMtz, P.amacuzac,  55000, 18000, '');
insEntry.run(w1, C.temo,      P.amacuzac,  40000, 14000, '');
insEntry.run(w1, C.bernardo,  P.amacuzac,  30000, 10000, '');

// FACTORES MUTUOS — semana 1
insEntry.run(w1, C.solatube,    P.factores,  12000, 4000, '');
insEntry.run(w1, C.mosquiteros, P.factores,   8000, 3000, '');
insEntry.run(w1, C.control2000, P.factores,  18000, 6000, '');

// LOCAL GOMEZ MORIN — semana 1
insEntry.run(w1, C.maryTere,    P.gomezMorin,  25000,  8000, '');
insEntry.run(w1, C.ingCarlos,   P.gomezMorin,  35000, 12000, '');
insEntry.run(w1, C.materialesSF,P.gomezMorin,  20000,  7000, '');

// OFICINA — semana 1
const insOffice = db.prepare(
  `INSERT INTO office_payments (report_id, person_name, amount) VALUES (?, ?, ?)`
);
insOffice.run(w1, 'EMILIO',           12000);
insOffice.run(w1, 'ROLAND',            8000);
insOffice.run(w1, 'PEDRO YAÑEZ',       5000);
insOffice.run(w1, 'GILDARDO DE HOYOS', 4000);
insOffice.run(w1, 'TEMO',              6000);
insOffice.run(w1, 'LUIS OROPEZA',      3000);
insOffice.run(w1, 'GUADALUPE MORENO',  2500);
insOffice.run(w1, 'SRA VICKY',         3500);
insOffice.run(w1, 'ANTONIO GUTIERREZ', 2000);
insOffice.run(w1, 'BERNARDO ZAMORA',   2000);
insOffice.run(w1, 'MARIO CABALLERO',   2500);
insOffice.run(w1, 'GENARO MARTINEZ',   2000);
insOffice.run(w1, 'JOSE LUIS TORRES',  2000);
insOffice.run(w1, 'JOSE DURAN',        2000);
insOffice.run(w1, 'CONTENEDOR',       15000);

// ── Semana 2: 08 de mayo 2026 ────────────────────────────────────────────────
const w2 = db.prepare(`INSERT INTO weekly_reports (week_date) VALUES (?)`).run('2026-05-08').lastInsertRowid;

// Regla: ent_a_cta_nuevo = ent_a_cta_prev + rep_a_cta_prev
// TERRENO — semana 2
insEntry.run(w2, C.gildardo,  P.terreno,  60000, 18000, '');
insEntry.run(w2, C.arturo,    P.terreno,  40000, 12000, '');
insEntry.run(w2, C.temo,      P.terreno,  28000,  9000, '');
insEntry.run(w2, C.joseDuran, P.terreno,  20000,  6000, '');
insEntry.run(w2, C.orlando,   P.terreno,  16000,  5000, '');

// BOCAPALMA — semana 2
insEntry.run(w2, C.pedroYanez, P.bocapalma,  85000, 22000, '');
insEntry.run(w2, C.jorgeMtz,   P.bocapalma,  65000, 16000, '');
insEntry.run(w2, C.antonio,    P.bocapalma,  52000, 13000, '');
insEntry.run(w2, C.gildardo,   P.bocapalma,  40000, 11000, '');
insEntry.run(w2, C.rodo,       P.bocapalma,  27000,  8000, '');

// BARANDALES — semana 2
insEntry.run(w2, C.bernardo, P.barandales,  33000,  9000, '');
insEntry.run(w2, C.luis,     P.barandales,  24000,  7000, '');

// BAÑOS — semana 2
insEntry.run(w2, C.jaime,     P.banos,  37000, 10000, '');
insEntry.run(w2, C.guadalupe, P.banos,  27000,  8000, '');

// ESCALERA Y RAMPA — semana 2
insEntry.run(w2, C.joseLuis, P.escalera,  47000, 13000, '');
insEntry.run(w2, C.mario,    P.escalera,  34000, 10000, '');

// AMACUZAC — semana 2
insEntry.run(w2, C.genaroMtz, P.amacuzac,  73000, 20000, '');
insEntry.run(w2, C.temo,      P.amacuzac,  54000, 15000, '');
insEntry.run(w2, C.bernardo,  P.amacuzac,  40000, 12000, '');

// FACTORES MUTUOS — semana 2
insEntry.run(w2, C.solatube,    P.factores,  16000, 5000, '');
insEntry.run(w2, C.mosquiteros, P.factores,  11000, 4000, '');
insEntry.run(w2, C.control2000, P.factores,  24000, 7000, '');

// LOCAL GOMEZ MORIN — semana 2
insEntry.run(w2, C.maryTere,    P.gomezMorin,  33000,  9000, '');
insEntry.run(w2, C.ingCarlos,   P.gomezMorin,  47000, 13000, '');
insEntry.run(w2, C.materialesSF,P.gomezMorin,  27000,  8000, '');

// SIERRA DEL VALLE — semana 2 (proyecto nuevo)
insEntry.run(w2, C.temo,      P.sierraDelValle,  0, 10000, 'Inicio de obra');
insEntry.run(w2, C.joseDuran, P.sierraDelValle,  0,  8000, 'Inicio de obra');
insEntry.run(w2, C.arturo,    P.sierraDelValle,  0,  7000, 'Inicio de obra');

// OFICINA — semana 2
insOffice.run(w2, 'EMILIO',           12000);
insOffice.run(w2, 'ROLAND',            8000);
insOffice.run(w2, 'PEDRO YAÑEZ',       5000);
insOffice.run(w2, 'GILDARDO DE HOYOS', 4000);
insOffice.run(w2, 'TEMO',              6000);
insOffice.run(w2, 'LUIS OROPEZA',      3000);
insOffice.run(w2, 'GUADALUPE MORENO',  2500);
insOffice.run(w2, 'SRA VICKY',         3500);
insOffice.run(w2, 'ANTONIO GUTIERREZ', 2000);
insOffice.run(w2, 'BERNARDO ZAMORA',   2000);
insOffice.run(w2, 'MARIO CABALLERO',   2500);
insOffice.run(w2, 'GENARO MARTINEZ',   2000);
insOffice.run(w2, 'JOSE LUIS TORRES',  2000);
insOffice.run(w2, 'JOSE DURAN',        2000);
insOffice.run(w2, 'CONTENEDOR',       15000);

// ── Gasolinas / Caja ─────────────────────────────────────────────────────────
const insFuel = db.prepare(
  `INSERT INTO fuel_transactions (date, type, amount, description) VALUES (?, ?, ?, ?)`
);

// Aportaciones
insFuel.run('2026-03-01', 'APORTACION', 30915, 'Aportación inicial marzo');

// Facturas de gasolina (total ~$43,800)
insFuel.run('2026-03-05', 'FACTURA_GAS',  3520, 'Factura gas — vehículo 1');
insFuel.run('2026-03-12', 'FACTURA_GAS',  4180, 'Factura gas — vehículo 2');
insFuel.run('2026-03-19', 'FACTURA_GAS',  3750, 'Factura gas — varios');
insFuel.run('2026-03-26', 'FACTURA_GAS',  4230, 'Factura gas — vehículo 1');
insFuel.run('2026-04-02', 'FACTURA_GAS',  3890, 'Factura gas — vehículo 2');
insFuel.run('2026-04-09', 'FACTURA_GAS',  4450, 'Factura gas — varios');
insFuel.run('2026-04-16', 'FACTURA_GAS',  5100, 'Factura gas — vehículo 1');
insFuel.run('2026-04-23', 'FACTURA_GAS',  4800, 'Factura gas — vehículo 2');
insFuel.run('2026-04-30', 'FACTURA_GAS',  5200, 'Factura gas — varios');
insFuel.run('2026-05-07', 'FACTURA_GAS',  4680, 'Factura gas — vehículo 1');

// Retiros (total ~$89,300)
insFuel.run('2026-03-15', 'RETIRO', 15000, 'Retiro materiales obra');
insFuel.run('2026-03-28', 'RETIRO', 12000, 'Retiro herramientas');
insFuel.run('2026-04-10', 'RETIRO', 18000, 'Retiro gastos varios');
insFuel.run('2026-04-20', 'RETIRO', 20000, 'Retiro nómina');
insFuel.run('2026-04-27', 'RETIRO', 10000, 'Retiro caja');
insFuel.run('2026-05-05', 'RETIRO', 14300, 'Retiro gastos operativos');

console.log('✅  Seed completado exitosamente');
console.log(`   Proyectos:    ${Object.keys(P).length}`);
console.log(`   Contratistas: ${Object.keys(C).length}`);
console.log(`   Semanas:      2  (30 abr 2026 / 08 may 2026)`);
