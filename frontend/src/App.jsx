import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard   from './pages/Dashboard.jsx';
import Reports     from './pages/Reports.jsx';
import ReportDetail from './pages/ReportDetail.jsx';
import Projects    from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Contractors from './pages/Contractors.jsx';
import ContractorDetail from './pages/ContractorDetail.jsx';
import Fuel        from './pages/Fuel.jsx';
import Login       from './pages/Login.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { HardHat } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-lightest">
      <HardHat className="text-olive animate-pulse" size={48} />
    </div>
  );
}

export default function App() {
  const { authenticated } = useAuth();

  if (authenticated === null) return <LoadingScreen />;
  if (!authenticated)         return <Login />;

  return (
    <div className="flex min-h-screen bg-sand-lightest">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-auto bg-sand-lightest">
        <div className="p-6">
          <Routes>
            <Route path="/"                        element={<Dashboard />} />
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

