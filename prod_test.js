'use strict';
/**
 * PRUEBA E2E EN PRODUCCIÓN — https://demarq.vercel.app
 * Reproduce el flujo del usuario: crear semana siguiente, verificar herencia
 * y que la semana pasada NO cambie, luego elimina la semana de prueba.
 */
const BASE = 'https://demarq.vercel.app';
let COOKIE = '';
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
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) COOKIE = setCookie.split(';')[0];
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
        rows.push({ vp: e.vp, ent: e.ent_a_cta, rep: e.rep_a_cta, c: e.contractor_name, p: e.project_name || p.project_name });
      }
    }
    out[w.week_date] = rows;
  }
  return out;
};

(async () => {
  console.log('── LOGIN en producción ──');
  const login = await api('POST', '/api/auth/login', { username: 'demarq', password: '2026' });
  check('login ok', login.status === 200, JSON.stringify(login.data));

  const before = await snap();
  const weekDates = Object.keys(before).sort();
  console.log('  semanas actuales en producción: ' + weekDates.join(', '));
  const lastWeek = weekDates[weekDates.length - 1];
  console.log(`  semana más reciente: ${lastWeek} (${before[lastWeek].length} entradas)`);

  // Elegir la semana de prueba = siguiente viernes
  const [y, m, d] = lastWeek.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 7));
  const testDate = next.toISOString().slice(0, 10);
  console.log(`\n── PASO 1: crear semana de prueba ${testDate} ──`);
  let r = await api('POST', '/api/reports', { week_date: testDate });
  if (r.status === 409) {
    console.log('  (la semana de prueba ya existía, se usa la existente)');
  } else {
    check('semana de prueba creada (201)', r.status === 201, JSON.stringify(r.data));
  }
  const afterCreate = await snap();
  check('semana anterior INTACTA tras crear la nueva',
    JSON.stringify(before[lastWeek]) === JSON.stringify(afterCreate[lastWeek]),
    '\n    antes:  ' + JSON.stringify(before[lastWeek]).slice(0, 300) + '\n    ahora:  ' + JSON.stringify(afterCreate[lastWeek]).slice(0, 300));

  const newRows = afterCreate[testDate] || [];
  console.log(`  → nueva semana ${testDate}: ${newRows.length} entradas`);
  // Verificar herencia: para cada entrada de la semana anterior debe existir
  // una entrada nueva con ent = ent_prev + rep_prev y vp = vp_prev - rep_prev... (vp correcto = saldo)
  let heredadas = 0, incorrectas = 0;
  for (const prev of before[lastWeek]) {
    const nu = newRows.find(x => x.c === prev.c && x.p === prev.p);
    if (!nu) continue;
    const expectedEnt = (Number(prev.ent) || 0) + (Number(prev.rep) || 0);
    if (approx(Number(nu.ent), expectedEnt)) heredadas++;
    else { incorrectas++; console.log(`    ⚠️ ${prev.p}/${prev.c}: ent=${nu.ent} esperado=${expectedEnt} (prev ent=${prev.ent} rep=${prev.rep})`); }
  }
  check(`herencia correcta en ${heredadas} entrada(s)`, incorrectas === 0 && heredadas > 0, `heredadas=${heredadas} incorrectas=${incorrectas}`);

  console.log(`\n── PASO 2: eliminar semana de prueba ${testDate} ──`);
  const weeksNow = (await api('GET', '/api/reports')).data;
  const testWeek = weeksNow.find(w => w.week_date === testDate);
  if (testWeek) {
    r = await api('DELETE', `/api/reports/${testWeek.id}`);
    check('semana de prueba eliminada', r.status === 200, JSON.stringify(r.data));
  }
  const final = await snap();
  check('semana original sigue EXACTAMENTE igual después de todo',
    JSON.stringify(before[lastWeek]) === JSON.stringify(final[lastWeek]),
    '\n    antes:  ' + JSON.stringify(before[lastWeek]).slice(0, 300) + '\n    ahora:  ' + JSON.stringify(final[lastWeek]).slice(0, 300));

  console.log(failures === 0 ? '\n✅ PRODUCCIÓN: TODO OK — el fix está desplegado y funciona' : `\n⛔ ${failures} FALLA(S) — el deploy NO tiene el fix o hay otro problema`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });