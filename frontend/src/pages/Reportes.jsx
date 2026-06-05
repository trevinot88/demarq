import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, CheckCircle, XCircle, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

const API = '/api';

const fmt = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

// Obtener la fecha del próximo viernes en formato ISO (YYYY-MM-DD)
const nextFridayISO = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = domingo, 5 = viernes
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // Si hoy es viernes, toma el próximo
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  return nextFriday.toISOString().slice(0, 10);
};

// ── Sección colapsable ──────────────────────────────────────────────────────
function Section({ title, color, icon: Icon, children, count }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4 md:mb-6">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-semibold text-xs md:text-sm ${color} mb-2`}
      >
        <span className="flex items-center gap-2">
          <Icon size={14} className="md:hidden" />
          <Icon size={16} className="hidden md:block" />
          {title}
          <span className="ml-1 bg-white/30 text-xs px-1.5 md:px-2 py-0.5 rounded-full">{count}</span>
        </span>
        {open ? <ChevronUp size={14} className="md:hidden" /> : <ChevronDown size={14} className="md:hidden" />}
        {open ? <ChevronUp size={16} className="hidden md:block" /> : <ChevronDown size={16} className="hidden md:block" />}
      </button>
      {open && <div className="space-y-2 md:space-y-3">{children}</div>}
    </div>
  );
}

