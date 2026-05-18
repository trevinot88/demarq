import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, ChevronRight, FolderKanban, Pencil, Trash2 } from 'lucide-react';
import Modal from '../components/Modal.jsx';

const STATUS_LABEL = { active: 'Activo', closed: 'Cerrado' };
const STATUS_CLASS  = { active: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-600' };

function ProjectModal({ project, onClose, onSaved }) {
  const editing = !!project?.id;
  const [form, setForm] = useState({
    name:        project?.name        || '',
    client_name: project?.client_name || '',
    status:      project?.status      || 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name) return toast.error('El nombre es requerido');
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`/api/projects/${project.id}`, form);
        toast.success('Proyecto actualizado');
      } else {
        await axios.post('/api/projects', form);
        toast.success('Proyecto creado');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={editing ? 'Editar Proyecto' : 'Nuevo Proyecto'} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">Nombre *</label>
          <input className="input-field" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Cliente</label>
          <input className="input-field" value={form.client_name}
            onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Estatus</label>
          <select className="input-field" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="active">Activo</option>
            <option value="closed">Cerrado</option>
          </select>
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

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | {} | project

  const load = () => {
    setLoading(true);
    axios.get('/api/projects').then(r => setProjects(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (p) => {
    if (!confirm(`¿Eliminar "${p.name}"? Se eliminarán todos sus datos históricos.`)) return;
    try {
      await axios.delete(`/api/projects/${p.id}`);
      toast.success('Proyecto eliminado');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  const active = projects.filter(p => p.status === 'active');
  const closed = projects.filter(p => p.status === 'closed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal({})}>
          <Plus size={16} /> Nuevo Proyecto
        </button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {[{ label: 'Activos', list: active }, { label: 'Cerrados', list: closed }].map(({ label, list }) =>
            list.length > 0 && (
              <div key={label} className="glass-card overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="font-semibold text-gray-900">{label}</span>
                  <span className="ml-2 text-gray-400 text-sm">({list.length})</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {list.map(p => (
                    <div key={p.id} className="flex items-center px-5 py-4 hover:bg-orange-50/40 transition-colors group">
                      <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center mr-4 shrink-0">
                        <FolderKanban size={17} className="text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">
                          {p.client_name || 'Sin cliente'} · {p.contractor_count} contratista{p.contractor_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className={`tag ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                        <button onClick={() => setModal(p)} className="text-gray-400 hover:text-gray-700 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                        <Link to={`/projects/${p.id}`} className="text-gray-400 hover:text-accent transition-colors">
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
          {projects.length === 0 && (
            <div className="glass-card p-10 text-center text-gray-500">
              <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay proyectos</p>
              <button className="btn-primary btn-sm mt-4" onClick={() => setModal({})}>Crear proyecto</button>
            </div>
          )}
        </>
      )}

      {modal !== null && (
        <ProjectModal
          project={modal?.id ? modal : null}
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
