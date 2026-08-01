import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { FramesPage } from './pages/FramesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { WalletOpsPage } from './pages/WalletOpsPage';
import { PlansPage } from './pages/PlansPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { AiConfigPage } from './pages/AiConfigPage';
import { ConfigPage } from './pages/ConfigPage';
import { BrandingPage } from './pages/BrandingPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { JobsPage } from './pages/JobsPage';
import { AuditPage } from './pages/AuditPage';
import { TenantsPage } from './pages/TenantsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAdminAuthStore } from './state/authStore';

function AdminProtected({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAdminAuthStore(state => state.isAuthenticated);
  const isBootstrapping = useAdminAuthStore(state => state.isBootstrapping);
  if (isBootstrapping) return null;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return children;
}

function AdminGuestOnly({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAdminAuthStore(state => state.isAuthenticated);
  const isBootstrapping = useAdminAuthStore(state => state.isBootstrapping);
  if (isBootstrapping) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  const bootstrap = useAdminAuthStore(state => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth/login" element={<AdminGuestOnly><LoginPage /></AdminGuestOnly>} />

      <Route element={<AdminProtected><AdminLayout /></AdminProtected>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/frames" element={<FramesPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:categoryId" element={<CategoriesPage />} />
        <Route path="/wallet-ops" element={<WalletOpsPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/ai-config" element={<AiConfigPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/branding" element={<BrandingPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
