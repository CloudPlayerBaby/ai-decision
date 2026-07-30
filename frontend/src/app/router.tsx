import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from '../components/AuthGuard'
import { MainLayout } from '../layouts/MainLayout'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { DecisionListPage } from '../pages/decisions/DecisionListPage'
import { DecisionCreatePage } from '../pages/decisions/DecisionCreatePage'
import { DecisionDetailPage } from '../pages/decisions/DecisionDetailPage'
import { ReportCenterPage } from '../pages/reports/ReportCenterPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Navigate to="/decisions" replace />} />
        <Route path="/workbench" element={<Navigate to="/decisions/demo-1" replace />} />
        <Route path="/decisions" element={<DecisionListPage />} />
        <Route path="/decisions/new" element={<DecisionCreatePage />} />
        <Route path="/decisions/:decisionId" element={<DecisionDetailPage />} />
        <Route
          path="/decisions/:decisionId/canvas"
          element={<Navigate to=".." relative="path" replace />}
        />
        <Route
          path="/decisions/:decisionId/report"
          element={<Navigate to="/reports" replace />}
        />
        <Route path="/reports" element={<ReportCenterPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
