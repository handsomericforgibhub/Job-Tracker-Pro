import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface ProductivityMetrics {
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
    employeeId: string
    totalHours: number
    regularHours: number
    overtimeHours: number
    totalCost: number
    tasksCompleted: number
    tasksAssigned: number
    completionRate: number
    averageHourlyRate: number
    productivityScore: number
    checkInAccuracy: number
    lastActive: string
    currentJob?: string
  }[]
  teamProductivity: {
    teamLead: string
    teamMembers: number
    totalHours: number
    completionRate: number
    averageProductivity: number
  }[]
  timeTrackingInsights: {
    checkInPatterns: {
      day: string
      averageCheckInTime: string
      averageCheckOutTime: string
      totalHours: number
    }[]
    locationAccuracy: {
      workerId: string
      workerName: string
      totalCheckIns: number
      accurateCheckIns: number
      accuracyRate: number
    }[]
    efficiencyTrends: {
      week: string
      hoursWorked: number
      tasksCompleted: number
      efficiency: number
    }[]
  }
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

    // Set default date range to last 30 days if not provided
    const defaultEndDate = new Date()
    const defaultStartDate = new Date()
    defaultStartDate.setDate(defaultStartDate.getDate() - 30)

    const dateFilter = {
      start: startDate ? new Date(startDate) : defaultStartDate,
      end: endDate ? new Date(endDate) : defaultEndDate
    }

    // Fetch all relevant data in parallel
    const [
      workersRes,
      timeEntriesRes,
      tasksRes,
      jobAssignmentsRes,
      checkInsRes
    ] = await Promise.all([
      // 1. All active workers
      supabase
        .from('workers')
        .select('id, first_name, last_name, employee_id, hourly_rate, employment_status, user_id')
        .eq('company_id', company_id)
        .eq('employment_status', 'active'),

      // 2. Time entries for productivity calculation
      supabase
        .from('time_entries')
        .select(`
          id, worker_id, job_id, duration_minutes, hourly_rate, total_cost,
          entry_type, start_time, end_time, status, location_verified,
          start_location, end_location,
          worker:workers(id, first_name, last_name),
          job:jobs(id, title)
        `)
        .eq('company_id', company_id)
        .eq('status', 'approved')
        .gte('start_time', dateFilter.start.toISOString())
        .lte('start_time', dateFilter.end.toISOString()),

      // 3. Tasks for completion rate calculation
      supabase
        .from('tasks')
        .select(`
          id, assigned_to, status, created_at, updated_at, estimated_hours,
          jobs!inner(company_id, title)
        `)
        .eq('jobs.company_id', company_id)
        .gte('created_at', dateFilter.start.toISOString())
        .lte('created_at', dateFilter.end.toISOString()),

      // 4. Job assignments for team analysis
      supabase
        .from('job_assignments')
        .select(`
          id, worker_id, job_id, role, assigned_date, status,
          worker:workers(id, first_name, last_name),
          job:jobs(id, title, company_id)
        `)
        .eq('jobs.company_id', company_id)
        .eq('status', 'active'),

      // 5. Check-ins for location accuracy
      supabase
        .from('worker_check_ins')
        .select(`
          id, worker_id, job_id, check_in_time, check_out_time,
          latitude, longitude, location_verified, created_at,
          worker:workers(id, first_name, last_name, company_id)
        `)
        .eq('workers.company_id', company_id)
        .gte('created_at', dateFilter.start.toISOString())
        .lte('created_at', dateFilter.end.toISOString())
    ])

    if (workersRes.error || timeEntriesRes.error || tasksRes.error || jobAssignmentsRes.error) {
      throw new Error('Failed to fetch data from database')
    }

    const workers = workersRes.data || []
    const timeEntries = timeEntriesRes.data || []
    const tasks = tasksRes.data || []
    const jobAssignments = jobAssignmentsRes.data || []
    const checkIns = checkInsRes.data || []

    // Calculate worker metrics
    const workerMetrics = workers.map(worker => {
      const workerTimeEntries = timeEntries.filter(entry => entry.worker_id === worker.id)
      const workerTasks = tasks.filter(task => task.assigned_to === worker.user_id)
      const workerCheckIns = checkIns.filter(checkIn => checkIn.worker_id === worker.id)

      // Time calculations
      const totalMinutes = workerTimeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0)
      const totalHours = totalMinutes / 60
      const regularHours = workerTimeEntries
        .filter(entry => entry.entry_type !== 'overtime')
        .reduce((sum, entry) => sum + ((entry.duration_minutes || 0) / 60), 0)
      const overtimeHours = totalHours - regularHours
      const totalCost = workerTimeEntries.reduce((sum, entry) => sum + (entry.total_cost || 0), 0)

      // Task completion
      const tasksCompleted = workerTasks.filter(task => task.status === 'completed').length
      const tasksAssigned = workerTasks.length
      const completionRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 0

      // Location accuracy
      const accurateCheckIns = workerCheckIns.filter(checkIn => checkIn.location_verified).length
      const checkInAccuracy = workerCheckIns.length > 0 ? (accurateCheckIns / workerCheckIns.length) * 100 : 0

      // Productivity score (weighted average of completion rate, hours worked, and accuracy)
      const hoursScore = Math.min(totalHours / 160, 1) * 100 // Assuming 160 hours per month as full productivity
      const productivityScore = (completionRate * 0.5) + (hoursScore * 0.3) + (checkInAccuracy * 0.2)

      // Find current job assignment
      const currentAssignment = jobAssignments.find(assignment => assignment.worker_id === worker.id)
      const currentJob = currentAssignment?.job?.title

      // Last active time
      const lastEntry = workerTimeEntries.sort((a, b) => 
        new Date(b.end_time || b.start_time).getTime() - new Date(a.end_time || a.start_time).getTime()
      )[0]
      const lastActive = lastEntry ? (lastEntry.end_time || lastEntry.start_time) : null

      return {
        workerId: worker.id,
        workerName: `${worker.first_name} ${worker.last_name}`,
        employeeId: worker.employee_id || '',
        totalHours,
        regularHours,
        overtimeHours,
        totalCost,
        tasksCompleted,
        tasksAssigned,
        completionRate,
        averageHourlyRate: totalHours > 0 ? totalCost / totalHours : worker.hourly_rate || 0,
        productivityScore,
        checkInAccuracy,
        lastActive: lastActive || '',
        currentJob
      }
    }).sort((a, b) => b.productivityScore - a.productivityScore)

    // Calculate team productivity (grouped by team leads)
    const teamLeads = jobAssignments.filter(assignment => assignment.role === 'lead')
    const teamProductivity = teamLeads.map(lead => {
      const teamMembers = jobAssignments.filter(assignment => 
        assignment.job_id === lead.job_id && assignment.worker_id !== lead.worker_id
      )
      
      const allTeamWorkers = [lead, ...teamMembers]
      const teamWorkerIds = allTeamWorkers.map(assignment => assignment.worker_id)
      const teamMetrics = workerMetrics.filter(metric => teamWorkerIds.includes(metric.workerId))
      
      const totalHours = teamMetrics.reduce((sum, metric) => sum + metric.totalHours, 0)
      const averageCompletion = teamMetrics.length > 0 ? 
        teamMetrics.reduce((sum, metric) => sum + metric.completionRate, 0) / teamMetrics.length : 0
      const averageProductivity = teamMetrics.length > 0 ? 
        teamMetrics.reduce((sum, metric) => sum + metric.productivityScore, 0) / teamMetrics.length : 0

      return {
        teamLead: lead.worker ? `${lead.worker.first_name} ${lead.worker.last_name}` : 'Unknown',
        teamMembers: teamMembers.length + 1, // +1 for the lead
        totalHours,
        completionRate: averageCompletion,
        averageProductivity
      }
    })

    // Calculate time tracking insights
    const checkInPatterns = []
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    for (let i = 0; i < 7; i++) {
      const dayCheckIns = checkIns.filter(checkIn => {
        const checkInDate = new Date(checkIn.check_in_time)
        return checkInDate.getDay() === i
      })

      if (dayCheckIns.length > 0) {
        const avgCheckInTime = dayCheckIns.reduce((sum, checkIn) => {
          const time = new Date(checkIn.check_in_time)
          return sum + (time.getHours() * 60 + time.getMinutes())
        }, 0) / dayCheckIns.length

        const avgCheckOutTime = dayCheckIns
          .filter(checkIn => checkIn.check_out_time)
          .reduce((sum, checkIn) => {
            const time = new Date(checkIn.check_out_time!)
            return sum + (time.getHours() * 60 + time.getMinutes())
          }, 0) / dayCheckIns.filter(checkIn => checkIn.check_out_time).length

        const totalHours = dayCheckIns.reduce((sum, checkIn) => {
          if (checkIn.check_out_time) {
            const checkIn_time = new Date(checkIn.check_in_time).getTime()
            const checkOut_time = new Date(checkIn.check_out_time).getTime()
            return sum + ((checkOut_time - checkIn_time) / (1000 * 60 * 60))
          }
          return sum
        }, 0)

        checkInPatterns.push({
          day: daysOfWeek[i],
          averageCheckInTime: `${Math.floor(avgCheckInTime / 60)}:${(avgCheckInTime % 60).toString().padStart(2, '0')}`,
          averageCheckOutTime: isNaN(avgCheckOutTime) ? 'N/A' : `${Math.floor(avgCheckOutTime / 60)}:${(avgCheckOutTime % 60).toString().padStart(2, '0')}`,
          totalHours
        })
      }
    }

    // Location accuracy by worker
    const locationAccuracy = workers.map(worker => {
      const workerCheckIns = checkIns.filter(checkIn => checkIn.worker_id === worker.id)
      const accurateCheckIns = workerCheckIns.filter(checkIn => checkIn.location_verified).length
      
      return {
        workerId: worker.id,
        workerName: `${worker.first_name} ${worker.last_name}`,
        totalCheckIns: workerCheckIns.length,
        accurateCheckIns,
        accuracyRate: workerCheckIns.length > 0 ? (accurateCheckIns / workerCheckIns.length) * 100 : 0
      }
    }).filter(worker => worker.totalCheckIns > 0)
      .sort((a, b) => b.accuracyRate - a.accuracyRate)

    // Weekly efficiency trends
    const efficiencyTrends = []
    const now = new Date()
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      const weekTimeEntries = timeEntries.filter(entry => {
        const entryDate = new Date(entry.start_time)
        return entryDate >= weekStart && entryDate <= weekEnd
      })

      const weekTasks = tasks.filter(task => {
        const taskDate = new Date(task.updated_at)
        return taskDate >= weekStart && taskDate <= weekEnd && task.status === 'completed'
      })

      const hoursWorked = weekTimeEntries.reduce((sum, entry) => sum + ((entry.duration_minutes || 0) / 60), 0)
      const tasksCompleted = weekTasks.length
      const efficiency = hoursWorked > 0 ? tasksCompleted / hoursWorked : 0

      efficiencyTrends.push({
        week: `Week ${i + 1}`,
        hoursWorked,
        tasksCompleted,
        efficiency
      })
    }

    // Calculate overview metrics
    const totalHoursWorked = workerMetrics.reduce((sum, worker) => sum + worker.totalHours, 0)
    const averageHoursPerWorker = workers.length > 0 ? totalHoursWorked / workers.length : 0
    const totalOvertimeHours = workerMetrics.reduce((sum, worker) => sum + worker.overtimeHours, 0)
    const overtimePercentage = totalHoursWorked > 0 ? (totalOvertimeHours / totalHoursWorked) * 100 : 0
    const averageProductivityScore = workerMetrics.length > 0 ? 
      workerMetrics.reduce((sum, worker) => sum + worker.productivityScore, 0) / workerMetrics.length : 0
    const totalTasksCompleted = workerMetrics.reduce((sum, worker) => sum + worker.tasksCompleted, 0)
    const totalTasksAssigned = workerMetrics.reduce((sum, worker) => sum + worker.tasksAssigned, 0)
    const taskCompletionRate = totalTasksAssigned > 0 ? (totalTasksCompleted / totalTasksAssigned) * 100 : 0

    const productivityData: ProductivityMetrics = {
      overview: {
        totalWorkers: workers.length,
        averageProductivityScore,
        totalHoursWorked,
        averageHoursPerWorker,
        overtimePercentage,
        taskCompletionRate
      },
      workerMetrics,
      teamProductivity,
      timeTrackingInsights: {
        checkInPatterns,
        locationAccuracy,
        efficiencyTrends
      }
    }

    return NextResponse.json(productivityData)

  } catch (error) {
    console.error('Productivity analytics error:', error)
    return NextResponse.json({
      error: 'Failed to fetch productivity analytics data'
    }, { status: 500 })
  }
}