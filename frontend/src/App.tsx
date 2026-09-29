import { Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth, Role } from './lib/auth';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Patients from './pages/Patients';
import PatientFormPage from './pages/PatientForm';
import PatientDetail from './pages/PatientDetail';
import Hospitals from './pages/Hospitals';
import Admissions from './pages/Admissions';
import Diseases from './pages/Diseases';
import Comparison from './pages/Comparison';
import Olap from './pages/Olap';
import Warehouse from './pages/Warehouse';
import Mining from './pages/Mining';
import Reports from './pages/Reports';
import Quality from './pages/Quality';
import SettingsPage from './pages/Settings';
import UsersPage from './pages/Users';

function Guard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8"><Loading /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <div className="panel p-8 text-center text-sm text-ink-500">Your role does not have access to this page.</div>;
  return <>{children}</>;
}
const AA: Role[] = ['ADMIN', 'ANALYST'];
export default function App() {
  return <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="/app" element={<Guard><Layout /></Guard>}>
      <Route index element={<Overview />} />
      <Route path="patients" element={<Patients />} />
      <Route path="patients/new" element={<Guard roles={['ADMIN', 'STAFF']}><PatientFormPage /></Guard>} />
      <Route path="patients/:id" element={<PatientDetail />} />
      <Route path="patients/:id/edit" element={<Guard roles={['ADMIN', 'STAFF']}><PatientFormPage /></Guard>} />
      <Route path="hospitals" element={<Hospitals />} />
      <Route path="admissions" element={<Admissions />} />
      <Route path="diseases" element={<Diseases />} />
      <Route path="comparison" element={<Guard roles={AA}><Comparison /></Guard>} />
      <Route path="olap" element={<Guard roles={AA}><Olap /></Guard>} />
      <Route path="warehouse" element={<Guard roles={AA}><Warehouse /></Guard>} />
      <Route path="mining" element={<Guard roles={AA}><Mining /></Guard>} />
      <Route path="reports" element={<Reports />} />
      <Route path="quality" element={<Guard roles={AA}><Quality /></Guard>} />
      <Route path="users" element={<Guard roles={['ADMIN']}><UsersPage /></Guard>} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
