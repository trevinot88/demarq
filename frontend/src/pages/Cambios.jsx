import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { History, User, Calendar, FileText } from 'lucide-react';

const ACTION_LABELS = {
  'CREATE': { label: 'Creó', color: 'text-green-600', bg: 'bg-green-50' },
  'UPDATE': { label: 'Actualizó', color: 'text-blue-600', bg: 'bg-blue-50' },
  'UPDATE_VP': { label: 'Cambió VP', color: 'text-blue-600', bg: 'bg-blue-50' },
  'DELETE': { label: 'Eliminó', color: 'text-red-600', bg: 'bg-red-50' },
  'ASSIGN': { label: 'Asignó', color: 'text-purple-600', bg: 'bg-purple-50' },
  'ADD_EXTRA': { label: 'Agregó extra', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  'UPDATE_EXTRA': { label: 'Editó extra', color: 'text-blue-600', bg: 'bg-blue-50' },
  'DELETE_EXTRA': { label: 'Eliminó extra', color: 'text-red-600', bg: 'bg-red-50' },
  'ACCEPT': { label: 'Aceptó reporte', color: 'text-green-600', bg: 'bg-green-50' },
  'REJECT': { label: 'Rechazó reporte', color: 'text-red-600', bg: 'bg-red-50' },
  'PASS_TO_WEEK': { label: 'Pasó a semana', color: 'text-purple-600', bg: 'bg-purple-50' },
};

const ENTITY_LABELS = {
  'project': 'Proyecto',
  'contractor': 'Contratista',
  'contractor_project': 'Asignación',
  'extra': 'Extra',
  'advancement_report': 'Reporte de Avance',
  'report': 'Relación Semanal',
  'fuel': 'Combustible',
};

export default function Cambios() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/audit');
      setLogs(data);
    } catch (err) {
      toast.error('Error al cargar historial de cambios');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const users = [...new Set(logs.map(l => l.username))];
  const actions = [...new Set(logs.map(l => l.action))];

  const filteredLogs = logs.filter(log => {
    if (filterUser !== 'all' && log.username !== filterUser) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    return true;
  });

  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    const date = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  };

  const getActionStyle = (action) => {
    return ACTION_LABELS[action] || { label: action, color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <History size={28} className="text-accent" />
            Historial de Cambios
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Registro de todas las acciones realizadas por cada usuario
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{filteredLogs.length} cambios</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">
              <User size={14} className="inline mr-1" />
              Filtrar por Usuario
            </label>
            <select
              className="input-field text-sm"
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
            >
              <option value="all">Todos los usuarios</option>
              {users.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">
              <FileText size={14} className="inline mr-1" />
              Filtrar por Acción
            </label>
            <select
              className="input-field text-sm"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="all">Todas las acciones</option>
              {actions.map(a => (
                <option key={a} value={a}>{getActionStyle(a).label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de logs */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <History size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay cambios registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log, idx) => {
            const { date, time } = formatDate(log.created_at);
            const actionStyle = getActionStyle(log.action);
            const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;

            return (
              <div
                key={log.id}
                className="glass-card hover:shadow-md transition-shadow"
              >
                <div className="p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
                    {/* Fecha y hora */}
                    <div className="flex items-center gap-2 md:w-40 shrink-0 text-xs text-gray-500">
                      <Calendar size={14} />
                      <div>
                        <div className="font-medium text-gray-700">{date}</div>
                        <div className="text-gray-400">{time}</div>
                      </div>
                    </div>

                    {/* Usuario */}
                    <div className="md:w-32 shrink-0">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brown/10 rounded-full">
                        <User size={12} className="text-brown" />
                        <span className="text-xs font-medium text-brown">{log.username}</span>
                      </div>
                    </div>

                    {/* Acción */}
                    <div className="md:w-36 shrink-0">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${actionStyle.bg} rounded-full`}>
                        <span className={`text-xs font-semibold ${actionStyle.color}`}>
                          {actionStyle.label}
                        </span>
                      </div>
                    </div>

                    {/* Detalles */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 font-medium mb-1">
                        <span className="text-gray-500">{entityLabel}:</span>{' '}
                        {log.entity_name || `ID ${log.entity_id}`}
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {Object.entries(log.details).map(([key, value]) => (
                            <div key={key} className="truncate">
                              <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
