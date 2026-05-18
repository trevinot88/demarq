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

export default function App() {
  return (
    <div className="flex min-h-screen bg-navy-dark">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-auto bg-navy-dark">
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
