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
  if (!data) return <p className="text-gray-400">No encontrado</p>;

  const { contractor, projects, history, totals } = data;
  const saldoPendiente = (totals.total_vp || 0) - (totals.total_pagado || 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/contractors" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{contractor.name}</h1>
          <p className="text-sm text-gray-400">Contratista · Activo</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total VP</p>
          <p className="text-xl font-bold text-white font-mono mt-1">{mxn(totals.total_vp)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Pagado</p>
          <p className="text-xl font-bold text-green-400 font-mono mt-1">{mxn(totals.total_pagado)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Saldo Pendiente Global</p>
          <p className={`text-xl font-bold font-mono mt-1 ${saldoClass(saldoPendiente)}`}>{mxn(saldoPendiente)}</p>
        </div>
      </div>

      {/* Proyectos */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 bg-navy-light border-b border-white/10">
          <span className="font-semibold text-white">Proyectos</span>
        </div>
        {projects.length === 0 ? (
          <p className="px-5 py-6 text-gray-400 text-sm">Sin proyectos asignados.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/10">
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
                      <Link to={`/projects/${p.id}`} className="text-white hover:text-accent transition-colors font-medium">
                        {p.project_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-gray-300">{mxn(p.vp)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-400">{mxn(pagado)}</td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold ${saldoClass(saldo)}`}>{mxn(saldo)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`tag ${p.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
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
          <div className="px-5 py-3 bg-navy-light border-b border-white/10">
            <span className="font-semibold text-white">Historial de Pagos Semanales</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-white/10">
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
                    <td className="px-5 py-3 text-white capitalize">{formatWeekDate(h.week_date)}</td>
                    <td className="px-5 py-3 text-gray-300">{h.project_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-300">{mxn(h.ent_a_cta)}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-400 font-semibold">{mxn(h.rep_a_cta)}</td>
                    <td className="px-5 py-3 text-right font-mono text-gray-400">{mxn(h.vp)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{h.notes || '—'}</td>
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
