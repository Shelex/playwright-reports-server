import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ReportDetailPage from "./pages/ReportDetailPage";
import ReportsPage from "./pages/ReportsPage";
import ResultsPage from "./pages/ResultsPage";
import SettingsPage from "./pages/SettingsPage";
import TrendsPage from "./pages/TrendsPage";
import { Providers } from "./providers";

function App() {
	return (
		<Providers attribute="class" defaultTheme="dark">
			<Layout>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/reports" element={<ReportsPage />} />
					<Route path="/report/:id" element={<ReportDetailPage />} />
					<Route path="/results" element={<ResultsPage />} />
					<Route path="/trends" element={<TrendsPage />} />
					<Route path="/settings" element={<SettingsPage />} />
					<Route path="/login" element={<LoginPage />} />
				</Routes>
				<Toaster closeButton richColors visibleToasts={3} />
			</Layout>
		</Providers>
	);
}

export default App;
