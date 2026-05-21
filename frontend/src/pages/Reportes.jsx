import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, CheckCircle, XCircle, ArrowRight, Trash2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [accepting, setAccepting] = useState(false);
  const [acceptAmt, setAcceptAmt] = useState(r.amount_reported);
  const [changing, setChanging] = useState(false);
  const [changeAmt, setChangeAmt] = useState(r.amount_reported);

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
          {r.status === 'pending' && !accepting && !changing && (
            <>
              <button
                onClick={() => { setAccepting(true); setAcceptAmt(r.amount_reported); }}
                className="btn-sm bg-green-600 text-white hover:bg-green-700 text-xs"
              >
                <CheckCircle size={12} className="md:hidden" />
                <CheckCircle size={13} className="hidden md:block" />
                <span className="hidden sm:inline">Aceptar</span>
              </button>
              <button
                onClick={() => { setChanging(true); setChangeAmt(r.amount_reported); }}
                className="btn-sm bg-amber-500 text-white hover:bg-amber-600 text-xs"
              >
                <XCircle size={12} className="md:hidden" />
                <XCircle size={13} className="hidden md:block" />
                <span className="hidden sm:inline">Cambiar monto</span>
              </button>
            </>
          )}
          {r.status === 'accepted' && !r.weekly_report_id && (
            <>
              <button
                onClick={() => onAction('pasar', r.id)}
                className="btn-sm bg-brown text-white hover:bg-brown/80 text-xs"
              >
                <ArrowRight size={12} className="md:hidden" />
                <ArrowRight size={13} className="hidden md:block" />
                <span className="hidden sm:inline">Pasar</span>
              </button>
              <button
                onClick={() => onAction('reset', r.id)}
                className="btn-sm bg-sand text-brown hover:bg-sand-dark border border-brown/20 text-xs"
              >
                Revertir
              </button>
            </>
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

      {/* Panel aceptar con monto */}
      {accepting && (
        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-300 space-y-2">
          <p className="text-xs font-medium text-green-800">Monto a aceptar:</p>
          <input
            type="number"
            className="input-base w-full"
            value={acceptAmt}
            onChange={e => setAcceptAmt(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-sm bg-green-600 text-white hover:bg-green-700 flex-1"
              onClick={() => { onAction('accept', r.id, { amount: acceptAmt }); setAccepting(false); }}
            >
              Confirmar
            </button>
            <button
              className="btn-sm bg-sand text-brown border border-brown/20 flex-1"
              onClick={() => setAccepting(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Panel cambiar monto */}
      {changing && (
        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-300 space-y-2">
          <p className="text-xs font-medium text-amber-800">Nuevo monto negociado:</p>
          <input
            type="number"
            className="input-base w-full"
            value={changeAmt}
            onChange={e => setChangeAmt(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-1"
              onClick={() => { onAction('accept', r.id, { amount: changeAmt }); setChanging(false); }}
            >
              Confirmar
            </button>
            <button
              className="btn-sm bg-sand text-brown border border-brown/20 flex-1"
              onClick={() => setChanging(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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

// ── Página principal ────────────────────────────────────────────────────────
export default function Reportes() {
  const [reportes, setReportes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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

  const handleAction = async (action, id, payload = {}) => {
    try {
      if (action === 'delete') {
        if (!window.confirm('¿Eliminar este reporte?')) return;
        await axios.delete(`${API}/reportes/${id}`);
        toast.success('Eliminado');
      } else if (action === 'accept') {
        await axios.patch(`${API}/reportes/${id}/accept`, { amount_accepted: payload.amount });
        toast.success('Aceptado');
      } else if (action === 'reject') {
        await axios.patch(`${API}/reportes/${id}/reject`);
        toast.success('Rechazado');
      } else if (action === 'reset') {
        await axios.patch(`${API}/reportes/${id}/reset`);
        toast.success('Revertido a pendiente');
      } else if (action === 'pasar') {
        // Buscar o crear semana del viernes más próximo
        const targetDate = nextFridayISO();
        let week = weeks.find(w => w.week_date === targetDate);
        
        if (!week) {
          const { data } = await axios.post(`${API}/reports`, { week_date: targetDate });
          week = { id: data.id, week_date: targetDate };
          toast.success(`Semana ${targetDate} creada`);
        }
        
        await axios.post(`${API}/reportes/${id}/pasar`, { weekly_report_id: week.id });
        toast.success('Pasado a relación semanal');
      }
      load();
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
    </div>
  );
}
