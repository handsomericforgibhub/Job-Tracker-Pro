import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch dashboard analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const user_role = searchParams.get('role')

    if (!company_id || !user_role) {
      return NextResponse.json({ error: 'Missing company_id or role' }, { status: 400 })
    }

    // Prepare analytics data based on role
    const analytics = {
      stats: [],
      recent_activity: []
    }

    if (user_role === 'owner') {
      // Owner Analytics
      
      // 1. Active Jobs Count
      const { data: activeJobs, error: activeJobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', company_id)
        .in('status', ['active', 'planning'])

      // 2. Total Workers Count  
      const { data: totalWorkers, error: workersError } = await supabase
        .from('workers')
        .select('id')
        .eq('company_id', company_id)
        .eq('employment_status', 'active')

      // 3. Revenue YTD (sum of job budgets for completed jobs this year)
      const currentYear = new Date().getFullYear()
      const { data: completedJobs, error: revenueError } = await supabase
        .from('jobs')
        .select('budget')
        .eq('company_id', company_id)
        .eq('status', 'completed')
        .gte('end_date', `${currentYear}-01-01`)

      // 4. Total labor costs this month from time tracking
      const currentMonth = new Date()
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const { data: timeCosts, error: costsError } = await supabase
        .from('time_entries')
        .select('total_cost')
        .eq('company_id', company_id)
        .eq('status', 'approved')
        .gte('start_time', firstDayOfMonth.toISOString())

      // Calculate values
      const activeJobsCount = activeJobs?.length || 0
      const totalWorkersCount = totalWorkers?.length || 0
      const revenueYTD = completedJobs?.reduce((sum, job) => sum + (job.budget || 0), 0) || 0
      const laborCostsMonth = timeCosts?.reduce((sum, entry) => sum + (entry.total_cost || 0), 0) || 0

      analytics.stats = [
        { 
          title: 'Active Jobs', 
          value: activeJobsCount.toString(), 
          icon: 'Briefcase', 
          change: `${activeJobsCount} in progress` 
        },
        { 
          title: 'Total Workers', 
          value: totalWorkersCount.toString(), 
          icon: 'Users', 
          change: `${totalWorkersCount} active` 
        },
        { 
          title: 'Revenue YTD', 
          value: `$${(revenueYTD / 1000).toFixed(1)}K`, 
          icon: 'DollarSign', 
          change: `From ${completedJobs?.length || 0} completed jobs` 
        },
        { 
          title: 'Labor Costs (Month)', 
          value: `$${(laborCostsMonth / 1000).toFixed(1)}K`, 
          icon: 'TrendingUp', 
          change: `This month` 
        },
      ]

    } else if (user_role === 'foreman') {
      // Foreman Analytics
      
      // 1. Assigned Jobs
      const { data: assignedJobs, error: jobsError } = await supabase
        .from('job_assignments')
        .select('job_id, jobs!inner(*)')
        .eq('jobs.company_id', company_id)
        .in('jobs.status', ['active', 'planning'])

      // 2. Team Members under supervision
      const { data: teamMembers, error: teamError } = await supabase
        .from('workers')
        .select('id')
        .eq('company_id', company_id)
        .eq('employment_status', 'active')

      // 3. Tasks Completed This Week
      const startOfWeek = new Date()
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const { data: completedTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, jobs!inner(company_id)')
        .eq('jobs.company_id', company_id)
        .eq('status', 'completed')
        .gte('updated_at', startOfWeek.toISOString())

      const { data: totalTasks, error: totalTasksError } = await supabase
        .from('tasks')
        .select('id, jobs!inner(company_id)')
        .eq('jobs.company_id', company_id)
        .in('status', ['completed', 'in_progress', 'pending'])

      // 4. Time entries pending approval
      const { data: pendingApprovals, error: approvalsError } = await supabase
        .from('time_entries')
        .select('id')
        .eq('company_id', company_id)
        .eq('status', 'pending')

      const assignedJobsCount = assignedJobs?.length || 0
      const teamMembersCount = teamMembers?.length || 0
      const completedTasksCount = completedTasks?.length || 0
      const totalTasksCount = totalTasks?.length || 0
      const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0
      const pendingApprovalsCount = pendingApprovals?.length || 0

      analytics.stats = [
        { 
          title: 'Assigned Jobs', 
          value: assignedJobsCount.toString(), 
          icon: 'Briefcase', 
          change: `${assignedJobsCount} active` 
        },
        { 
          title: 'Team Members', 
          value: teamMembersCount.toString(), 
          icon: 'Users', 
          change: `${pendingApprovalsCount} pending approvals` 
        },
        { 
          title: 'Tasks Completed', 
          value: `${completionRate}%`, 
          icon: 'CheckCircle', 
          change: `${completedTasksCount} this week` 
        },
        { 
          title: 'Pending Approvals', 
          value: pendingApprovalsCount.toString(), 
          icon: 'AlertCircle', 
          change: 'Time entries' 
        },
      ]

    } else if (user_role === 'worker') {
      // Worker Analytics
      
      // Get worker info
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id, job_assignments(job_id, jobs(title))')
        .eq('company_id', company_id)
        .single()

      // 1. Current Job Assignment
      const currentJob = workerData?.job_assignments?.[0]?.jobs?.title || 'No assignment'

      // 2. Hours This Week
      const startOfWeek = new Date()
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const { data: weeklyHours, error: hoursError } = await supabase
        .from('time_entries')
        .select('duration_minutes')
        .eq('company_id', company_id)
        .eq('worker_id', workerData?.id)
        .gte('start_time', startOfWeek.toISOString())

      // 3. Tasks Completed
      const { data: myCompletedTasks, error: myTasksError } = await supabase
        .from('task_assignments')
        .select('task_id, tasks!inner(status, jobs!inner(company_id))')
        .eq('tasks.jobs.company_id', company_id)
        .eq('worker_id', workerData?.id)
        .eq('tasks.status', 'completed')

      const { data: myPendingTasks, error: pendingTasksError } = await supabase
        .from('task_assignments')
        .select('task_id, tasks!inner(status, jobs!inner(company_id))')
        .eq('tasks.jobs.company_id', company_id)
        .eq('worker_id', workerData?.id)
        .in('tasks.status', ['pending', 'in_progress'])

      // 4. Next Check-in (placeholder - could be enhanced with scheduling)
      
      const totalWeeklyMinutes = weeklyHours?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0
      const weeklyHoursFormatted = (totalWeeklyMinutes / 60).toFixed(1)
      const completedTasksCount = myCompletedTasks?.length || 0
      const pendingTasksCount = myPendingTasks?.length || 0

      analytics.stats = [
        { 
          title: 'Current Job', 
          value: currentJob, 
          icon: 'Briefcase', 
          change: 'Active assignment' 
        },
        { 
          title: 'Hours This Week', 
          value: weeklyHoursFormatted, 
          icon: 'Clock', 
          change: `${totalWeeklyMinutes / 60 > 40 ? 'Overtime' : 'Regular'} hours` 
        },
        { 
          title: 'Tasks Completed', 
          value: completedTasksCount.toString(), 
          icon: 'CheckCircle', 
          change: `${pendingTasksCount} pending` 
        },
        { 
          title: 'Status', 
          value: 'Active', 
          icon: 'Calendar', 
          change: 'On schedule' 
        },
      ]
    }

    // Get comprehensive recent activity from multiple sources
    const activityPromises = [
      // Recent job updates
      supabase
        .from('jobs')
        .select('title, status, updated_at, users!jobs_created_by_fkey(full_name)')
        .eq('company_id', company_id)
        .order('updated_at', { ascending: false })
        .limit(3),
      
      // Recent task completions
      supabase
        .from('tasks')
        .select(`
          title, status, updated_at, created_by,
          users!tasks_created_by_fkey(full_name),
          jobs!inner(company_id, title)
        `)
        .eq('jobs.company_id', company_id)
        .in('status', ['completed', 'in_progress'])
        .order('updated_at', { ascending: false })
        .limit(3),
      
      // Recent worker check-ins
      supabase
        .from('worker_check_ins')
        .select(`
          check_in_time, check_out_time, created_at,
          workers!inner(users(full_name), company_id),
          jobs(title)
        `)
        .eq('workers.company_id', company_id)
        .order('created_at', { ascending: false })
        .limit(2),
      
      // Recent document uploads
      supabase
        .from('documents')
        .select(`
          title, created_at,
          uploaded_by_user:users!documents_uploaded_by_fkey(full_name),
          jobs(title, company_id)
        `)
        .eq('jobs.company_id', company_id)
        .order('created_at', { ascending: false })
        .limit(2)
    ]

    const [jobsRes, tasksRes, checkInsRes, docsRes] = await Promise.all(activityPromises)

    // Combine and format all activities
    const allActivities = []

    // Job activities
    if (jobsRes.data) {
      jobsRes.data.forEach(job => {
        allActivities.push({
          time: new Date(job.updated_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          activity: `Job ${job.status}: ${job.title}`,
          user: job.users?.full_name || 'System',
          status: job.status,
          timestamp: new Date(job.updated_at).getTime()
        })
      })
    }

    // Task activities
    if (tasksRes.data) {
      tasksRes.data.forEach(task => {
        allActivities.push({
          time: new Date(task.updated_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          activity: `Task ${task.status}: ${task.title} (${task.jobs?.title})`,
          user: task.users?.full_name || 'System',
          status: task.status,
          timestamp: new Date(task.updated_at).getTime()
        })
      })
    }

    // Check-in activities
    if (checkInsRes.data) {
      checkInsRes.data.forEach(checkIn => {
        const isCheckOut = checkIn.check_out_time
        allActivities.push({
          time: new Date(checkIn.created_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          activity: `Worker ${isCheckOut ? 'checked out from' : 'checked in to'} ${checkIn.jobs?.title || 'job site'}`,
          user: checkIn.workers?.users?.full_name || 'Worker',
          status: isCheckOut ? 'completed' : 'active',
          timestamp: new Date(checkIn.created_at).getTime()
        })
      })
    }

    // Document activities
    if (docsRes.data) {
      docsRes.data.forEach(doc => {
        allActivities.push({
          time: new Date(doc.created_at).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }),
          activity: `Document uploaded: ${doc.title}`,
          user: doc.uploaded_by_user?.full_name || 'User',
          status: 'completed',
          timestamp: new Date(doc.created_at).getTime()
        })
      })
    }

    // Sort all activities by timestamp (most recent first) and take top 8
    analytics.recent_activity = allActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8)
      .map(({ timestamp, ...activity }) => activity)

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({
      error: 'Failed to fetch analytics data'
    }, { status: 500 })
  }
}