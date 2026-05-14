export default function StatCard({ title, value, subtitle, icon: Icon, color = 'accent', alert = false }) {
  const colors = {
    accent:  'text-accent',
    green:   'text-green-400',
    red:     'text-red-400',
    blue:    'text-blue-400',
    yellow:  'text-yellow-400',
  };

  return (
    <div className={`glass-card p-5 flex items-start gap-4 ${alert ? 'border-red-500/40' : ''}`}>
      {Icon && (
        <div className={`p-2.5 rounded-xl bg-white/5 ${colors[color]} shrink-0`}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{title}</p>
        <p className={`text-2xl font-bold truncate ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
