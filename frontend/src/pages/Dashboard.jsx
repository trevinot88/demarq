import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  DollarSign, FolderKanban, Users, TrendingUp, AlertTriangle,
} from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import { mxn, saldoClass, formatWeekDate } from '../utils.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/dashboard')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return null;

  const {
    current_week, current_week_total, total_pagado_global,
    active_projects, active_contractors, current_week_summary, negative_alerts,
  } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brown">Dashboard</h1>
        {current_week && (
          <p className="text-brown/60 text-sm mt-1">
            Semana actual: {formatWeekDate(current_week.week_date)}
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Rep. A Cta. (semana actual)"
          value={mxn(current_week_total)}
          icon={DollarSign}
          color="accent"
        />
        <StatCard
          title="Total pagado global"
          value={mxn(total_pagado_global)}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Proyectos activos"
          value={active_projects}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          title="Contratistas activos"
          value={active_contractors}
          icon={Users}
          color="yellow"
        />
      </div>

      {/* Alertas saldo negativo */}
      {negative_alerts.length > 0 && (
        <div className="glass-card p-4 border-red-500/40">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-600" />
            <h2 className="font-semibold text-red-600">Saldos Finales Negativos</h2>
          </div>
          <div className="space-y-2">
            {negative_alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-brown font-medium">{a.contractor_name}</span>
                  <span className="text-brown/60 text-sm ml-2">— {a.project_name}</span>
                </div>
                <span className="saldo-neg font-mono font-bold">{mxn(a.saldo_final)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen semana actual */}
      {current_week_summary.length > 0 && (
        <div className="glass-card">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-brown">Resumen — Semana Actual</h2>
            <p className="text-xs text-brown/60 mt-0.5">Rep. A Cta. por contratista (todos sus proyectos)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="px-5 py-3 text-brown/50">#</th>
                  <th className="px-5 py-3 text-brown/50">Contratista</th>
                  <th className="px-5 py-3 text-right text-brown/50">Rep. A Cta.</th>
                </tr>
              </thead>
              <tbody>
                {current_week_summary.filter(row => row.total > 0).map((row, i) => (
                  <tr key={row.contractor_name} className="table-row">
                    <td className="px-5 py-3 text-brown/40 text-sm">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-brown">{row.contractor_name}</td>
                    <td className="px-5 py-3 text-right font-mono text-green-700 font-semibold">
                      {mxn(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="px-5 py-3 font-bold text-brown">TOTAL</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-olive-dark text-lg">
                    {mxn(current_week_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
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
