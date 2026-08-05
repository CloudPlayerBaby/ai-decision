import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Spin } from 'antd'
import {
  Navigate,
  Outlet,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  useParams,
} from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { ThemedApp } from './providers'

function lazyPage<T extends ComponentType<unknown>>(
  factory: () => Promise<Record<string, T>>,
  exportName: string,
) {
  return lazy(() =>
    factory().then((module) => ({ default: module[exportName] as T })),
  )
}

function PageLoader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Spin size="large" />
    </div>
  )
}

function SuspensePage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

const LoginPage = lazyPage(() => import('@/pages/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyPage(
  () => import('@/pages/auth/RegisterPage'),
  'RegisterPage',
)
const MainLayout = lazyPage(() => import('@/layouts/MainLayout'), 'MainLayout')
const DecisionListPage = lazyPage(
  () => import('@/pages/decisions/DecisionListPage'),
  'DecisionListPage',
)
const DecisionCreatePage = lazyPage(
  () => import('@/pages/decisions/DecisionCreatePage'),
  'DecisionCreatePage',
)
const WorkbenchPage = lazyPage(
  () => import('@/pages/workbench/WorkbenchPage'),
  'WorkbenchPage',
)
const ReportCenterPage = lazyPage(
  () => import('@/pages/reports/ReportCenterPage'),
  'ReportCenterPage',
)
const ReportDetailPage = lazyPage(
  () => import('@/pages/reports/ReportDetailPage'),
  'ReportDetailPage',
)
const NotFoundPage = lazyPage(
  () => import('@/pages/NotFoundPage'),
  'NotFoundPage',
)

function LegacyWorkbenchRedirect() {
  const { decisionId = 'demo-1' } = useParams<{ decisionId: string }>()
  return <Navigate to={`/workbench/${decisionId}`} replace />
}

function LegacyReportRedirect() {
  const { decisionId = 'demo-1' } = useParams<{ decisionId: string }>()
  return <Navigate to={`/reports/${decisionId}`} replace />
}

function ProtectedLayout() {
  return (
    <AuthGuard>
      <SuspensePage>
        <MainLayout />
      </SuspensePage>
    </AuthGuard>
  )
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
      <Route
        path="/login"
        element={
          <SuspensePage>
            <LoginPage />
          </SuspensePage>
        }
      />
      <Route
        path="/register"
        element={
          <SuspensePage>
            <RegisterPage />
          </SuspensePage>
        }
      />

      <Route element={<ProtectedLayout />}>
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

      <Route
        path="*"
        element={
          <SuspensePage>
            <NotFoundPage />
          </SuspensePage>
        }
      />
    </Route>,
  ),
)
