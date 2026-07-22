import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout'
import { DashboardSkeleton, ErrorBoundary } from '@/components/common'
import { AuthLoading, ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { useAuthStore } from '@/store'

const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'))
const ClientsPage = lazy(() => import('@/pages/Clients/ClientsPage'))
const ClientDetailPage = lazy(() => import('@/pages/Clients/ClientDetailPage'))
const CompaniesPage = lazy(() => import('@/pages/Companies/CompaniesPage'))
const CompliancePage = lazy(() => import('@/pages/Compliance/CompliancePage'))
const GSTPage = lazy(() => import('@/pages/Compliance/ComplianceSubPages').then(m => ({ default: m.GSTPage })))
const ITRPage = lazy(() => import('@/pages/Compliance/ComplianceSubPages').then(m => ({ default: m.ITRPage })))
const TDSPage = lazy(() => import('@/pages/Compliance/ComplianceSubPages').then(m => ({ default: m.TDSPage })))
const ROCPage = lazy(() => import('@/pages/Compliance/ComplianceSubPages').then(m => ({ default: m.ROCPage })))
const AccountingPage = lazy(() => import('@/pages/Accounting/AccountingPage'))
const InvoicesPage = lazy(() => import('@/pages/Invoices/InvoicesPage'))
const PaymentsPage = lazy(() => import('@/pages/Payments/PaymentsPage'))
const DocumentsPage = lazy(() => import('@/pages/Documents/DocumentsPage'))
const TasksPage = lazy(() => import('@/pages/Tasks/TasksPage'))
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'))
const EmployeesPage = lazy(() => import('@/pages/Employees/EmployeesPage'))
const AIPage = lazy(() => import('@/pages/AI/AIPage'))
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'))
const LoginPage = lazy(() => import('@/pages/Auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/Auth/ForgotPasswordPage'))
const NotFoundPage = lazy(() => import('@/pages/Error/NotFoundPage'))
const NotesPage = lazy(() => import('@/pages/Notes/NotesPage'))
const CalendarPage = lazy(() => import('@/pages/Calendar/CalendarPage'))
const RecycleBinPage = lazy(() => import('@/pages/RecycleBin/RecycleBinPage'))
const UnauthorizedPage = lazy(() => import('@/pages/Error/UnauthorizedPage'))

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthHydrated()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!hydrated) return <AuthLoading />
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function Protected({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LazyPage><GuestRoute><LoginPage /></GuestRoute></LazyPage>,
  },
  {
    path: '/forgot-password',
    element: <LazyPage><GuestRoute><ForgotPasswordPage /></GuestRoute></LazyPage>,
  },
  {
    path: '/',
    element: <Protected><AppLayout /></Protected>,
    errorElement: <LazyPage><NotFoundPage /></LazyPage>,
    children: [
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      { path: 'clients', element: <LazyPage><ClientsPage /></LazyPage> },
      { path: 'clients/:id', element: <LazyPage><ClientDetailPage /></LazyPage> },
      { path: 'companies', element: <LazyPage><CompaniesPage /></LazyPage> },
      { path: 'compliance', element: <LazyPage><CompliancePage /></LazyPage> },
      { path: 'compliance/gst', element: <LazyPage><GSTPage /></LazyPage> },
      { path: 'compliance/itr', element: <LazyPage><ITRPage /></LazyPage> },
      { path: 'compliance/tds', element: <LazyPage><TDSPage /></LazyPage> },
      { path: 'compliance/roc', element: <LazyPage><ROCPage /></LazyPage> },
      { path: 'accounting', element: <LazyPage><AccountingPage /></LazyPage> },
      { path: 'invoices', element: <LazyPage><InvoicesPage /></LazyPage> },
      { path: 'payments', element: <LazyPage><PaymentsPage /></LazyPage> },
      { path: 'documents', element: <LazyPage><DocumentsPage /></LazyPage> },
      { path: 'tasks', element: <LazyPage><TasksPage /></LazyPage> },
      { path: 'notes', element: <LazyPage><NotesPage /></LazyPage> },
      { path: 'calendar', element: <LazyPage><CalendarPage /></LazyPage> },
      { path: 'reports', element: <LazyPage><ReportsPage /></LazyPage> },
      { path: 'employees', element: <LazyPage><EmployeesPage /></LazyPage> },
      { path: 'recycle-bin', element: <LazyPage><RecycleBinPage /></LazyPage> },
      { path: 'ai', element: <LazyPage><AIPage /></LazyPage> },
      { path: 'settings', element: <LazyPage><SettingsPage /></LazyPage> },
      { path: 'unauthorized', element: <LazyPage><UnauthorizedPage /></LazyPage> },
    ],
  },
  {
    path: '*',
    element: <LazyPage><NotFoundPage /></LazyPage>,
  },
])
