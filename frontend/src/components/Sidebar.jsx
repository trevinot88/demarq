import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, FolderKanban,
  Users, Fuel, HardHat,
} from 'lucide-react';

const links = [
  { to: '/',            label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/reports',     label: 'Relación Semanal',   icon: ClipboardList   },
  { to: '/projects',    label: 'Proyectos',           icon: FolderKanban    },
  { to: '/contractors', label: 'Contratistas',        icon: Users           },
  { to: '/fuel',        label: 'Gasolinas / Caja',    icon: Fuel            },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-navy shadow-xl flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center shrink-0">
          <HardHat size={20} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white leading-tight">DEMARQ</p>
          <p className="text-xs text-blue-200 leading-tight">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-blue-400/60 text-center">v1.0 · DEMARQ Admin</p>
      </div>
    </aside>
  );
}
