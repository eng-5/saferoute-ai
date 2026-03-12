import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import DashboardPage from './pages/DashboardPage'
import JourneyPage from './pages/JourneyPage'
import NavigationPage from './pages/NavigationPage'
import AnalysisPage from './pages/AnalysisPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import AlertPage from './pages/AlertPage'
import ArrivalPage from './pages/ArrivalPage'
import AboutPage from './pages/AboutPage'
import WatchPage from './pages/WatchPage'
 
export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/active" element={<Navigate to="/navigation" replace />} />
            {/* Standalone pages — no AppShell layout */}
            <Route path="/about" element={<AboutPage />} />
            <Route path="/watch" element={<WatchPage />} />
            <Route element={<AppShell />}>
                <Route path="/dashboard"  element={<DashboardPage />} />
                <Route path="/journey"    element={<JourneyPage />} />
                <Route path="/navigation" element={<NavigationPage />} />
                <Route path="/analysis"   element={<AnalysisPage />} />
                <Route path="/analytics"  element={<AnalyticsPage />} />
                <Route path="/settings"   element={<SettingsPage />} />
                <Route path="/alert"      element={<AlertPage />} />
                <Route path="/arrival"    element={<ArrivalPage />} />
            </Route>
        </Routes>
    )
}