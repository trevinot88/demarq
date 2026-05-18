import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { mxn, saldoClass, formatWeekDate } from '../utils.js';

export default function ContractorDetail() {
  const { id } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/contractors/${id}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-500">No encontrado</p>;

  const { contractor, projects, history, totals } = data;
  const saldoPendiente = (totals.total_vp || 0) - (totals.total_pagado || 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/contractors" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contractor.name}</h1>
          <p className="text-sm text-gray-500">Contratista · Activo</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total VP</p>
          <p className="text-xl font-bold text-gray-900 font-mono mt-1">{mxn(totals.total_vp)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Pagado</p>
          <p className="text-xl font-bold text-green-400 font-mono mt-1">{mxn(totals.total_pagado)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Saldo Pendiente Global</p>
          <p className={`text-xl font-bold font-mono mt-1 ${saldoClass(saldoPendiente)}`}>{mxn(saldoPendiente)}</p>
        </div>
      </div>

      {/* Proyectos */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <span className="font-semibold text-gray-900">Proyectos</span>
        </div>
        {projects.length === 0 ? (
          <p className="px-5 py-6 text-gray-500 text-sm">Sin proyectos asignados.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="px-5 py-3 text-left">Proyecto</th>
                <th className="px-5 py-3 text-right">V.P.</th>
                <th className="px-5 py-3 text-right">Total Cobrado</th>
                <th className="px-5 py-3 text-right">Saldo</th>
                <th className="px-5 py-3 text-right">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const pagado = p.total_rep_a_cta || 0;
                const saldo  = (p.vp || 0) - pagado;
                return (
                  <tr key={p.id} className="table-row text-sm">
                    <td className="px-5 py-3">
                      <Link to={`/projects/${p.id}`} className="text-accent hover:text-accent-dark transition-colors font-medium">
                        {p.project_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-700">{mxn(p.vp)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-600">{mxn(pagado)}</td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold ${saldoClass(saldo)}`}>{mxn(saldo)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`tag ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'active' ? 'Activo' : 'Cerrado'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Historial semanal */}
      {history.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Historial de Pagos Semanales</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="px-5 py-3 text-left">Semana</th>
                  <th className="px-5 py-3 text-left">Proyecto</th>
                  <th className="px-5 py-3 text-right">Ent. A Cta.</th>
                  <th className="px-5 py-3 text-right">Rep. A Cta.</th>
                  <th className="px-5 py-3 text-right">V.P.</th>
                  <th className="px-5 py-3 text-left">Notas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="table-row text-sm">
                    <td className="px-5 py-3 text-gray-900 capitalize">{formatWeekDate(h.week_date)}</td>
                    <td className="px-5 py-3 text-gray-700">{h.project_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-700">{mxn(h.ent_a_cta)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-600 font-semibold">{mxn(h.rep_a_cta)}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-500">{mxn(h.vp)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{h.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
