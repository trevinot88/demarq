/** Formatea número como moneda MXN */
export const mxn = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

/** Clase de color para saldos */
export const saldoClass = (n) => {
  if (n < 0)  return 'saldo-neg';
  if (n === 0) return 'saldo-cero';
  return 'saldo-pos';
};

/** Siguiente viernes a partir de hoy */
export const nextFridayISO = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Dom 5=Vie
  const diff = day === 5 ? 7 : (5 - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

/** Formatea fecha ISO como "Viernes 08 de mayo 2026" */
export const formatWeekDate = (iso) => {
  if (!iso) return '';
  // Parsear como fecha local para evitar desfase de zona horaria
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[date.getDay()]} ${String(d).padStart(2,'0')} de ${meses[m-1]} ${y}`;
};

/** Formatea fecha simple DD/MM/YYYY */
export const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
