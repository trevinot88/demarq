'use strict';
/**
 * PRUEBA E2E — Reproduce el flujo real del usuario contra la API corriendo:
 *   1. Setup: proyecto + contratista + presupuesto vía API
 *   2. Crear semana 1 (POST /api/reports)
 *   3. Poner montos en semana 1 (PUT /entries)
 *   4. Crear semana 2 → verificar que semana 1 NO cambió (snapshot)
 *   5. Poner montos en semana 2, editar presupuesto en PROYECTOS
 *   6. Crear semana 3 → verificar semanas 1 y 2 intactas
 * Uso: COOKIE='connect.sid=...' node e2e_test.js
 */
const BASE = 'http://localhost:3101';
const COOKIE = process.env.COOKIE || '';
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.log(`  ❌ ${name} ${detail}`); }
}
const approx = (a, b) => Math.abs(a - b) < 0.01;

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const snap = async () => {
  const { data: weeks } = await api('GET', '/api/reports');
  const out = {};
  for (const w of weeks) {
    const { data: d } = await api('GET', `/api/reports/${w.id}`);
    const rows = [];
    for (const p of (d.projects || [])) {
      for (const e of (p.entries || [])) {
        rows.push({ vp: e.vp, ent: e.ent_a_cta, rep: e.rep_a_cta, c: e.contractor_name });
      }
    }
    out[w.week_date] = rows;
  }
  return out;
};

(async () => {
  // ── SETUP vía API ────────────────────────────────────────────────
  console.log('── SETUP (API real) ──');
  const { data: proj } = await api('POST', '/api/projects', { name: 'E2E PROYECTO' });
  const { data: cont } = await api('POST', '/api/contractors', { name: 'E2E CONTRATISTA' });
  await api('POST', `/api/projects/${proj.id}/contractors`, { contractor_id: cont.id, valor_presupuesto: 50000 });
  console.log('  proyecto/contratista/presupuesto(50000) creados');

  // ── 1. Crear semana 1 ────────────────────────────────────────────
  console.log('\n── PASO 1: crear semana 2026-09-04 ──');
  let r = await api('POST', '/api/reports', { week_date: '2026-09-04' });
  check('semana 1 creada (201)', r.status === 201, JSON.stringify(r.data));
  const w1 = (await api('GET', '/api/reports')).data.find(w => w.week_date === '2026-09-04');
  const w1d = (await api('GET', `/api/reports/${w1.id}`)).data;
  const e1 = (w1d.projects[0] || { entries: [] }).entries[0];
  check('semana 1: vp=50000, ent=0', approx(e1.vp, 50000) && approx(e1.ent_a_cta, 0), `vp=${e1.vp} ent=${e1.ent_a_cta}`);

  // ── 2. Usuario pone monto en semana 1 ────────────────────────────
  console.log('\n── PASO 2: usuario reporta rep=10000 en semana 1 ──');
  r = await api('PUT', `/api/reports/${w1.id}/entries/${e1.id}`, { rep_a_cta: 10000 });
  check('PUT rep_a_cta=10000 ok', r.status === 200);
  const snap1 = await snap();

  // ── 3. Crear semana 2 ────────────────────────────────────────────
  console.log('\n── PASO 3: avanzar a semana 2026-09-11 ──');
  r = await api('POST', '/api/reports', { week_date: '2026-09-11' });
  check('semana 2 creada (201)', r.status === 201, JSON.stringify(r.data));
  const snapAfterW2 = await snap();
  check('semana 1 INTACTA tras crear semana 2',
    JSON.stringify(snap1['2026-09-04']) === JSON.stringify(snapAfterW2['2026-09-04']),
    JSON.stringify(snap1['2026-09-04']) + ' vs ' + JSON.stringify(snapAfterW2['2026-09-04']));
  const w2rows = snapAfterW2['2026-09-11'];
  check('semana 2: ent=10000 (heredó el rep de la semana 1)', w2rows && approx(w2rows[0].ent, 10000), JSON.stringify(w2rows));
  check('semana 2: vp=40000', w2rows && approx(w2rows[0].vp, 40000), JSON.stringify(w2rows));

  // ── 4. Montos en semana 2 + editar presupuesto en PROYECTOS ──────
  console.log('\n── PASO 4: reporta rep=8000 en semana 2 y edita presupuesto en PROYECTOS ──');
  const w2id = (await api('GET', '/api/reports')).data.find(w => w.week_date === '2026-09-11').id;
  const e2 = ((await api('GET', `/api/reports/${w2id}`)).data.projects[0] || { entries: [] }).entries[0];
  await api('PUT', `/api/reports/${w2id}/entries/${e2.id}`, { rep_a_cta: 8000 });
  await api('PUT', `/api/projects/${proj.id}/contractors/${cont.id}`, { valor_presupuesto: 60000 });
  const snap2 = await snap();

  // ── 5. Crear semana 3 ────────────────────────────────────────────
  console.log('\n── PASO 5: avanzar a semana 2026-09-18 ──');
  r = await api('POST', '/api/reports', { week_date: '2026-09-18' });
  check('semana 3 creada (201)', r.status === 201, JSON.stringify(r.data));
  const snap3 = await snap();
  check('semana 1 INTACTA tras crear semanas 2 y 3',
    JSON.stringify(snap2['2026-09-04']) === JSON.stringify(snap3['2026-09-04']),
    JSON.stringify(snap2['2026-09-04']) + ' vs ' + JSON.stringify(snap3['2026-09-04']));
  check('semana 2 INTACTA tras crear semana 3',
    JSON.stringify(snap2['2026-09-11']) === JSON.stringify(snap3['2026-09-11']),
    JSON.stringify(snap2['2026-09-11']) + ' vs ' + JSON.stringify(snap3['2026-09-11']));
  const w3rows = snap3['2026-09-18'];
  check('semana 3: ent=18000 (heredó 10000+8000), vp=42000 (60000-18000)',
    w3rows && approx(w3rows[0].ent, 18000) && approx(w3rows[0].vp, 42000), JSON.stringify(w3rows));

  console.log(failures === 0 ? '\n✅ E2E: TODO OK — las semanas pasadas NUNCA se mueven' : `\n⛔ ${failures} FALLA(S)`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });