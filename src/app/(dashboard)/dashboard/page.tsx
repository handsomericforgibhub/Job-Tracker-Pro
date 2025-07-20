'use client'

import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Briefcase, 
  Users, 
  DollarSign, 
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Building,
  Crown
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface StatItem {
  title: string
  value: string
  icon: string
  change: string
}

interface ActivityItem {
  time: string
  activity: string
  user: string
  status: string
}

interface AnalyticsData {
  stats: StatItem[]
  recent_activity: ActivityItem[]
}

export default function DashboardPage() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const router = useRouter()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({ stats: [], recent_activity: [] })
  const [isLoading, setIsLoading] = useState(true)

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return
      
      // If site admin without company context, don't load analytics
      if (user.role === 'site_admin' && !currentCompanyContext) {
        setIsLoading(false)
        return
      }

      if (!effectiveCompany) return

      try {
        setIsLoading(true)
        const response = await fetch(`/api/analytics?company_id=${effectiveCompany.id}&role=${user.role}`)
        if (response.ok) {
          const data = await response.json()
          setAnalyticsData(data)
        } else {
          console.error('Failed to fetch analytics')
        }
      } catch (error) {
        console.error('Analytics fetch error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [user, effectiveCompany, currentCompanyContext])

  if (!user) return null

  // Show site admin specific content if they're not in company context
  if (user.role === 'site_admin' && !currentCompanyContext) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Site Administrator Dashboard
            </h1>
            <p className="text-gray-600">
              Welcome to the platform overview • {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Crown className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-blue-900">Site Administrator Mode</h2>
              <p className="text-blue-700">You have access to all companies and platform-wide features</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => router.push('/dashboard/site-admin/companies')}
              className="p-4 text-left rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <Building className="h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-medium text-blue-900">Manage Companies</h3>
              <p className="text-sm text-blue-700">View and manage all companies on the platform</p>
            </button>
            <button 
              onClick={() => router.push('/dashboard/site-admin')}
              className="p-4 text-left rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <TrendingUp className="h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-medium text-blue-900">Platform Analytics</h3>
              <p className="text-sm text-blue-700">View platform-wide statistics and insights</p>
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Company to View Dashboard</h3>
          <p className="text-gray-600 mb-4">
            To see company-specific dashboard data, navigate to a company from the Companies page and enter its context.
          </p>
          <button 
            onClick={() => router.push('/dashboard/site-admin/companies')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Browse Companies
          </button>
        </div>
      </div>
    )
  }

  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: any } = {
      Briefcase,
      Users,
      DollarSign,
      TrendingUp,
      Calendar,
      AlertCircle,
      CheckCircle,
      Clock
    }
    return iconMap[iconName] || Briefcase
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'active':
      case 'new':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.role === 'site_admin' ? 'Site Administrator' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </h1>
          <p className="text-gray-600">
            {effectiveCompany?.name && `${effectiveCompany.name} • `}
            {user.role === 'site_admin' && currentCompanyContext && 'Company Context • '}
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* Site Admin Context Warning */}
      {user.role === 'site_admin' && currentCompanyContext && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Crown className="h-5 w-5 text-blue-600 mr-2" />
            <div className="flex-1">
              <p className="text-blue-800">
                <strong>Site Admin Mode:</strong> You are currently viewing data for <strong>{currentCompanyContext.name}</strong>
              </p>
              <p className="text-blue-600 text-sm">
                You have full access to this company's data and can make changes as needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading skeleton
          [...Array(4)].map((_, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))
        ) : (
          analyticsData.stats.map((stat, index) => {
            const IconComponent = getIconComponent(stat.icon)
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest updates and actions across your projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              // Loading skeleton for activity
              [...Array(4)].map((_, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 rounded-lg border">
                  <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
              ))
            ) : analyticsData.recent_activity.length > 0 ? (
              analyticsData.recent_activity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 rounded-lg border">
                  <div className="text-sm text-gray-500 min-w-[60px]">
                    {activity.time}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.activity}
                    </p>
                    <p className="text-sm text-gray-600">{activity.user}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status)}`}>
                    {activity.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No recent activity found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks for your role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(user.role === 'owner' || (user.role === 'site_admin' && currentCompanyContext)) && (
              <>
                <Link 
                  href="/dashboard/jobs/new"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <Briefcase className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium">Create New Job</h3>
                  <p className="text-sm text-gray-600">Start a new project</p>
                </Link>
                <Link 
                  href="/dashboard/workers/new"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <Users className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-medium">Add Worker</h3>
                  <p className="text-sm text-gray-600">Invite team member</p>
                </Link>
                <Link 
                  href="/dashboard/analytics"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-medium">View Analytics</h3>
                  <p className="text-sm text-gray-600">Business insights</p>
                </Link>
                <Link 
                  href="/dashboard/accounting/reports"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <DollarSign className="h-8 w-8 text-yellow-600 mb-2" />
                  <h3 className="font-medium">Financial Reports</h3>
                  <p className="text-sm text-gray-600">Revenue & expenses</p>
                </Link>
              </>
            )}
            
            {user.role === 'foreman' && (
              <>
                <button 
                  onClick={() => router.push('/dashboard/jobs')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-medium">Daily Log</h3>
                  <p className="text-sm text-gray-600">Submit progress</p>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/time')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
                  <h3 className="font-medium">Safety Check</h3>
                  <p className="text-sm text-gray-600">Complete checklist</p>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/workers')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Users className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium">Team Status</h3>
                  <p className="text-sm text-gray-600">Check attendance</p>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/jobs')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Calendar className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-medium">Schedule</h3>
                  <p className="text-sm text-gray-600">Manage tasks</p>
                </button>
              </>
            )}

            {user.role === 'worker' && (
              <>
                <button 
                  onClick={() => router.push('/dashboard/my-work')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Briefcase className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium">My Tasks</h3>
                  <p className="text-sm text-gray-600">View assignments</p>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/time')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Clock className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-medium">Time Clock</h3>
                  <p className="text-sm text-gray-600">Check in/out</p>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/documents')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <CheckCircle className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-medium">Upload Photos</h3>
                  <p className="text-sm text-gray-600">Document progress</p>
                </button>
                <button 
                  onClick={() => router.push('/dashboard/my-work')}
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Calendar className="h-8 w-8 text-yellow-600 mb-2" />
                  <h3 className="font-medium">Schedule</h3>
                  <p className="text-sm text-gray-600">View assignments</p>
                </button>
              </>
            )}

            {user.role === 'site_admin' && (
              <>
                <Link 
                  href="/dashboard/admin/companies"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <Building className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-medium">Manage Companies</h3>
                  <p className="text-sm text-gray-600">Platform administration</p>
                </Link>
                <Link 
                  href="/dashboard/admin/stats"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
                  <h3 className="font-medium">Platform Stats</h3>
                  <p className="text-sm text-gray-600">View analytics</p>
                </Link>
                <Link 
                  href="/dashboard/admin/settings"
                  className="p-4 text-left rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer block"
                >
                  <Crown className="h-8 w-8 text-yellow-600 mb-2" />
                  <h3 className="font-medium">Platform Admin</h3>
                  <p className="text-sm text-gray-600">System configuration</p>
                </Link>
              </>
            )}

          </div>
        </CardContent>
      </Card>
    </div>
  )
}