import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Plus, Trash2, ChevronDown, ChevronUp, History } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { mxn, saldoClass, formatWeekDate, fmtDate } from '../utils.js';

// ── Inline editable cell ──────────────────────────────────────────────────────
function EditCell({ value, onSave, className = '', isCurrency = false, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

  if (readOnly) {
    return <span className={className}>{isCurrency ? mxn(value) : value}</span>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={isCurrency ? 'number' : 'text'}
        value={draft}
        onChange={e => setDraft(isCurrency ? Number(e.target.value) : e.target.value)}
        onBlur={() => { setEditing(false); onSave(draft); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { setEditing(false); onSave(draft); }
          if (e.key === 'Escape') { setEditing(false); setDraft(value); }
        }}
        className="w-full bg-sand-lightest border border-olive/60 rounded px-2 py-1 text-brown text-sm font-mono focus:outline-none"
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:bg-sand-light/60 px-1 py-0.5 rounded transition-colors ${className}`}
      onClick={() => { setEditing(true); setDraft(value); }}
      title="Clic para editar"
    >
      {isCurrency ? mxn(value) : (value || '—')}
    </span>
  );
}

// ── Fila de entry ─────────────────────────────────────────────────────────────
function EntryRow({ entry, reportId, onUpdated, onDelete, onShowHistory }) {
  const vp          = entry.vp || 0;
  const saldo       = vp - entry.ent_a_cta;
  const saldo_final = saldo - entry.rep_a_cta;

  const save = useCallback(async (field, val) => {
    try {
      await axios.put(`/api/reports/${reportId}/entries/${entry.id}`, { [field]: val });
      onUpdated();
    } catch {
      toast.error('Error al guardar');
    }
  }, [reportId, entry.id, onUpdated]);

  return (
    <tr className="table-row text-sm">
      <td className="px-2 md:px-4 py-2.5 text-gray-600 text-xs md:text-sm">{entry.contractor_name}</td>
          <td className="px-2 md:px-4 py-2.5 text-right font-mono text-brown/60 text-xs md:text-sm">{mxn(vp)}</td>
      <td className="px-2 md:px-4 py-2.5 text-right font-mono text-xs md:text-sm">
        <div className="flex items-center justify-end gap-1">
          <EditCell value={entry.ent_a_cta} isCurrency onSave={v => save('ent_a_cta', v)} />
          {entry.ent_a_cta > 0 && (
            <button
              onClick={() => onShowHistory(entry)}
              className="text-olive/60 hover:text-olive transition-colors"
              title="Ver historial de pagos"
            >
              <History size={14} />
            </button>
          )}
        </div>
      </td>
      <td className={`px-2 md:px-4 py-2.5 text-right font-mono font-semibold text-xs md:text-sm ${saldoClass(saldo)}`}>
        {mxn(saldo)}
      </td>
      <td className="px-2 md:px-4 py-2.5 text-right font-mono text-xs md:text-sm">
        <EditCell value={entry.rep_a_cta} isCurrency onSave={v => save('rep_a_cta', v)} />
      </td>
      <td className={`px-2 md:px-4 py-2.5 text-right font-mono font-bold text-xs md:text-sm ${saldoClass(saldo_final)}`}>
        {mxn(saldo_final)}
      </td>
      <td className="px-2 md:px-4 py-2.5 max-w-[120px] md:max-w-[160px]">
        <EditCell value={entry.notes || ''} onSave={v => save('notes', v)} className="text-gray-500 text-xs" />
      </td>
      <td className="px-2 md:px-4 py-2.5">
        <button onClick={() => onDelete(entry.id)} className="text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 size={13} className="md:hidden" />
          <Trash2 size={14} className="hidden md:block" />
        </button>
      </td>
    </tr>
  );
}

// ── Fila de oficina ───────────────────────────────────────────────────────────
function OfficeRow({ payment, reportId, onUpdated, onDelete }) {
  const save = useCallback(async (field, val) => {
    try {
      await axios.put(`/api/reports/${reportId}/office/${payment.id}`, { [field]: val });
      onUpdated();
    } catch {
      toast.error('Error al guardar');
    }
  }, [reportId, payment.id, onUpdated]);

  return (
    <tr className="table-row text-sm">
      <td className="px-2 md:px-4 py-2.5 text-xs md:text-sm">
        <EditCell value={payment.person_name} onSave={v => save('person_name', v)} className="text-gray-900 font-medium" />
      </td>
      <td className="px-4 py-2.5 text-right font-mono">
        <EditCell value={payment.amount} isCurrency onSave={v => save('amount', v)} className="text-green-700 font-semibold" />
      </td>
      <td className="px-2 md:px-4 py-2.5">
        <button onClick={() => onDelete(payment.id)} className="text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 size={13} className="md:hidden" />
          <Trash2 size={14} className="hidden md:block" />
        </button>
      </td>
    </tr>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddOffice, setShowAddOffice] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Modal de historial
  const [showHistory, setShowHistory]     = useState(false);
  const [historyData, setHistoryData]     = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Formulario agregar entry
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects]       = useState([]);
  const [newEntry, setNewEntry]       = useState({ contractor_id: '', project_id: '', ent_a_cta: 0, rep_a_cta: 0, vp: 0, notes: '' });
  const [newOffice, setNewOffice]     = useState({ person_name: '', amount: 0 });

  const load = useCallback(() => {
    axios.get(`/api/reports/${id}`).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    axios.get('/api/contractors').then(r => setContractors(r.data));
    axios.get('/api/projects').then(r => setProjects(r.data));
  }, []);

  const toggleProject = (pid) =>
    setCollapsed(c => ({ ...c, [pid]: !c[pid] }));

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await axios.delete(`/api/reports/${id}/entries/${entryId}`);
    toast.success('Entrada eliminada');
    load();
  };

  const handleDeleteOffice = async (payId) => {
    if (!confirm('¿Eliminar este pago?')) return;
    await axios.delete(`/api/reports/${id}/office/${payId}`);
    toast.success('Pago eliminado');
    load();
  };
  
  const handleShowHistory = async (entry) => {
    setSelectedEntry(entry);
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`/api/reports/history/${entry.contractor_id}/${entry.project_id}`);
      setHistoryData(res.data);
    } catch (e) {
      toast.error('Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddEntry = async () => {
    try {
      await axios.post(`/api/reports/${id}/entries`, newEntry);
      toast.success('Entrada agregada');
      setShowAddEntry(false);
      setNewEntry({ contractor_id: '', project_id: '', ent_a_cta: 0, rep_a_cta: 0, vp: 0, notes: '' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al agregar');
    }
  };

  const handleAddOffice = async () => {
    if (!newOffice.person_name) return toast.error('Ingresa el nombre');
    try {
      await axios.post(`/api/reports/${id}/office`, newOffice);
      toast.success('Pago de oficina agregado');
      setShowAddOffice(false);
      setNewOffice({ person_name: '', amount: 0 });
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al agregar');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const resp = await axios.get(`/api/reports/${id}/export`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([resp.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `relacion-${data.report.week_date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Error al exportar'); }
    finally { setExporting(false); }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta semana completa? Esta acción no se puede deshacer.')) return;
    try {
      await axios.delete(`/api/reports/${id}`);
      toast.success('Semana eliminada');
      navigate('/reports');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400">No encontrada</p>;

  const { report, projects: projGroups, office_payments, summary, total_projects, total_office, total_general } = data;

  return (
    <div className="space-y-4 md:space-y-6 pb-8 md:pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={18} className="md:hidden" />
            <ArrowLeft size={20} className="hidden md:block" />
          </Link>
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-brown capitalize">{formatWeekDate(report.week_date)}</h1>
            <p className="text-xs text-brown/50 mt-0.5">Haz clic en cualquier valor para editarlo en línea</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} disabled={exporting}
            className="btn-secondary btn-sm flex items-center gap-2 text-xs">
            <Download size={14} /> {exporting ? 'Exportando…' : 'Excel'}
          </button>
          <button onClick={() => setShowAddEntry(true)} className="btn-primary btn-sm flex items-center gap-2 text-xs">
            <Plus size={14} /> <span className="hidden sm:inline">Contratista</span><span className="sm:hidden">+</span>
          </button>
          <button onClick={handleDelete} className="btn-danger btn-sm flex items-center gap-2 text-xs">
            <Trash2 size={14} /> <span className="hidden sm:inline">Eliminar semana</span>
          </button>
        </div>
      </div>

      {/* Proyectos */}
      {projGroups.map(proj => (
        <div key={proj.project_id} className="glass-card overflow-hidden">
          <button
            onClick={() => toggleProject(proj.project_id)}
            className="w-full flex items-center justify-between px-4 md:px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-orange-50/40 transition-colors"
          >
            <span className="font-bold text-gray-900 tracking-wide text-sm md:text-base truncate pr-3">{proj.project_name}</span>
            <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm shrink-0">
              <span className="text-gray-500">
                <span className="hidden sm:inline">Rep. A Cta.: </span><span className="text-green-600 font-mono">{mxn(proj.entries.reduce((s,e) => s + e.rep_a_cta, 0))}</span>
              </span>
              {collapsed[proj.project_id] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
            </div>
          </button>

          {!collapsed[proj.project_id] && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-xs text-brown/50 uppercase tracking-wider border-b border-sand-light bg-sand-lightest/80">
                    <th className="px-2 md:px-4 py-2.5 text-left">Contratista</th>
                    <th className="px-2 md:px-4 py-2.5 text-right">V.P.</th>
                    <th className="px-2 md:px-4 py-2.5 text-right">Ent. A Cta.</th>
                    <th className="px-2 md:px-4 py-2.5 text-right">Saldo</th>
                    <th className="px-2 md:px-4 py-2.5 text-right">Rep. A Cta.</th>
                    <th className="px-2 md:px-4 py-2.5 text-right">Saldo Final</th>
                    <th className="px-2 md:px-4 py-2.5">Notas</th>
                    <th className="px-2 md:px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {proj.entries.map(e => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      reportId={id}
                      onUpdated={load}
                      onDelete={handleDeleteEntry}
                      onShowHistory={handleShowHistory}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Oficina */}
      <div className="glass-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 md:px-5 py-3 bg-sand-light/40 border-b border-sand-light">
          <span className="font-bold text-brown text-sm md:text-base">OFICINA</span>
          <div className="flex items-center gap-3 md:gap-4">
            <span className="text-xs md:text-sm text-brown/60">
              Total: <span className="text-green-700 font-mono">{mxn(total_office)}</span>
            </span>
            <button onClick={() => setShowAddOffice(true)} className="btn-primary btn-sm flex items-center gap-1 text-xs">
              <Plus size={14} /> <span className="hidden sm:inline">Agregar</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-brown/50 uppercase tracking-wider border-b border-sand-light bg-sand-lightest/80">
                <th className="px-3 md:px-4 py-2.5 text-left">Persona</th>
                <th className="px-3 md:px-4 py-2.5 text-right">Monto</th>
                <th className="px-3 md:px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {office_payments.map(op => (
                <OfficeRow
                  key={op.id}
                  payment={op}
                  reportId={id}
                  onUpdated={load}
                  onDelete={handleDeleteOffice}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales generales */}
<div className="glass-card p-4 md:p-5 border-olive/20">
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-4 md:gap-6 md:justify-between md:items-center">
          <div>
            <p className="text-xs text-brown/50 uppercase tracking-wider">Total Proyectos</p>
            <p className="text-base md:text-xl font-bold text-brown font-mono">{mxn(total_projects)}</p>
          </div>
          <div>
            <p className="text-xs text-brown/50 uppercase tracking-wider">Total Oficina</p>
            <p className="text-base md:text-xl font-bold text-brown font-mono">{mxn(total_office)}</p>
          </div>
          <div className="col-span-2 md:col-span-1 text-center md:text-right">
            <p className="text-xs text-brown/50 uppercase tracking-wider">TOTAL GENERAL</p>
            <p className="text-2xl md:text-3xl font-bold text-olive-dark font-mono">{mxn(total_general)}</p>
          </div>
        </div>
      </div>

      {/* Resumen por contratista */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 md:px-5 py-3 bg-sand-light/40 border-b border-sand-light">
          <span className="font-bold text-brown text-sm md:text-base">RESUMEN — Contratistas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="text-xs text-brown/50 uppercase tracking-wider border-b border-sand-light">
                <th className="px-3 md:px-5 py-3 text-left">#</th>
                <th className="px-3 md:px-5 py-3 text-left">Contratista</th>
                <th className="px-3 md:px-5 py-3 text-right">Rep. A Cta.</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s, i) => (
                <tr key={s.contractor_id || `office_${i}`} className="table-row text-sm">
                  <td className="px-3 md:px-5 py-2.5 text-brown/50 text-xs md:text-sm">{i + 1}</td>
                  <td className="px-3 md:px-5 py-2.5 font-medium text-brown text-xs md:text-sm">
                    {s.contractor_name}
                    {s.is_office && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Oficina</span>}
                  </td>
                  <td className="px-3 md:px-5 py-2.5 text-right font-mono text-green-700 font-semibold text-xs md:text-sm">{mxn(s.total_rep_a_cta)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-sand">
                <td colSpan={2} className="px-3 md:px-5 py-3 font-bold text-brown text-sm md:text-base">TOTAL GENERAL</td>
                <td className="px-3 md:px-5 py-3 text-right font-mono font-bold text-olive-dark text-base md:text-lg">{mxn(total_general)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal: agregar contratista */}
      {showAddEntry && (
        <Modal title="Agregar Contratista a esta Semana" onClose={() => setShowAddEntry(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Proyecto</label>
              <select className="input-field"
                value={newEntry.project_id}
                onChange={e => setNewEntry(n => ({ ...n, project_id: e.target.value }))}
              >
                <option value="">Selecciona…</option>
                {projects.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Contratista</label>
              <select className="input-field"
                value={newEntry.contractor_id}
                onChange={e => setNewEntry(n => ({ ...n, contractor_id: e.target.value }))}
              >
                <option value="">Selecciona…</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">V.P.</label>
                <input type="number" className="input-field" value={newEntry.vp}
                  onChange={e => setNewEntry(n => ({ ...n, vp: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Ent. A Cta.</label>
                <input type="number" className="input-field" value={newEntry.ent_a_cta}
                  onChange={e => setNewEntry(n => ({ ...n, ent_a_cta: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Notas</label>
              <input type="text" className="input-field" value={newEntry.notes}
                onChange={e => setNewEntry(n => ({ ...n, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowAddEntry(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAddEntry}>Agregar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: agregar oficina */}
      {showAddOffice && (
        <Modal title="Agregar Pago Oficina" onClose={() => setShowAddOffice(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Persona</label>
              <input type="text" className="input-field" value={newOffice.person_name}
                onChange={e => setNewOffice(n => ({ ...n, person_name: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Monto</label>
              <input type="number" className="input-field" value={newOffice.amount}
                onChange={e => setNewOffice(n => ({ ...n, amount: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowAddOffice(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAddOffice}>Agregar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: historial de pagos */}
      {showHistory && selectedEntry && (
        <Modal 
          title={`Historial de Pagos — ${selectedEntry.contractor_name}`} 
          onClose={() => setShowHistory(false)}
          size="md"
        >
          <div className="space-y-3">
            <p className="text-sm text-brown/60">
              Proyecto: <span className="font-semibold text-brown">{selectedEntry.project_name}</span>
            </p>
            <p className="text-sm text-brown/60">
              Total pagado: <span className="font-mono font-bold text-green-700 text-base">{mxn(selectedEntry.ent_a_cta)}</span>
            </p>
            
            <div className="border-t border-sand-light pt-3">
              <h4 className="text-xs font-semibold text-brown/50 uppercase mb-2">Desglose por semana</h4>
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-olive/30 border-t-olive rounded-full animate-spin" />
                </div>
              ) : historyData.length === 0 ? (
                <p className="text-center text-brown/40 text-sm py-4">Sin pagos registrados</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyData.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-sand-lightest/60 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-brown">{formatWeekDate(h.week_date)}</p>
                        {h.notes && <p className="text-xs text-brown/50 mt-0.5">{h.notes}</p>}
                      </div>
                      <span className="font-mono text-sm font-semibold text-green-700">{mxn(h.rep_a_cta)}</span>
                    </div>
                  ))}
                  <div className="border-t border-sand pt-2 flex justify-between items-center px-3">
                    <span className="text-sm font-bold text-brown">TOTAL</span>
                    <span className="font-mono font-bold text-olive-dark">{mxn(historyData.reduce((sum, h) => sum + h.rep_a_cta, 0))}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}