// ── Tarjeta de reporte ──────────────────────────────────────────────────────
function ReporteCard({ r, weeks, onAction }) {
  return (
    <div className="bg-white border border-sand rounded-xl p-3 md:p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brown truncate text-sm md:text-base">{r.project_name}</p>
          <p className="text-xs md:text-sm text-gray-900 font-medium">{r.contractor_name}</p>
          {r.description && (
            <p className="text-xs text-gray-500 mt-1 italic">"{r.description}"</p>
          )}
          <div className="flex flex-wrap gap-2 md:gap-3 mt-2 text-xs text-gray-600">
            <span>Reportado: <strong>{fmt(r.amount_reported)}</strong></span>
            {r.amount_accepted != null && (
              <span>Aceptado: <strong className="text-olive-dark">{fmt(r.amount_accepted)}</strong></span>
            )}
            <span>Fecha: {fmtDate(r.report_date)}</span>
            {r.weekly_report_id && (
              <span className="text-olive font-medium">✓ En relación semanal</span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex md:flex-col gap-1.5 justify-end">
          {r.status === 'pending' && (
            <>
              <button
                onClick={() => onAction('accept', r)}
                className="btn-sm bg-green-600 text-white hover:bg-green-700 text-xs"
              >
                <CheckCircle size={12} className="md:hidden" />
                <CheckCircle size={13} className="hidden md:block" />
                <span className="hidden sm:inline">Aceptar</span>
              </button>
              <button
                onClick={() => onAction('reject', r.id)}
                className="btn-sm bg-red-500 text-white hover:bg-red-600 text-xs"
              >
                <XCircle size={12} className="md:hidden" />
                <XCircle size={13} className="hidden md:block" />
                <span className="hidden sm:inline">Rechazar</span>
              </button>
            </>
          )}
          {r.status === 'accepted' && !r.weekly_report_id && (
            <button
              onClick={() => onAction('reset', r.id)}
              className="btn-sm bg-sand text-brown hover:bg-sand-dark border border-brown/20 text-xs"
            >
              Revertir
            </button>
          )}
          {r.status === 'accepted' && r.weekly_report_id && (
            <button
              onClick={() => onAction('reset', r.id)}
              className="btn-sm bg-sand text-brown hover:bg-sand-dark border border-brown/20 text-xs"
            >
              Revertir
            </button>
          )}
          {r.status === 'rejected' && (
            <button
              onClick={() => onAction('reset', r.id)}
              className="btn-sm bg-sand text-brown hover:bg-sand-dark border border-brown/20 text-xs"
            >
              Reabrir
            </button>
          )}
          <button
            onClick={() => onAction('delete', r.id)}
            className="btn-sm text-red-400 hover:bg-red-50 border border-red-200"
          >
            <Trash2 size={12} className="md:hidden" />
            <Trash2 size={13} className="hidden md:block" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Formulario nuevo reporte ────────────────────────────────────────────────
function NuevoReporte({ projects, contractors, onSave, onClose }) {
  const [form, setForm] = useState({
    project_id: '',
    contractor_id: '',
    amount_reported: '',
    description: '',
    report_date: new Date().toISOString().slice(0, 10),
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project_id || !form.contractor_id || !form.amount_reported) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      await axios.post(`${API}/reportes`, form);
      toast.success('Reporte creado');
      onSave();
    } catch {
      toast.error('Error al crear reporte');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-brown">Nuevo Reporte de Avance</h2>

        <div>
          <label className="label-base">Proyecto *</label>
          <select className="input-base w-full" value={form.project_id} onChange={set('project_id')} required>
            <option value="">— Selecciona —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label-base">Contratista *</label>
          <select className="input-base w-full" value={form.contractor_id} onChange={set('contractor_id')} required>
            <option value="">— Selecciona —</option>
            {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label-base">Monto Reportado *</label>
          <input type="number" className="input-base w-full" value={form.amount_reported}
            onChange={set('amount_reported')} min="0" step="any" required />
        </div>

        <div>
          <label className="label-base">Descripción</label>
          <textarea className="input-base w-full" rows={2} value={form.description}
            onChange={set('description')} />
        </div>

        <div>
          <label className="label-base">Fecha</label>
          <input type="date" className="input-base w-full" value={form.report_date}
            onChange={set('report_date')} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">Guardar</button>
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        </div>
      </form>
    </div>
  );
}

// ── Modal Aceptar y Pasar ────────────────────────────────────────────────────
function ModalAceptarYPasar({ reporte, weeks, onConfirm, onClose }) {
  const [monto, setMonto] = useState(reporte.amount_reported);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [newWeekDate, setNewWeekDate] = useState(nextFridayISO());

  const handleConfirm = async () => {
    if (!monto || monto <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    if (!selectedWeek && !creatingNew) {
      toast.error('Selecciona una semana o crea una nueva');
      return;
    }

    let weekId;
    
    if (creatingNew) {
      // Crear nueva semana
      try {
        const { data } = await axios.post(`${API}/reports`, { week_date: newWeekDate });
        weekId = data.id;
        toast.success(`Semana ${newWeekDate} creada`);
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Error al crear semana');
        return;
      }
    } else {
      weekId = selectedWeek;
    }

    onConfirm(reporte.id, monto, weekId);
  };

  const sortedWeeks = [...weeks].sort((a, b) => new Date(b.week_date) - new Date(a.week_date));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-brown">Aceptar Reporte</h2>
        
        <div className="bg-sand-lightest p-3 rounded-lg border border-sand">
          <p className="text-sm text-gray-600"><strong>Proyecto:</strong> {reporte.project_name}</p>
          <p className="text-sm text-gray-600"><strong>Contratista:</strong> {reporte.contractor_name}</p>
          {reporte.description && (
            <p className="text-xs text-gray-500 mt-1 italic">"{reporte.description}"</p>
          )}
        </div>

        <div>
          <label className="label-base">Monto a aceptar</label>
          <input
            type="number"
            className="input-base w-full"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            min="0"
            step="any"
          />
          {monto != reporte.amount_reported && (
            <p className="text-xs text-amber-600 mt-1">
              Monto original reportado: {fmt(reporte.amount_reported)}
            </p>
          )}
        </div>

        <div className="border-t border-sand-light pt-3">
          {!creatingNew ? (
            <>
              <div>
                <label className="label-base">Pasar a semana</label>
                <select 
                  className="input-base w-full" 
                  value={selectedWeek} 
                  onChange={e => setSelectedWeek(e.target.value)}
                >
                  <option value="">— Selecciona una semana —</option>
                  {sortedWeeks.map(w => (
                    <option key={w.id} value={w.id}>
                      {fmtDate(w.week_date)} - Total: {fmt(w.total_general)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="text-sm text-olive hover:text-olive-dark underline mt-2"
              >
                + Crear nueva semana
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="label-base">Fecha de la nueva semana (viernes)</label>
                <input
                  type="date"
                  className="input-base w-full"
                  value={newWeekDate}
                  onChange={e => setNewWeekDate(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recomendado: usar viernes
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreatingNew(false)}
                className="text-sm text-olive hover:text-olive-dark underline mt-2"
              >
                ← Volver a semanas existentes
              </button>
            </>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button 
            onClick={handleConfirm}
            className="btn-primary flex-1"
          >
            Aceptar y Pasar
          </button>
          <button 
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal selector de semana (solo para reportes ya aceptados) ───────────────
function ModalSelectorSemana({ reportId, weeks, onConfirm, onClose }) {
  const [selectedWeek, setSelectedWeek] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [newWeekDate, setNewWeekDate] = useState(nextFridayISO());

  const handleConfirm = async () => {
    if (!selectedWeek && !creatingNew) {
      toast.error('Selecciona una semana o crea una nueva');
      return;
    }

    let weekId;
    
    if (creatingNew) {
      // Crear nueva semana
      try {
        const { data } = await axios.post(`${API}/reports`, { week_date: newWeekDate });
        weekId = data.id;
        toast.success(`Semana ${newWeekDate} creada`);
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Error al crear semana');
        return;
      }
    } else {
      weekId = selectedWeek;
    }

    onConfirm(reportId, weekId);
  };

  const sortedWeeks = [...weeks].sort((a, b) => new Date(b.week_date) - new Date(a.week_date));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-brown">Seleccionar Semana</h2>
        <p className="text-sm text-gray-600">¿A qué relación semanal quieres pasar este reporte?</p>

        {!creatingNew ? (
          <>
            <div>
              <label className="label-base">Semana existente</label>
              <select 
                className="input-base w-full" 
                value={selectedWeek} 
                onChange={e => setSelectedWeek(e.target.value)}
              >
                <option value="">— Selecciona una semana —</option>
                {sortedWeeks.map(w => (
                  <option key={w.id} value={w.id}>
                    {fmtDate(w.week_date)} - Total: {fmt(w.total_general)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="text-sm text-olive hover:text-olive-dark underline"
            >
              + Crear nueva semana
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label-base">Fecha de la nueva semana (viernes)</label>
              <input
                type="date"
                className="input-base w-full"
                value={newWeekDate}
                onChange={e => setNewWeekDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Recomendado: usar viernes
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCreatingNew(false)}
              className="text-sm text-olive hover:text-olive-dark underline"
            >
              ← Volver a semanas existentes
            </button>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button 
            onClick={handleConfirm}
            className="btn-primary flex-1"
          >
            Confirmar
          </button>
          <button 
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function Reportes() {
  const [reportes, setReportes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [reportToAccept, setReportToAccept] = useState(null);

  const load = async () => {
    try {
      const [r, p, c, w] = await Promise.all([
        axios.get(`${API}/reportes`),
        axios.get(`${API}/projects`),
        axios.get(`${API}/contractors`),
        axios.get(`${API}/reports`),
      ]);
      setReportes(r.data);
      setProjects(p.data);
      setContractors(c.data);
      setWeeks(w.data);
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleConfirmAcceptAndPasar = async (reportId, monto, weekId) => {
    try {
      // 1. Aceptar el reporte con el monto
      await axios.patch(`${API}/reportes/${reportId}/accept`, { amount_accepted: monto });
      
      // 2. Pasar a la semana seleccionada
      await axios.post(`${API}/reportes/${reportId}/pasar`, { weekly_report_id: weekId });
      
      toast.success('Reporte aceptado y pasado a relación semanal');
      setShowAcceptModal(false);
      setReportToAccept(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error al procesar reporte');
    }
  };

  const handleAction = async (action, idOrReport, payload = {}) => {
    try {
      if (action === 'delete') {
        const id = typeof idOrReport === 'object' ? idOrReport.id : idOrReport;
        if (!window.confirm('¿Eliminar este reporte?')) return;
        await axios.delete(`${API}/reportes/${id}`);
        toast.success('Eliminado');
        load();
      } else if (action === 'accept') {
        // Abrir modal de aceptar y pasar
        setReportToAccept(idOrReport); // idOrReport es el objeto completo del reporte
        setShowAcceptModal(true);
        return; // No recargar todavía
      } else if (action === 'reject') {
        const id = typeof idOrReport === 'object' ? idOrReport.id : idOrReport;
        await axios.patch(`${API}/reportes/${id}/reject`);
        toast.success('Rechazado');
        load();
      } else if (action === 'reset') {
        const id = typeof idOrReport === 'object' ? idOrReport.id : idOrReport;
        await axios.patch(`${API}/reportes/${id}/reset`);
        toast.success('Revertido a pendiente');
        load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Error');
    }
  };

  const pending  = reportes.filter(r => r.status === 'pending');
  const accepted = reportes.filter(r => r.status === 'accepted');
  const rejected = reportes.filter(r => r.status === 'rejected');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-olive">
        Cargando reportes…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brown">Reportes de Avance</h1>
          <p className="text-xs md:text-sm text-olive mt-0.5">
            {reportes.length} reporte{reportes.length !== 1 ? 's' : ''} · {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 justify-center"
        >
          <Plus size={16} /> Nuevo Reporte
        </button>
      </div>

      {/* Pendientes */}
      <Section title="Pendientes" color="bg-amber-100 text-amber-800" icon={Clock} count={pending.length}>
        {pending.length === 0
          ? <p className="text-sm text-gray-400 px-2">Sin reportes pendientes</p>
          : pending.map(r => (
              <ReporteCard key={r.id} r={r} weeks={weeks} onAction={handleAction} />
            ))}
      </Section>

      {/* Aceptados */}
      <Section title="Aceptados" color="bg-olive/20 text-olive-dark" icon={CheckCircle} count={accepted.length}>
        {accepted.length === 0
          ? <p className="text-sm text-gray-400 px-2">Sin reportes aceptados</p>
          : accepted.map(r => (
              <ReporteCard key={r.id} r={r} weeks={weeks} onAction={handleAction} />
            ))}
      </Section>

      {/* Rechazados */}
      <Section title="Rechazados" color="bg-red-100 text-red-700" icon={XCircle} count={rejected.length}>
        {rejected.length === 0
          ? <p className="text-sm text-gray-400 px-2">Sin reportes rechazados</p>
          : rejected.map(r => (
              <ReporteCard key={r.id} r={r} weeks={weeks} onAction={handleAction} />
            ))}
      </Section>

      {/* Modal nuevo reporte */}
      {showForm && (
        <NuevoReporte
          projects={projects}
          contractors={contractors}
          onSave={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Modal aceptar y pasar */}
      {showAcceptModal && reportToAccept && (
        <ModalAceptarYPasar
          reporte={reportToAccept}
          weeks={weeks}
          onConfirm={handleConfirmAcceptAndPasar}
          onClose={() => {
            setShowAcceptModal(false);
            setReportToAccept(null);
          }}
        />
      )}
    </div>
  );
}
