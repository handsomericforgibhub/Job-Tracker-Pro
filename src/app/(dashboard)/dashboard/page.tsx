'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Briefcase, 
  Users, 
  DollarSign, 
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  Building,
  AlertCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardPage() {
  const router = useRouter()
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  
  // For site admins, use company context if available, otherwise fall back to their direct company
  const effectiveCompany = user?.role === 'site_admin' ? (currentCompanyContext || company) : company

  // Fetch dashboard analytics
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['dashboard-analytics', effectiveCompany?.id],
    queryFn: async () => {
      if (!effectiveCompany?.id) return null
      const response = await fetch(`/api/analytics?company_id=${effectiveCompany.id}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      return response.json()
    },
    enabled: !!effectiveCompany?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch recent jobs
  const { data: recentJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['recent-jobs', effectiveCompany?.id],
    queryFn: async () => {
      if (!effectiveCompany?.id) return []
      const response = await fetch(`/api/jobs?limit=5&company_id=${effectiveCompany.id}`)
      if (!response.ok) throw new Error('Failed to fetch jobs')
      return response.json()
    },
    enabled: !!effectiveCompany?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">Loading Dashboard...</h2>
          <p className="text-gray-500">Please wait while we load your dashboard</p>
        </div>
      </div>
    )
  }

  // If user doesn't have a company, show a different state (except for site admins)
  if (!effectiveCompany) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <Building className="h-12 w-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">Company Setup Required</h2>
          <p className="text-gray-500 mb-6">
            You need to be associated with a company to access the dashboard.
          </p>
          
          {/* Debug info - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-100 p-4 rounded-lg mb-6 text-left">
              <h3 className="font-medium mb-2">Debug Info:</h3>
              <p className="text-sm">User ID: {user?.id}</p>
              <p className="text-sm">User Email: {user?.email}</p>
              <p className="text-sm">Company ID: {user?.company_id || 'None'}</p>
              <p className="text-sm">User Role: {user?.role}</p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard/admin/companies')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Company
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Refresh Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderStatsCard = (title: string, value: string | number, change: string, icon: React.ElementType, isLoading: boolean) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {React.createElement(icon, { className: "h-4 w-4 text-muted-foreground" })}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{change}</p>
          </>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.full_name || user.email}
          </h1>
          <p className="text-gray-600">
            {effectiveCompany.name} • {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          {user.role === 'site_admin' && currentCompanyContext && (
            <p className="text-sm text-blue-600 mt-1">
              📋 Site Admin • Managing {currentCompanyContext.name}
            </p>
          )}
        </div>
      </div>

      {/* Analytics Error State */}
      {analyticsError && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
              <span className="text-orange-800">Unable to load dashboard analytics. Using cached data.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderStatsCard(
          "Total Jobs", 
          analytics?.totalJobs ?? '0',
          analytics?.jobsChange ?? '+0 from last month',
          Briefcase,
          analyticsLoading
        )}
        
        {renderStatsCard(
          "Active Workers",
          analytics?.activeWorkers ?? '0',
          analytics?.workersChange ?? '+0 from last week',
          Users,
          analyticsLoading
        )}
        
        {renderStatsCard(
          "Revenue",
          analytics?.revenue ? `$${analytics.revenue.toLocaleString()}` : '$0',
          analytics?.revenueChange ?? '+0% from last month',
          DollarSign,
          analyticsLoading
        )}
        
        {renderStatsCard(
          "Completion Rate",
          analytics?.completionRate ? `${analytics.completionRate}%` : '0%',
          analytics?.completionChange ?? '+0% from last month',
          TrendingUp,
          analyticsLoading
        )}
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>
            Latest projects and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentJobs?.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.slice(0, 5).map((job: any) => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-gray-500">{job.address || 'No address'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {job.status.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No jobs yet</h3>
              <p className="text-gray-500 mb-4">Create your first job to get started</p>
              <Link
                href="/dashboard/jobs/new"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Job
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and navigation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link 
              href="/dashboard/jobs"
              className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
            >
              <Briefcase className="h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-medium">View Jobs</h3>
              <p className="text-sm text-gray-600">Manage projects</p>
            </Link>

            {(user.role === 'company_admin' || user.role === 'foreman') && (
              <Link 
                href="/dashboard/workers"
                className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
              >
                <Users className="h-8 w-8 text-green-600 mb-2" />
                <h3 className="font-medium">Workers</h3>
                <p className="text-sm text-gray-600">Team management</p>
              </Link>
            )}

            {(user.role === 'company_admin' || user.role === 'foreman') && (
              <Link 
                href="/dashboard/analytics"
                className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
              >
                <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
                <h3 className="font-medium">Analytics</h3>
                <p className="text-sm text-gray-600">View reports</p>
              </Link>
            )}

            <Link 
              href="/dashboard/time"
              className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
            >
              <Clock className="h-8 w-8 text-yellow-600 mb-2" />
              <h3 className="font-medium">Time Tracking</h3>
              <p className="text-sm text-gray-600">Check in/out</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}