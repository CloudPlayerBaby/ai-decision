import {
  Navigate,
  Outlet,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  useParams,
} from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { MainLayout } from '@/layouts/MainLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DecisionListPage } from '@/pages/decisions/DecisionListPage'
import { DecisionCreatePage } from '@/pages/decisions/DecisionCreatePage'
import { WorkbenchPage } from '@/pages/workbench/WorkbenchPage'
import { ReportCenterPage } from '@/pages/reports/ReportCenterPage'
import { ReportDetailPage } from '@/pages/reports/ReportDetailPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ThemedApp } from './providers'

function LegacyWorkbenchRedirect() {
  const { decisionId = 'demo-1' } = useParams<{ decisionId: string }>()
  return <Navigate to={`/workbench/${decisionId}`} replace />
}

function LegacyReportRedirect() {
  const { decisionId = 'demo-1' } = useParams<{ decisionId: string }>()
  return <Navigate to={`/reports/${decisionId}`} replace />
}

export function AppRouter() {
  return (
    <ThemedApp>
      <Outlet />
    </ThemedApp>
  )
}

export const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppRouter />}>
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
        <Route path="/decisions" element={<DecisionListPage />} />
        <Route path="/decisions/new" element={<DecisionCreatePage />} />
        <Route path="/workbench/:id" element={<WorkbenchPage />} />
        <Route path="/reports" element={<ReportCenterPage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />

        <Route
          path="/decisions/:decisionId"
          element={<LegacyWorkbenchRedirect />}
        />
        <Route
          path="/decisions/:decisionId/canvas"
          element={<LegacyWorkbenchRedirect />}
        />
        <Route
          path="/decisions/:decisionId/report"
          element={<LegacyReportRedirect />}
        />
        <Route
          path="/workbench"
          element={<Navigate to="/decisions" replace />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Route>,
  ),
)
