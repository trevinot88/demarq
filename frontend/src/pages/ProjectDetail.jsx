import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { mxn, saldoClass, formatWeekDate } from '../utils.js';

export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [allContractors, setAllContractors] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [showExtras, setShowExtras] = useState(null); // { contractor_id, contractor_name }
  const [assignForm, setAssignForm] = useState({ contractor_id: '', valor_presupuesto: 0 });
  const [budgetVal, setBudgetVal] = useState(0);
  const [pagadoVal, setPagadoVal] = useState(0);

  const load = () => {
    setLoading(true);
    axios.get(`/api/projects/${id}`).then(r => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    axios.get('/api/contractors').then(r => setAllContractors(r.data));
  }, [id]);

  const handleAssign = async () => {
    if (!assignForm.contractor_id) return toast.error('Selecciona un contratista');
    try {
      await axios.post(`/api/projects/${id}/contractors`, assignForm);
      toast.success('Contratista asignado');
      setShowAssign(false);
      setAssignForm({ contractor_id: '', valor_presupuesto: 0 });
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
  };

  const handleUpdateVP = async () => {
    try {
      await axios.put(`/api/projects/${id}/contractors/${editBudget.contractor_id}`, { 
        valor_presupuesto: budgetVal,
        total_pagado_manual: pagadoVal
      });
      toast.success('Valores actualizados');
      setEditBudget(null);
      load();
    } catch { toast.error('Error al actualizar'); }
  };

  const handleRemoveContractor = async (cid, name) => {
    if (!confirm(`¿Quitar a ${name} de este proyecto?`)) return;
    await axios.delete(`/api/projects/${id}/contractors/${cid}`);
    toast.success('Contratista removido');
    load();
  };

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-500">No encontrado</p>;

  const { project, contractors, history } = data;

  const assignedIds = new Set(contractors.map(c => c.contractor_id));
  const unassigned  = allContractors.filter(c => !assignedIds.has(c.id));

  return (
    <div className="space-y-4 md:space-y-6 pb-8 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 md:gap-4">
        <Link to="/projects" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} className="md:hidden" /><ArrowLeft size={20} className="hidden md:block" /></Link>
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-xs md:text-sm text-gray-500">
            {project.client_name || 'Sin cliente'} ·{' '}
            <span className={project.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
              {project.status === 'active' ? 'Activo' : 'Cerrado'}
            </span>
          </p>
        </div>
      </div>

      {/* Contratistas asignados */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-5 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm md:text-base font-semibold text-gray-900">Contratistas Asignados</span>
          <button onClick={() => setShowAssign(true)} className="btn-primary btn-sm flex items-center gap-1 text-xs">
            <Plus size={14} /> <span className="hidden sm:inline">Asignar</span>
          </button>
        </div>
        {contractors.length === 0 ? (
          <p className="px-4 md:px-5 py-6 text-gray-500 text-sm">No hay contratistas asignados.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-3 md:px-5 py-3 text-left">Contratista</th>
                <th className="px-3 md:px-5 py-3 text-right">V.P. Base</th>
                <th className="px-3 md:px-5 py-3 text-right">Extras</th>
                <th className="px-3 md:px-5 py-3 text-right">V.P. Total</th>
                <th className="px-3 md:px-5 py-3 text-right">Pagado</th>
                <th className="px-3 md:px-5 py-3 text-right">Saldo</th>
                <th className="px-3 md:px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map(c => {
                const vpBase = c.valor_presupuesto || 0;
                const extras = c.total_extras || 0;
                const vpTotal = vpBase + extras;
                const saldo = vpTotal - c.total_pagado;
                return (
                  <tr key={c.contractor_id} className="table-row text-sm">
                    <td className="px-3 md:px-5 py-2 md:py-3 text-gray-900 font-medium text-xs md:text-sm">{c.contractor_name}</td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-right font-mono text-gray-700 text-xs md:text-sm">{mxn(vpBase)}</td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-right text-xs md:text-sm">
                      {extras > 0 ? (
                        <button
                          onClick={() => setShowExtras({ contractor_id: c.contractor_id, contractor_name: c.contractor_name })}
                          className="font-mono text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          +{mxn(extras)}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-right font-mono text-gray-900 font-semibold text-xs md:text-sm">{mxn(vpTotal)}</td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-right font-mono text-gray-600 text-xs md:text-sm">{mxn(c.total_pagado)}</td>
                    <td className={`px-3 md:px-5 py-2 md:py-3 text-right font-mono font-semibold text-xs md:text-sm ${
                      saldo < 0 ? 'text-red-600' : saldo === 0 ? 'text-gray-400' : 'text-green-600'
                    }`}>
                      {mxn(saldo)}
                    </td>
                    <td className="px-3 md:px-5 py-2 md:py-3 text-right">
                    <div className="flex justify-end gap-2 md:gap-3">
                      <button
                        onClick={() => setShowExtras({ contractor_id: c.contractor_id, contractor_name: c.contractor_name })}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Ver/Agregar extras"
                      ><Plus size={14} /></button>
                      <button
                        onClick={() => { 
                          setEditBudget(c); 
                          setBudgetVal(c.valor_presupuesto); 
                          setPagadoVal(c.total_pagado || 0);
                        }}
                        className="text-gray-400 hover:text-accent transition-colors"
                      ><Pencil size={14} /></button>
                      <button
                        onClick={() => handleRemoveContractor(c.contractor_id, c.contractor_name)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Historial de semanas */}
      {history.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 md:px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm md:text-base font-semibold text-gray-900">Historial Semanal</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-3 md:px-5 py-3 text-left">Semana</th>
                <th className="px-3 md:px-5 py-3 text-right">Ent. A Cta.</th>
                <th className="px-3 md:px-5 py-3 text-right">Rep. A Cta.</th>
                <th className="px-3 md:px-5 py-3 text-right">Contratistas</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="table-row text-sm">
                  <td className="px-3 md:px-5 py-2 md:py-3 text-gray-900 capitalize text-xs md:text-sm">{formatWeekDate(h.week_date)}</td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-right font-mono text-gray-700 text-xs md:text-sm">{mxn(h.total_ent)}</td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-right font-mono text-green-600 font-semibold text-xs md:text-sm">{mxn(h.total_rep)}</td>
                  <td className="px-3 md:px-5 py-2 md:py-3 text-right text-gray-500 text-xs md:text-sm">{h.contractors_active}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal: asignar contratista */}
      {showAssign && (
        <Modal title="Asignar Contratista" onClose={() => setShowAssign(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Contratista</label>
              <select className="input-field" value={assignForm.contractor_id}
                onChange={e => setAssignForm(f => ({ ...f, contractor_id: e.target.value }))}>
                <option value="">Selecciona…</option>
                {unassigned.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Valor Presupuesto (VP)</label>
              <input type="number" className="input-field" value={assignForm.valor_presupuesto}
                onChange={e => setAssignForm(f => ({ ...f, valor_presupuesto: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowAssign(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAssign}>Asignar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: editar VP */}
      {editBudget && (
        <Modal title={`Editar — ${editBudget.contractor_name}`} onClose={() => setEditBudget(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">V.P. Base</label>
              <input type="number" className="input-field" value={budgetVal}
                onChange={e => setBudgetVal(Number(e.target.value))} />
              <p className="text-xs text-gray-400 mt-1">
                Este es el presupuesto base. Los extras se gestionan por separado.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Total Pagado</label>
              <input type="number" className="input-field" value={pagadoVal}
                onChange={e => setPagadoVal(Number(e.target.value))} />
              <p className="text-xs text-gray-400 mt-1">
                Monto total que se ha pagado a este contratista en este proyecto.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setEditBudget(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleUpdateVP}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: extras */}
      {showExtras && (
        <ExtrasModal
          projectId={id}
          contractorId={showExtras.contractor_id}
          contractorName={showExtras.contractor_name}
          onClose={() => setShowExtras(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

// ── Modal de Extras ──────────────────────────────────────────────────────────
function ExtrasModal({ projectId, contractorId, contractorName, onClose, onUpdated }) {
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const loadExtras = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/projects/${projectId}/contractors/${contractorId}/extras`);
      setExtras(data);
    } catch {
      toast.error('Error al cargar extras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExtras(); }, [projectId, contractorId]);

  const handleSave = async () => {
    if (!form.amount || form.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    try {
      if (editingExtra) {
        await axios.put(`/api/projects/${projectId}/contractors/${contractorId}/extras/${editingExtra.id}`, form);
        toast.success('Extra actualizado');
      } else {
        await axios.post(`/api/projects/${projectId}/contractors/${contractorId}/extras`, form);
        toast.success('Extra agregado');
      }
      setShowForm(false);
      setEditingExtra(null);
      setForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      loadExtras();
      onUpdated();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    }
  };

  const handleEdit = (extra) => {
    setEditingExtra(extra);
    setForm({
      amount: extra.amount,
      description: extra.description || '',
      date: extra.date,
    });
    setShowForm(true);
  };

  const handleDelete = async (extraId) => {
    if (!confirm('¿Eliminar este extra?')) return;
    try {
      await axios.delete(`/api/projects/${projectId}/contractors/${contractorId}/extras/${extraId}`);
      toast.success('Extra eliminado');
      loadExtras();
      onUpdated();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const totalExtras = extras.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <Modal title={`Extras — ${contractorName}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Lista de extras */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : extras.length === 0 && !showForm ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No hay extras registrados</p>
            <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Agregar Extra
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Total extras: <span className="font-mono font-bold text-blue-600">{mxn(totalExtras)}</span>
              </p>
              {!showForm && (
                <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
                  <Plus size={14} /> Agregar
                </button>
              )}
            </div>

            {extras.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {extras.map(extra => (
                      <tr key={extra.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">{extra.date}</td>
                        <td className="px-3 py-2 text-gray-900">{extra.description || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-blue-600">+{mxn(extra.amount)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(extra)}
                              className="text-gray-400 hover:text-accent"
                            ><Pencil size={13} /></button>
                            <button
                              onClick={() => handleDelete(extra.id)}
                              className="text-gray-400 hover:text-red-500"
                            ><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Formulario */}
        {showForm && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">
              {editingExtra ? 'Editar Extra' : 'Nuevo Extra'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Monto *</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Descripción</label>
                <textarea
                  className="input-field resize-none"
                  rows="2"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Trabajo adicional en fachada"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setShowForm(false);
                    setEditingExtra(null);
                    setForm({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
                  }}
                >
                  Cancelar
                </button>
                <button className="btn-primary btn-sm" onClick={handleSave}>
                  {editingExtra ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  );
}
