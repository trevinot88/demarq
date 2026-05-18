export default function StatCard({ title, value, subtitle, icon: Icon, color = 'accent', alert = false }) {
  const colors = {
    accent:  'text-accent',
    green:   'text-green-600',
    red:     'text-red-600',
    blue:    'text-blue-600',
    yellow:  'text-yellow-600',
  };

  return (
    <div className={`glass-card p-5 flex items-start gap-4 ${alert ? 'border-red-500/40' : ''}`}>
      {Icon && (
        <div className={`p-2.5 rounded-xl bg-gray-100 ${colors[color]} shrink-0`}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{title}</p>
        <p className={`text-xl font-bold leading-tight ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
