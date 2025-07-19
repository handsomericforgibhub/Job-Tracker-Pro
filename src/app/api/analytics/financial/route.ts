import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface FinancialAnalyticsData {
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
    laborCosts: number
    profit: number
    profitMargin: number
    status: string
    startDate: string
    endDate?: string
  }[]
  laborAnalytics: {
    totalLaborCosts: number
    averageHourlyRate: number
    overtimeHours: number
    overtimeCosts: number
    regularHours: number
    regularCosts: number
    topWorkersByHours: {
      workerId: string
      workerName: string
      totalHours: number
      totalCost: number
      averageHourlyRate: number
    }[]
  }
  monthlyCashFlow: {
    month: string
    revenue: number
    laborCosts: number
    profit: number
    profitMargin: number
  }[]
  costBreakdown: {
    category: string
    amount: number
    percentage: number
  }[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    // Set default date range to last 6 months if not provided
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 6)

    const dateFilter = {
      start: startDate ? new Date(startDate) : defaultStartDate,
      end: endDate ? new Date(endDate) : defaultEndDate
    }

    // Fetch all relevant data in parallel
    const [
      jobsRes,
      timeEntriesRes,
      completedJobsRes,
      workersRes
    ] = await Promise.all([
      // 1. All jobs with budget information
      supabase
        .from('jobs')
        .select('id, title, budget, status, start_date, end_date, created_at')
        .eq('company_id', company_id)
        .gte('created_at', dateFilter.start.toISOString())
        .lte('created_at', dateFilter.end.toISOString()),

      // 2. All approved time entries for cost calculation
      supabase
        .from('time_entries')
        .select(`
          id, job_id, worker_id, duration_minutes, hourly_rate, total_cost, 
          entry_type, start_time, end_time, status,
          worker:workers(id, first_name, last_name, employee_id),
          job:jobs(id, title, budget)
        `)
        .eq('company_id', company_id)
        .eq('status', 'approved')
        .gte('start_time', dateFilter.start.toISOString())
        .lte('start_time', dateFilter.end.toISOString()),

      // 3. Completed jobs for revenue calculation
      supabase
        .from('jobs')
        .select('id, title, budget, end_date, status')
        .eq('company_id', company_id)
        .eq('status', 'completed')
        .not('budget', 'is', null)
        .gte('end_date', dateFilter.start.toISOString())
        .lte('end_date', dateFilter.end.toISOString()),

      // 4. Active workers for productivity metrics
      supabase
        .from('workers')
        .select('id, first_name, last_name, employee_id, hourly_rate')
        .eq('company_id', company_id)
        .eq('employment_status', 'active')
    ])

    if (jobsRes.error || timeEntriesRes.error || completedJobsRes.error || workersRes.error) {
      throw new Error('Failed to fetch data from database')
    }

    const jobs = jobsRes.data || []
    const timeEntries = timeEntriesRes.data || []
    const completedJobs = completedJobsRes.data || []
    const workers = workersRes.data || []

    // Calculate job profitability
    const jobProfitability = jobs.map(job => {
      const jobTimeEntries = timeEntries.filter(entry => entry.job_id === job.id)
      const laborCosts = jobTimeEntries.reduce((sum, entry) => sum + (entry.total_cost || 0), 0)
      const actualCosts = laborCosts // For now, only including labor costs
      const profit = (job.budget || 0) - actualCosts
      const profitMargin = job.budget ? (profit / job.budget) * 100 : 0

      return {
        jobId: job.id,
        jobTitle: job.title,
        budget: job.budget || 0,
        actualCosts,
        laborCosts,
        profit,
        profitMargin,
        status: job.status,
        startDate: job.start_date,
        endDate: job.end_date
      }
    }).sort((a, b) => b.profit - a.profit)

    // Calculate labor analytics
    const regularEntries = timeEntries.filter(entry => entry.entry_type !== 'overtime')
    const overtimeEntries = timeEntries.filter(entry => entry.entry_type === 'overtime')

    const regularHours = regularEntries.reduce((sum, entry) => sum + ((entry.duration_minutes || 0) / 60), 0)
    const overtimeHours = overtimeEntries.reduce((sum, entry) => sum + ((entry.duration_minutes || 0) / 60), 0)
    const regularCosts = regularEntries.reduce((sum, entry) => sum + (entry.total_cost || 0), 0)
    const overtimeCosts = overtimeEntries.reduce((sum, entry) => sum + (entry.total_cost || 0), 0)

    // Worker productivity metrics
    const workerHours = new Map<string, {
      workerId: string
      workerName: string
      totalHours: number
      totalCost: number
      entries: number
    }>()

    timeEntries.forEach(entry => {
      const workerId = entry.worker_id
      const workerName = entry.worker ? `${entry.worker.first_name} ${entry.worker.last_name}` : 'Unknown'
      const hours = (entry.duration_minutes || 0) / 60
      const cost = entry.total_cost || 0

      if (!workerHours.has(workerId)) {
        workerHours.set(workerId, {
          workerId,
          workerName,
          totalHours: 0,
          totalCost: 0,
          entries: 0
        })
      }

      const worker = workerHours.get(workerId)!
      worker.totalHours += hours
      worker.totalCost += cost
      worker.entries += 1
    })

    const topWorkersByHours = Array.from(workerHours.values())
      .map(worker => ({
        ...worker,
        averageHourlyRate: worker.totalHours > 0 ? worker.totalCost / worker.totalHours : 0
      }))
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10)

    // Calculate monthly cash flow
    const monthlyData = new Map<string, {
      revenue: number
      laborCosts: number
    }>()

    // Group completed jobs by month for revenue
    completedJobs.forEach(job => {
      if (job.end_date && job.budget) {
        const monthKey = new Date(job.end_date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        })
        
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { revenue: 0, laborCosts: 0 })
        }
        
        monthlyData.get(monthKey)!.revenue += job.budget
      }
    })

    // Group labor costs by month
    timeEntries.forEach(entry => {
      const monthKey = new Date(entry.start_time).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      })
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenue: 0, laborCosts: 0 })
      }
      
      monthlyData.get(monthKey)!.laborCosts += entry.total_cost || 0
    })

    // Generate last 6 months data
    const monthlyCashFlow = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      const monthShort = date.toLocaleDateString('en-US', { month: 'short' })
      
      const data = monthlyData.get(monthKey) || { revenue: 0, laborCosts: 0 }
      const profit = data.revenue - data.laborCosts
      const profitMargin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0
      
      monthlyCashFlow.push({
        month: monthShort,
        revenue: data.revenue,
        laborCosts: data.laborCosts,
        profit,
        profitMargin
      })
    }

    // Calculate overview metrics
    const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.budget || 0), 0)
    const totalLaborCosts = regularCosts + overtimeCosts
    const grossProfit = totalRevenue - totalLaborCosts
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const averageJobProfit = jobProfitability.length > 0 ? 
      jobProfitability.reduce((sum, job) => sum + job.profit, 0) / jobProfitability.length : 0
    const laborCostsPercentage = totalRevenue > 0 ? (totalLaborCosts / totalRevenue) * 100 : 0

    // Cost breakdown
    const costBreakdown = [
      {
        category: 'Regular Labor',
        amount: regularCosts,
        percentage: totalLaborCosts > 0 ? (regularCosts / totalLaborCosts) * 100 : 0
      },
      {
        category: 'Overtime Labor',
        amount: overtimeCosts,
        percentage: totalLaborCosts > 0 ? (overtimeCosts / totalLaborCosts) * 100 : 0
      }
    ]

    const financialData: FinancialAnalyticsData = {
      overview: {
        totalRevenue,
        totalCosts: totalLaborCosts,
        grossProfit,
        profitMargin,
        averageJobProfit,
        laborCostsPercentage
      },
      jobProfitability: jobProfitability.slice(0, 20), // Top 20 jobs
      laborAnalytics: {
        totalLaborCosts,
        averageHourlyRate: (regularHours + overtimeHours) > 0 ? totalLaborCosts / (regularHours + overtimeHours) : 0,
        overtimeHours,
        overtimeCosts,
        regularHours,
        regularCosts,
        topWorkersByHours
      },
      monthlyCashFlow,
      costBreakdown
    }

    return NextResponse.json(financialData)

  } catch (error) {
    console.error('Financial analytics error:', error)
    return NextResponse.json({
      error: 'Failed to fetch financial analytics data'
    }, { status: 500 })
  }
}