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
  const [assignForm, setAssignForm] = useState({ contractor_id: '', valor_presupuesto: 0 });
  const [budgetVal, setBudgetVal] = useState(0);

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
      await axios.put(`/api/projects/${id}/contractors/${editBudget.contractor_id}`, { valor_presupuesto: budgetVal });
      toast.success('VP actualizado');
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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/projects" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500">
            {project.client_name || 'Sin cliente'} ·{' '}
            <span className={project.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
              {project.status === 'active' ? 'Activo' : 'Cerrado'}
            </span>
          </p>
        </div>
      </div>

      {/* Contratistas asignados */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
          <span className="font-semibold text-gray-900">Contratistas Asignados</span>
          <button onClick={() => setShowAssign(true)} className="btn-primary btn-sm flex items-center gap-1">
            <Plus size={14} /> Asignar
          </button>
        </div>
        {contractors.length === 0 ? (
          <p className="px-5 py-6 text-gray-500 text-sm">No hay contratistas asignados.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-5 py-3 text-left">Contratista</th>
                <th className="px-5 py-3 text-right">V.P.</th>
                <th className="px-5 py-3 text-right">Pagado</th>
                <th className="px-5 py-3 text-right">Saldo</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map(c => {
                const saldo = c.valor_presupuesto - c.total_pagado;
                return (
                  <tr key={c.contractor_id} className="table-row text-sm">
                    <td className="px-5 py-3 text-gray-900 font-medium">{c.contractor_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-700">{mxn(c.valor_presupuesto)}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-600">{mxn(c.total_pagado)}</td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold ${
                      saldo < 0 ? 'text-red-600' : saldo === 0 ? 'text-gray-400' : 'text-green-600'
                    }`}>
                      {mxn(saldo)}
                    </td>
                    <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => { setEditBudget(c); setBudgetVal(c.valor_presupuesto); }}
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
        )}
      </div>

      {/* Historial de semanas */}
      {history.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Historial Semanal</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-5 py-3 text-left">Semana</th>
                <th className="px-5 py-3 text-right">Ent. A Cta.</th>
                <th className="px-5 py-3 text-right">Rep. A Cta.</th>
                <th className="px-5 py-3 text-right">Contratistas</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="table-row text-sm">
                  <td className="px-5 py-3 text-gray-900 capitalize">{formatWeekDate(h.week_date)}</td>
                  <td className="px-5 py-3 text-right font-mono text-gray-700">{mxn(h.total_ent)}</td>
                  <td className="px-5 py-3 text-right font-mono text-green-600 font-semibold">{mxn(h.total_rep)}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{h.contractors_active}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <Modal title={`Editar VP — ${editBudget.contractor_name}`} onClose={() => setEditBudget(null)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Nuevo V.P.</label>
              <input type="number" className="input-field" value={budgetVal}
                onChange={e => setBudgetVal(Number(e.target.value))} />
              <p className="text-xs text-gray-400 mt-1">El cambio aplica desde esta semana en adelante. El historial no se modifica.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setEditBudget(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleUpdateVP}>Guardar</button>
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
