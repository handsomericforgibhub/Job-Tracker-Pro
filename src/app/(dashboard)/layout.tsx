import ProtectedRoute from '@/components/shared/layout/protected-route'
import Sidebar from '@/components/shared/layout/sidebar'
import Header from '@/components/shared/layout/header'
import { PageErrorBoundary, ComponentErrorBoundary } from '@/components/shared/error-boundary'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
        <ComponentErrorBoundary componentName="Sidebar">
          <Sidebar />
        </ComponentErrorBoundary>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ComponentErrorBoundary componentName="Header">
            <Header />
          </ComponentErrorBoundary>
          <main className="flex-1 overflow-y-auto p-6">
            <PageErrorBoundary>
              {children}
            </PageErrorBoundary>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}