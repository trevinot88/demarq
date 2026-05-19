import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, FolderKanban,
  Users, Fuel, HardHat, LogOut, FileCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/',            label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/reportes',    label: 'Reportes',            icon: FileCheck       },
  { to: '/reports',     label: 'Relación Semanal',   icon: ClipboardList   },
  { to: '/projects',    label: 'Proyectos',           icon: FolderKanban    },
  { to: '/contractors', label: 'Contratistas',        icon: Users           },
  { to: '/fuel',        label: 'Gasolinas / Caja',    icon: Fuel            },
];

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-brown shadow-xl flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="w-9 h-9 bg-olive rounded-lg flex items-center justify-center shrink-0">
          <HardHat size={20} className="text-brown" />
        </div>
        <div>
          <p className="font-bold text-sand-lightest leading-tight">DEMARQ</p>
          <p className="text-xs text-olive-light leading-tight">Admin</p>
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
      <div className="px-4 py-4 border-t border-white/10 space-y-3">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-olive-light hover:text-sand-lightest hover:bg-white/10 transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
        <p className="text-xs text-olive/60 text-center">v1.0 · DEMARQ Admin</p>
      </div>
    </aside>
  );
}

