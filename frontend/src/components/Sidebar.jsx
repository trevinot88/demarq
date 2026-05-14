import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, FolderKanban,
  Users, Fuel, HardHat,
} from 'lucide-react';
import { useRole } from '../context/RoleContext.jsx';

const links = [
  { to: '/',            label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/reports',     label: 'Relación Semanal',   icon: ClipboardList   },
  { to: '/projects',    label: 'Proyectos',           icon: FolderKanban    },
  { to: '/contractors', label: 'Contratistas',        icon: Users           },
  { to: '/fuel',        label: 'Gasolinas / Caja',    icon: Fuel            },
];

export default function Sidebar() {
  const { role, setRole } = useRole();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-navy border-r border-white/10 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
        <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center shrink-0">
          <HardHat size={20} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white leading-tight">Constructor</p>
          <p className="text-xs text-gray-400 leading-tight">Admin</p>
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

      {/* Role selector */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Rol activo</p>
        <div className="flex gap-2">
          {['CEO', 'Asistente'].map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${role === r
                  ? 'bg-accent text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
                }`}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">v1.0 · Constructor Admin</p>
      </div>
    </aside>
  );
}
