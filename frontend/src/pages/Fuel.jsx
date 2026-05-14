import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, Fuel, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import { mxn, saldoClass, fmtDate } from '../utils.js';

const TYPE_LABEL = {
  FACTURA_GAS: 'Factura Gas',
  APORTACION:  'Aportación',
  RETIRO:      'Retiro',
};
const TYPE_CLASS = {
  FACTURA_GAS: 'bg-blue-500/20 text-blue-400',
  APORTACION:  'bg-green-500/20 text-green-400',
  RETIRO:      'bg-red-500/20 text-red-400',
};

const EMPTY_FORM = { date: new Date().toISOString().split('T')[0], type: 'FACTURA_GAS', amount: '', description: '' };

export default function FuelPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);

  const loadSummary = () =>
    axios.get('/api/fuel/summary').then(r => setSummary(r.data));

  const loadTransactions = useCallback(() => {
    const params = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo)   params.to   = dateTo;
    return axios.get('/api/fuel', { params }).then(r => setTransactions(r.data));
  }, [dateFrom, dateTo]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadTransactions()]).finally(() => setLoading(false));
  }, [loadTransactions]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditItem(null); setShowModal(true); };
  const openEdit   = (t) => {
    setForm({ date: t.date, type: t.type, amount: t.amount, description: t.description || '' });
    setEditItem(t);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.date) return toast.error('Fecha y monto son requeridos');
    setSaving(true);
    try {
      if (editItem) {
        await axios.put(`/api/fuel/${editItem.id}`, form);
        toast.success('Transacción actualizada');
      } else {
        await axios.post('/api/fuel', form);
        toast.success('Transacción registrada');
      }
      setShowModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    if (!confirm(`¿Eliminar esta transacción de ${mxn(t.amount)}?`)) return;
    await axios.delete(`/api/fuel/${t.id}`);
    toast.success('Eliminada');
    load();
  };

  const disponible = summary ? summary.total_gas + summary.total_aportacion - summary.total_retiro : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Gasolinas / Caja</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus size={16} /> Nueva Transacción
        </button>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Gas (Facturas)" value={mxn(summary.total_gas)} icon={Fuel} color="blue" />
          <StatCard title="Total Aportaciones" value={mxn(summary.total_aportacion)} icon={TrendingUp} color="green" />
          <StatCard
            title="Total Retiros"
            value={mxn(summary.total_retiro)}
            icon={TrendingDown}
            color="red"
          />
          <StatCard
            title="Disponible"
            value={mxn(disponible)}
            icon={Wallet}
            color={disponible < 0 ? 'red' : 'green'}
            alert={disponible < 0}
            subtitle={disponible < 0 ? 'Déficit de caja' : 'Saldo disponible'}
          />
        </div>
      )}

      {/* Filtros */}
      <div className="glass-card p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Desde</label>
          <input type="date" className="input-field w-44" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
          <input type="date" className="input-field w-44" value={dateTo}
            onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn-secondary btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
          Limpiar filtros
        </button>
      </div>

      {/* Tabla */}
      <div className="glass-card overflow-hidden">
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/10 bg-navy-light">
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Descripción</th>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Sin transacciones</td></tr>
                ) : transactions.map(t => (
                  <tr key={t.id} className="table-row text-sm">
                    <td className="px-5 py-3 text-gray-300 font-mono">{fmtDate(t.date)}</td>
                    <td className="px-5 py-3 text-white">{t.description || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`tag ${TYPE_CLASS[t.type]}`}>{TYPE_LABEL[t.type]}</span>
                    </td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold
                      ${t.type === 'RETIRO' ? 'text-red-400' : 'text-green-400'}`}>
                      {t.type === 'RETIRO' ? '-' : ''}{mxn(t.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-accent transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(t)} className="text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal transacción */}
      {showModal && (
        <Modal
          title={editItem ? 'Editar Transacción' : 'Nueva Transacción'}
          onClose={() => setShowModal(false)}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha *</label>
              <input type="date" className="input-field" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo *</label>
              <select className="input-field" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="FACTURA_GAS">Factura Gas</option>
                <option value="APORTACION">Aportación</option>
                <option value="RETIRO">Retiro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Monto *</label>
              <input type="number" min="0" step="0.01" className="input-field" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
              <input type="text" className="input-field" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}
