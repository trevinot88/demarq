import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard   from './pages/Dashboard.jsx';
import Reportes    from './pages/Reportes.jsx';
import Reports     from './pages/Reports.jsx';
import ReportDetail from './pages/ReportDetail.jsx';
import Projects    from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Contractors from './pages/Contractors.jsx';
import ContractorDetail from './pages/ContractorDetail.jsx';
import Fuel        from './pages/Fuel.jsx';
import Login       from './pages/Login.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { HardHat, Menu } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-lightest">
      <HardHat className="text-olive animate-pulse" size={48} />
    </div>
  );
}

export default function App() {
  const { authenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (authenticated === null) return <LoadingScreen />;
  if (!authenticated)         return <Login />;

  return (
    <div className="flex min-h-screen bg-sand-lightest">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      
      <main className="flex-1 md:ml-64 min-h-screen overflow-auto bg-sand-lightest">
        {/* Header móvil */}
        <div className="md:hidden sticky top-0 z-30 bg-brown border-b border-brown/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-sand-lightest p-2 hover:bg-white/10 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-olive rounded-lg flex items-center justify-center">
              <HardHat size={16} className="text-brown" />
            </div>
            <span className="font-bold text-sand-lightest text-sm">DEMARQ Admin</span>
          </div>
        </div>
        
        <div className="p-4 md:p-6">
          <Routes>
            <Route path="/"                        element={<Dashboard />} />
            <Route path="/reportes"                element={<Reportes />} />
            <Route path="/reports"                 element={<Reports />} />
            <Route path="/reports/:id"             element={<ReportDetail />} />
            <Route path="/projects"                element={<Projects />} />
            <Route path="/projects/:id"            element={<ProjectDetail />} />
            <Route path="/contractors"             element={<Contractors />} />
            <Route path="/contractors/:id"         element={<ContractorDetail />} />
            <Route path="/fuel"                    element={<Fuel />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

