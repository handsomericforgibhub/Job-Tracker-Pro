'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Download,
  Calendar,
  PieChart,
  BarChart3,
  FileText,
  ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function FinancialReportsPage() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [isLoading, setIsLoading] = useState(true)

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  if (!user || (user.role === 'site_admin' && !currentCompanyContext)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view financial reports.</p>
        </div>
      </div>
    )
  }

  const mockFinancialData = {
    revenue: {
      current: '$145,230',
      change: '+12.5%',
      trend: 'up'
    },
    expenses: {
      current: '$89,450',
      change: '+3.2%',
      trend: 'up'
    },
    profit: {
      current: '$55,780',
      change: '+18.7%',
      trend: 'up'
    },
    outstanding: {
      current: '$23,100',
      change: '-5.4%',
      trend: 'down'
    }
  }

  const reportTypes = [
    {
      name: 'Revenue Report',
      description: 'Detailed breakdown of income sources',
      icon: TrendingUp,
      color: 'text-green-600'
    },
    {
      name: 'Expense Report', 
      description: 'Analysis of business expenses',
      icon: TrendingDown,
      color: 'text-red-600'
    },
    {
      name: 'Profit & Loss',
      description: 'P&L statement for selected period',
      icon: BarChart3,
      color: 'text-blue-600'
    },
    {
      name: 'Cash Flow',
      description: 'Cash inflow and outflow analysis',
      icon: PieChart,
      color: 'text-purple-600'
    }
  ]

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
            <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-gray-600">
              {effectiveCompany?.name} • Revenue & expense analysis
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <Button className="flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Revenue', data: mockFinancialData.revenue, icon: DollarSign, color: 'text-green-600' },
          { title: 'Total Expenses', data: mockFinancialData.expenses, icon: TrendingDown, color: 'text-red-600' },
          { title: 'Net Profit', data: mockFinancialData.profit, icon: TrendingUp, color: 'text-blue-600' },
          { title: 'Outstanding', data: mockFinancialData.outstanding, icon: Calendar, color: 'text-orange-600' }
        ].map((item, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.data.current}</div>
              <p className={`text-xs ${item.data.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {item.data.change} from last {selectedPeriod}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Types */}
      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
          <CardDescription>
            Generate detailed financial reports for your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reportTypes.map((report, index) => (
              <div 
                key={index}
                className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => {
                  // TODO: Implement report generation
                  alert(`Generating ${report.name}...`)
                }}
              >
                <report.icon className={`h-8 w-8 ${report.color} mt-1`} />
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{report.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>
            Previously generated financial reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                    <div>
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No reports generated yet</p>
              <p className="text-sm">Generate your first financial report above</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}