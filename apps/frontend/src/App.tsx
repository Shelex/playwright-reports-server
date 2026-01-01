import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from '@/components/Layout';
import { AUTH_CONFIG_QUERY_KEY, prefetchAuthConfig } from '@/hooks/useAuthConfig';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import ReportDetailPage from '@/pages/ReportDetailPage';
import ReportsPage from '@/pages/ReportsPage';
import ResultsPage from '@/pages/ResultsPage';
import SettingsPage from '@/pages/SettingsPage';
import { Providers } from '@/providers';

function ConfigInitializer() {
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchAuthConfig().then((config) => {
      queryClient.setQueryData(AUTH_CONFIG_QUERY_KEY, config);
    });
  }, [queryClient]);

  return null;
}

function App() {
  return (
    <Providers attribute="class" defaultTheme="system">
      <ConfigInitializer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/report/:id" element={<ReportDetailPage />} />
                <Route path="/report/:id/:testId" element={<RedirectTestDetails />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
      <Toaster closeButton richColors visibleToasts={3} />
    </Providers>
  );
}

function RedirectTestDetails() {
  const { id, testId } = useParams<{ id: string; testId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/report/${id}`, {
      state: { highlightTestId: testId },
      replace: true,
    });
  }, [id, navigate, testId]);

  return null;
}

export default App;
