import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch detailed analytics data for charts and reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    // Fetch detailed analytics data in parallel
    const analyticsPromises = [
      // 1. Jobs by status distribution
      supabase
        .from('jobs')
        .select('status')
        .eq('company_id', company_id),

      // 2. Workers by employment status
      supabase
        .from('workers')
        .select('employment_status')
        .eq('company_id', company_id),

      // 3. Tasks by priority and completion status
      supabase
        .from('tasks')
        .select('priority, status, jobs!inner(company_id)')
        .eq('jobs.company_id', company_id),

      // 4. Monthly revenue from completed jobs (last 6 months)
      supabase
        .from('jobs')
        .select('budget, end_date, status')
        .eq('company_id', company_id)
        .eq('status', 'completed')
        .not('budget', 'is', null)
        .not('end_date', 'is', null)
        .gte('end_date', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),

      // 5. Time tracking summary for labor costs
      supabase
        .from('time_entries')
        .select('total_cost, start_time, status')
        .eq('company_id', company_id)
        .eq('status', 'approved')
        .gte('start_time', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()),

      // 6. Job duration analysis
      supabase
        .from('jobs')
        .select('start_date, end_date, status')
        .eq('company_id', company_id)
        .eq('status', 'completed')
        .not('start_date', 'is', null)
        .not('end_date', 'is', null)
    ]

    const [
      jobsRes,
      workersRes,
      tasksRes,
      revenueRes,
      timeRes,
      durationsRes
    ] = await Promise.all(analyticsPromises)

    // Process jobs by status
    const jobsByStatus = jobsRes.data ? jobsRes.data.reduce((acc: any, job) => {
      const status = job.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {}) : {}

    const jobsStatusData = Object.entries(jobsByStatus).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      count: count as number
    }))

    // Process workers by status
    const workersByStatus = workersRes.data ? workersRes.data.reduce((acc: any, worker) => {
      const status = worker.employment_status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {}) : {}

    const workersStatusData = Object.entries(workersByStatus).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count: count as number
    }))

    // Process task completion by priority
    const tasksByPriority = tasksRes.data ? tasksRes.data.reduce((acc: any, task) => {
      const priority = task.priority || 'medium'
      if (!acc[priority]) {
        acc[priority] = { completed: 0, total: 0 }
      }
      acc[priority].total += 1
      if (task.status === 'completed') {
        acc[priority].completed += 1
      }
      return acc
    }, {}) : {}

    const taskCompletionData = Object.entries(tasksByPriority).map(([priority, data]: [string, any]) => ({
      priority: priority.charAt(0).toUpperCase() + priority.slice(1),
      completed: data.completed,
      total: data.total
    }))

    // Process monthly revenue
    const monthlyRevenue = new Map<string, number>()
    if (revenueRes.data) {
      revenueRes.data.forEach(job => {
        if (job.end_date && job.budget) {
          const month = new Date(job.end_date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
          })
          monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + job.budget)
        }
      })
    }

    // Get last 6 months for consistent display
    const last6Months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStr = date.toLocaleDateString('en-US', { month: 'short' })
      const yearMonth = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      last6Months.push({
        month: monthStr,
        revenue: monthlyRevenue.get(yearMonth) || 0
      })
    }

    // Calculate average job duration
    let avgDuration = 0
    if (durationsRes.data && durationsRes.data.length > 0) {
      const totalDuration = durationsRes.data.reduce((sum, job) => {
        if (job.start_date && job.end_date) {
          const start = new Date(job.start_date).getTime()
          const end = new Date(job.end_date).getTime()
          const durationDays = (end - start) / (1000 * 60 * 60 * 24)
          return sum + durationDays
        }
        return sum
      }, 0)
      avgDuration = Math.round(totalDuration / durationsRes.data.length)
    }

    // Calculate overview metrics
    const overview = {
      totalJobs: jobsRes.data?.length || 0,
      totalWorkers: workersRes.data?.filter(w => w.employment_status === 'active').length || 0,
      totalRevenue: revenueRes.data?.reduce((sum, job) => sum + (job.budget || 0), 0) || 0,
      avgJobDuration: avgDuration
    }

    const charts = {
      jobsByStatus: jobsStatusData,
      workersByStatus: workersStatusData,
      monthlyRevenue: last6Months,
      taskCompletion: taskCompletionData
    }

    return NextResponse.json({
      overview,
      charts
    })

  } catch (error) {
    console.error('Detailed analytics error:', error)
    return NextResponse.json({
      error: 'Failed to fetch detailed analytics data'
    }, { status: 500 })
  }
}