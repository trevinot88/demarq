import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, ChevronRight, Calendar } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { mxn, formatWeekDate, nextFridayISO } from '../utils.js';

export default function Reports() {
  const [weeks, setWeeks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newDate, setNewDate]   = useState(nextFridayISO());
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    axios.get('/api/reports').then(r => setWeeks(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!newDate) return;
    setSaving(true);
    try {
      await axios.post('/api/reports', { week_date: newDate });
      toast.success('Semana creada');
      setShowModal(false);
      setNewDate(nextFridayISO());
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al crear semana');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-brown">Relación Semanal</h1>
        <button className="btn-primary flex items-center gap-2 justify-center" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nueva Semana
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {weeks.length === 0 && (
            <div className="glass-card p-10 text-center text-gray-500">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay semanas registradas</p>
              <button className="btn-primary btn-sm mt-4" onClick={() => setShowModal(true)}>Crear primera semana</button>
            </div>
          )}
          {weeks.map(w => (
            <Link
              key={w.id}
              to={`/reports/${w.id}`}
              className="glass-card p-3 md:p-4 flex items-center justify-between hover:border-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-3 md:gap-4">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-olive/20 flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-olive-dark" />
              </div>
              <div>
                <p className="font-semibold text-brown capitalize text-sm md:text-base">{formatWeekDate(w.week_date)}</p>
                <p className="text-xs text-brown/60 mt-0.5">
                  Total Rep. A Cta.: <span className="text-green-700 font-mono text-xs md:text-sm">{mxn(w.total_general)}</span>
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-accent transition-colors" />
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Nueva Semana" onClose={() => setShowModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Fecha de la semana</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">
                Por defecto: viernes más próximo. Se auto-populará con todos los proyectos activos y sus contratistas.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando…' : 'Crear Semana'}
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
