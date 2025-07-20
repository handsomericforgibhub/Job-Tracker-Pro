'use client'

import { useAuthStore } from '@/stores/auth-store'
import { CHART_COLOR_PALETTE, CHART_COLORS } from '@/config/colors'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { 
  Briefcase, 
  Users, 
  DollarSign, 
  TrendingUp,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Target,
  Award,
  Zap
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'

interface ChartData {
  jobsByStatus: { status: string; count: number }[]
  workersByStatus: { status: string; count: number }[]
  monthlyRevenue: { month: string; revenue: number }[]
  taskCompletion: { priority: string; completed: number; total: number }[]
}

interface AnalyticsPageData {
  overview: {
    totalJobs: number
    totalWorkers: number
    totalRevenue: number
    avgJobDuration: number
  }
  charts: ChartData
}

interface FinancialData {
  overview: {
    totalRevenue: number
    totalCosts: number
    grossProfit: number
    profitMargin: number
    averageJobProfit: number
    laborCostsPercentage: number
  }
  jobProfitability: {
    jobId: string
    jobTitle: string
    budget: number
    actualCosts: number
    profit: number
    profitMargin: number
    status: string
  }[]
  monthlyCashFlow: {
    month: string
    revenue: number
    laborCosts: number
    profit: number
    profitMargin: number
  }[]
  laborAnalytics: {
    totalLaborCosts: number
    averageHourlyRate: number
    overtimeHours: number
    overtimeCosts: number
    topWorkersByHours: {
      workerName: string
      totalHours: number
      totalCost: number
    }[]
  }
}

interface ProductivityData {
  overview: {
    totalWorkers: number
    averageProductivityScore: number
    totalHoursWorked: number
    averageHoursPerWorker: number
    overtimePercentage: number
    taskCompletionRate: number
  }
  workerMetrics: {
    workerId: string
    workerName: string
    totalHours: number
    tasksCompleted: number
    completionRate: number
    productivityScore: number
    currentJob?: string
  }[]
  timeTrackingInsights: {
    checkInPatterns: {
      day: string
      averageCheckInTime: string
      totalHours: number
    }[]
    efficiencyTrends: {
      week: string
      hoursWorked: number
      tasksCompleted: number
      efficiency: number
    }[]
  }
}

export default function AnalyticsPage() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsPageData | null>(null)
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [productivityData, setProductivityData] = useState<ProductivityData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'productivity'>('overview')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  const fetchAllAnalytics = useCallback(async () => {
    if (!user || !effectiveCompany) return

    try {
      setIsLoading(true)
      
      // Fetch all analytics data in parallel
      const [detailedRes, financialRes, productivityRes] = await Promise.all([
        fetch(`/api/analytics/detailed?company_id=${effectiveCompany.id}`),
        fetch(`/api/analytics/financial?company_id=${effectiveCompany.id}&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`),
        fetch(`/api/analytics/productivity?company_id=${effectiveCompany.id}&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`)
      ])

      if (detailedRes.ok) {
        const detailed = await detailedRes.json()
        setAnalyticsData(detailed)
      }

      if (financialRes.ok) {
        const financial = await financialRes.json()
        setFinancialData(financial)
      }

      if (productivityRes.ok) {
        const productivity = await productivityRes.json()
        setProductivityData(productivity)
      }

    } catch (error) {
      console.error('Analytics fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, effectiveCompany, dateRange, currentCompanyContext])

  useEffect(() => {
    fetchAllAnalytics()
  }, [fetchAllAnalytics])

  if (!user) return null

  // Show site admin message if no company context
  if (user.role === 'site_admin' && !currentCompanyContext) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600">Comprehensive insights and performance metrics</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">No Company Context Selected</h3>
          <p className="text-blue-700 mb-4">
            As a site administrator, you need to select a company context to view analytics.
          </p>
          <Link href="/dashboard/site-admin/companies">
            <Button>
              Select Company
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getCompletionPercentage = (completed: number, total: number) => {
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const COLORS = CHART_COLOR_PALETTE

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      color: string;
    }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('$') || entry.name.includes('Revenue') || entry.name.includes('Cost') ? 
                formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Comprehensive insights and performance metrics for {effectiveCompany?.name}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="start-date" className="text-sm">From:</Label>
            <Input
              id="start-date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="end-date" className="text-sm">To:</Label>
            <Input
              id="end-date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-40"
            />
          </div>
          
          <Button 
            onClick={fetchAllAnalytics} 
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'financial', label: 'Financial', icon: DollarSign },
          { id: 'productivity', label: 'Productivity', icon: Users }
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'financial' | 'productivity')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {/* Loading skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && analyticsData && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.overview.totalJobs}</div>
                    <p className="text-xs text-muted-foreground">All time</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.overview.totalWorkers}</div>
                    <p className="text-xs text-muted-foreground">Active employees</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(analyticsData.overview.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground">Year to date</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Job Duration</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsData.overview.avgJobDuration}</div>
                    <p className="text-xs text-muted-foreground">days</p>
                  </CardContent>
                </Card>
              </div>

              {/* Interactive Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Jobs by Status - Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Jobs by Status
                    </CardTitle>
                    <CardDescription>Current distribution of job statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={analyticsData.charts.jobsByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill={CHART_COLORS.PRIMARY}
                          dataKey="count"
                        >
                          {analyticsData.charts.jobsByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Task Completion Rates - Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Task Completion by Priority
                    </CardTitle>
                    <CardDescription>Completion rates across priority levels</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsData.charts.taskCompletion.map(item => ({
                        ...item,
                        completionRate: getCompletionPercentage(item.completed, item.total)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="priority" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="completionRate" fill={CHART_COLORS.PRIMARY} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Monthly Revenue Trend - Line Chart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Monthly Revenue Trend
                    </CardTitle>
                    <CardDescription>Revenue performance over the last 6 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analyticsData.charts.monthlyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.PRIMARY} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Financial Tab */}
          {activeTab === 'financial' && financialData && (
            <div className="space-y-6">
              {/* Financial Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(financialData.overview.totalRevenue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Selected period</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
                    <TrendingUp className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(financialData.overview.totalCosts)}
                    </div>
                    <p className="text-xs text-muted-foreground">Labor costs</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                    <Target className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(financialData.overview.grossProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {financialData.overview.profitMargin.toFixed(1)}% margin
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Job Profit</CardTitle>
                    <Award className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(financialData.overview.averageJobProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground">Per job</p>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly Cash Flow */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Monthly Cash Flow
                    </CardTitle>
                    <CardDescription>Revenue vs Labor Costs over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={financialData.monthlyCashFlow}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="revenue" stackId="1" stroke={CHART_COLORS.PRIMARY} fill={CHART_COLORS.PRIMARY} />
                        <Area type="monotone" dataKey="laborCosts" stackId="2" stroke={CHART_COLORS.SECONDARY} fill={CHART_COLORS.SECONDARY} />
                        <Area type="monotone" dataKey="profit" stackId="3" stroke={CHART_COLORS.TERTIARY} fill={CHART_COLORS.TERTIARY} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Profitable Jobs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Top Profitable Jobs
                    </CardTitle>
                    <CardDescription>Most profitable jobs by margin</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {financialData.jobProfitability.slice(0, 5).map((job) => (
                        <div key={job.jobId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{job.jobTitle}</p>
                            <p className="text-xs text-gray-600">
                              Budget: {formatCurrency(job.budget)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm text-green-600">
                              {formatCurrency(job.profit)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {job.profitMargin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Labor Analytics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Labor Analytics
                    </CardTitle>
                    <CardDescription>Top performers by hours worked</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {financialData.laborAnalytics.topWorkersByHours.slice(0, 5).map((worker) => (
                        <div key={worker.workerName} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{worker.workerName}</p>
                            <p className="text-xs text-gray-600">
                              {worker.totalHours.toFixed(1)} hours
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              {formatCurrency(worker.totalCost)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {formatCurrency(worker.totalCost / worker.totalHours)}/hr
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Productivity Tab */}
          {activeTab === 'productivity' && productivityData && (
            <div className="space-y-6">
              {/* Productivity Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Workers</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{productivityData.overview.totalWorkers}</div>
                    <p className="text-xs text-muted-foreground">Active employees</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Productivity</CardTitle>
                    <Zap className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {productivityData.overview.averageProductivityScore.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Company average</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                    <Clock className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {productivityData.overview.totalHoursWorked.toFixed(0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Hours worked</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {productivityData.overview.taskCompletionRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Completion rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Productivity Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Efficiency Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Efficiency Trends
                    </CardTitle>
                    <CardDescription>Tasks completed per hour worked</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={productivityData.timeTrackingInsights.efficiencyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="efficiency" stroke={CHART_COLORS.PRIMARY} strokeWidth={2} />
                        <Line type="monotone" dataKey="hoursWorked" stroke={CHART_COLORS.SECONDARY} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Check-in Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Daily Check-in Patterns
                    </CardTitle>
                    <CardDescription>Average hours worked by day of week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={productivityData.timeTrackingInsights.checkInPatterns}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="totalHours" fill={CHART_COLORS.PRIMARY} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Performers */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Top Performers
                    </CardTitle>
                    <CardDescription>Workers ranked by productivity score</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {productivityData.workerMetrics.slice(0, 6).map((worker) => (
                        <div key={worker.workerId} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{worker.workerName}</h4>
                            <span className="text-sm font-bold text-blue-600">
                              {worker.productivityScore.toFixed(1)}%
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>Hours: {worker.totalHours.toFixed(1)}</p>
                            <p>Tasks: {worker.tasksCompleted}</p>
                            <p>Completion: {worker.completionRate.toFixed(1)}%</p>
                            {worker.currentJob && (
                              <p className="text-xs text-blue-600">Current: {worker.currentJob}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Performance Insights
              </CardTitle>
              <CardDescription>Key metrics and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {financialData && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium text-green-700">Strong Performance</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Profit margin at {financialData.overview.profitMargin.toFixed(1)}% is healthy
                    </p>
                  </div>
                )}
                {productivityData && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium text-yellow-700">Monitor Closely</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Overtime at {productivityData.overview.overtimePercentage.toFixed(1)}% of total hours
                    </p>
                  </div>
                )}
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium text-blue-700">Opportunity</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Consider implementing productivity incentives
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}