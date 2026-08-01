import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { WebLayout } from './layout/WebLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { HomePage } from './pages/app/HomePage';
import { FramesPage } from './pages/app/FramesPage';
import { FrameDetailPage } from './pages/app/FrameDetailPage';
import { GeneratePage } from './pages/app/GeneratePage';
import { HistoryPage } from './pages/app/HistoryPage';
import { AiGenerationHistoryPage } from './pages/app/AiGenerationHistoryPage';
import { ProjectsPage } from './pages/app/ProjectsPage';
import { WalletPage } from './pages/app/WalletPage';
import { SettingsPage } from './pages/app/SettingsPage';
import { CategoriesPage } from './pages/app/CategoriesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAuthStore } from './state/authStore';

function AuthOnly({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/app/home" replace />;
  return children;
}

function Protected({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return children;
}

function App() {
  const bootstrapFromStorage = useAuthStore(state => state.bootstrapFromStorage);

  useEffect(() => {
    bootstrapFromStorage();
  }, [bootstrapFromStorage]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/home" replace />} />

      <Route path="/auth/login" element={<AuthOnly><LoginPage /></AuthOnly>} />
      <Route path="/auth/register" element={<AuthOnly><RegisterPage /></AuthOnly>} />

      <Route path="/app" element={<Protected><WebLayout /></Protected>}>
        <Route path="home" element={<HomePage />} />
        <Route path="frames" element={<FramesPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="frames/:frameId" element={<FrameDetailPage />} />
        <Route path="ai-studio" element={<GeneratePage />} />
        <Route path="generate" element={<Navigate to="/app/ai-studio" replace />} />
        <Route path="ai-generation-history" element={<AiGenerationHistoryPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
