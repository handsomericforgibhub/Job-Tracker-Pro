'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Building,
  Briefcase,
  DollarSign,
  ArrowLeft,
  Calendar,
  Activity,
  Server,
  Database,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PlatformStats {
  users: {
    total: number
    active: number
    new_this_month: number
    growth_rate: string
  }
  companies: {
    total: number
    active: number
    trial: number
    growth_rate: string
  }
  jobs: {
    total: number
    active: number
    completed_this_month: number
    growth_rate: string
  }
  revenue: {
    total: string
    monthly: string
    growth_rate: string
  }
  system: {
    uptime: string
    cpu_usage: number
    memory_usage: number
    storage_usage: number
  }
}

export default function PlatformStatsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState('30d')

  useEffect(() => {
    // Simulate loading platform stats
    setTimeout(() => {
      const mockStats: PlatformStats = {
        users: {
          total: 1247,
          active: 892,
          new_this_month: 156,
          growth_rate: '+15.2%'
        },
        companies: {
          total: 45,
          active: 38,
          trial: 7,
          growth_rate: '+8.7%'
        },
        jobs: {
          total: 2834,
          active: 567,
          completed_this_month: 234,
          growth_rate: '+12.4%'
        },
        revenue: {
          total: '$127,450',
          monthly: '$18,500',
          growth_rate: '+22.1%'
        },
        system: {
          uptime: '99.8%',
          cpu_usage: 45,
          memory_usage: 68,
          storage_usage: 34
        }
      }
      setStats(mockStats)
      setIsLoading(false)
    }, 1000)
  }, [selectedTimeframe])

  // Check if user has admin access
  if (!user || user.role !== 'site_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access platform statistics.</p>
        </div>
      </div>
    )
  }

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getGrowthIcon = (rate: string) => {
    return rate.startsWith('+') ? 
      <TrendingUp className="h-4 w-4 text-green-600" /> : 
      <TrendingDown className="h-4 w-4 text-red-600" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Statistics</h1>
            <p className="text-gray-600">
              System-wide analytics and performance metrics
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <select 
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            System Status
          </CardTitle>
          <CardDescription>
            Real-time platform health and performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-600">Uptime</p>
                <p className="text-2xl font-bold text-green-700">
                  {isLoading ? '---' : stats?.system.uptime}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            {['CPU Usage', 'Memory Usage', 'Storage Usage'].map((metric, index) => {
              const value = isLoading ? 0 : 
                index === 0 ? stats?.system.cpu_usage :
                index === 1 ? stats?.system.memory_usage :
                stats?.system.storage_usage
              
              return (
                <div key={metric} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">{metric}</p>
                    <p className="text-sm font-bold">{value}%</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getUsageColor(value || 0)}`}
                      style={{ width: `${value}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Users',
            value: isLoading ? '---' : stats?.users.total.toLocaleString(),
            subtitle: `${isLoading ? '---' : stats?.users.active} active`,
            change: isLoading ? '---' : stats?.users.growth_rate,
            icon: Users,
            color: 'text-blue-600'
          },
          {
            title: 'Companies',
            value: isLoading ? '---' : stats?.companies.total,
            subtitle: `${isLoading ? '---' : stats?.companies.active} active`,
            change: isLoading ? '---' : stats?.companies.growth_rate,
            icon: Building,
            color: 'text-green-600'
          },
          {
            title: 'Total Jobs',
            value: isLoading ? '---' : stats?.jobs.total.toLocaleString(),
            subtitle: `${isLoading ? '---' : stats?.jobs.active} active`,
            change: isLoading ? '---' : stats?.jobs.growth_rate,
            icon: Briefcase,
            color: 'text-purple-600'
          },
          {
            title: 'Revenue',
            value: isLoading ? '---' : stats?.revenue.total,
            subtitle: `${isLoading ? '---' : stats?.revenue.monthly} this month`,
            change: isLoading ? '---' : stats?.revenue.growth_rate,
            icon: DollarSign,
            color: 'text-yellow-600'
          }
        ].map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                <div className="flex items-center">
                  {!isLoading && metric.change && getGrowthIcon(metric.change)}
                  <span className={`text-xs ml-1 ${
                    !isLoading && metric.change && metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change || '---'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>
              User engagement metrics over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="font-medium">Daily Active Users</span>
                  </div>
                  <span className="text-blue-700 font-bold">{stats?.users.active}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium">New Users This Month</span>
                  </div>
                  <span className="text-green-700 font-bold">{stats?.users.new_this_month}</span>
                </div>
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">📊 Chart visualization would go here</p>
                  <p className="text-xs">TODO: Implement activity charts</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Alerts</CardTitle>
            <CardDescription>
              Platform notifications and warnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">High Memory Usage</p>
                  <p className="text-sm text-yellow-700">Memory usage at 68% - consider scaling</p>
                  <p className="text-xs text-yellow-600 mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Backup Completed</p>
                  <p className="text-sm text-green-700">Daily database backup successful</p>
                  <p className="text-xs text-green-600 mt-1">6 hours ago</p>
                </div>
              </div>
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">All systems operational</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}