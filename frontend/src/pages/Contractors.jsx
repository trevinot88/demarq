import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Users, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { mxn } from '../utils.js';

function ContractorModal({ contractor, onClose, onSaved }) {
  const editing = !!contractor?.id;
  const [name, setName]     = useState(contractor?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`/api/contractors/${contractor.id}`, { name });
        toast.success('Contratista actualizado');
      } else {
        await axios.post('/api/contractors', { name });
        toast.success('Contratista creado');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={editing ? 'Editar Contratista' : 'Nuevo Contratista'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nombre *</label>
          <input
            className="input-field"
            value={name}
            onChange={e => setName(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Contractors() {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null);
  const [search, setSearch]           = useState('');

  const load = () => {
    setLoading(true);
    axios.get('/api/contractors').then(r => setContractors(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (c) => {
    if (!confirm(`¿Eliminar a "${c.name}"? Se perderá todo su historial.`)) return;
    try {
      await axios.delete(`/api/contractors/${c.id}`);
      toast.success('Contratista eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const filtered = contractors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Contratistas</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({})}>
          <Plus size={16} /> Nuevo Contratista
        </button>
      </div>

      <div>
        <input
          className="input-field max-w-xs"
          placeholder="Buscar contratista…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/10 bg-navy-light">
                <th className="px-5 py-3 text-left">Contratista</th>
                <th className="px-5 py-3 text-right">Proyectos</th>
                <th className="px-5 py-3 text-right">VP Total</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                  {search ? 'Sin resultados' : 'No hay contratistas'}
                </td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                        <span className="text-accent text-xs font-bold">{c.name[0]}</span>
                      </div>
                      <span className="font-medium text-white">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400 text-sm">{c.project_count}</td>
                  <td className="px-5 py-3 text-right font-mono text-gray-300 text-sm">{mxn(c.total_vp)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setModal(c)} className="text-gray-500 hover:text-accent transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(c)} className="text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={15} />
                      </button>
                      <Link to={`/contractors/${c.id}`} className="text-gray-500 hover:text-accent transition-colors">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <ContractorModal
          contractor={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={load}
        />
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
