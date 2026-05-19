export default function StatCard({ title, value, subtitle, icon: Icon, color = 'accent', alert = false }) {
  const colors = {
    accent:  'text-olive-dark',
    green:   'text-green-700',
    red:     'text-red-600',
    blue:    'text-brown-lighter',
    yellow:  'text-yellow-700',
  };

  return (
    <div className={`glass-card p-5 flex items-start gap-4 ${alert ? 'border-red-500/40' : ''}`}>
      {Icon && (
        <div className={`p-2.5 rounded-xl bg-sand-light ${colors[color]} shrink-0`}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-brown/50 uppercase tracking-wider mb-0.5">{title}</p>
        <p className={`text-xl font-bold leading-tight ${alert ? 'text-red-600' : 'text-brown'}`}>{value}</p>
        {subtitle && <p className="text-xs text-brown/50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
