'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JobAssignment, Task } from '@/lib/types'
import { 
  Briefcase, 
  CheckCircle2,
  Circle,
  Clock,
  Ban,
  Calendar,
  MapPin,
  User,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'

const assignmentRoleConfig = {
  lead: {
    label: 'Team Lead',
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  foreman: {
    label: 'Foreman',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  worker: {
    label: 'Worker',
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  specialist: {
    label: 'Specialist',
    color: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  apprentice: {
    label: 'Apprentice',
    color: 'bg-green-50 text-green-700 border-green-200'
  }
}

const jobStatusConfig = {
  planning: { 
    label: 'Planning', 
    color: 'bg-blue-50 text-blue-700 border-blue-200' 
  },
  active: { 
    label: 'Active', 
    color: 'bg-green-50 text-green-700 border-green-200' 
  },
  on_hold: { 
    label: 'On Hold', 
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200' 
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-gray-50 text-gray-700 border-gray-200' 
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-50 text-red-700 border-red-200' 
  }
}

const taskStatusConfig = {
  pending: {
    label: 'Pending',
    icon: Circle,
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'bg-green-50 text-green-700 border-green-200'
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    color: 'bg-red-50 text-red-700 border-red-200'
  }
}

export default function MyWorkPage() {
  const { user, company } = useAuthStore()
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && company) {
      fetchMyWork()
    }
  }, [user, company])

  const fetchMyWork = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching work assignments for user:', user?.id)

      // First get the worker record for this user
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('id')
        .eq('user_id', user?.id)
        .eq('company_id', company?.id)
        .single()

      if (workerError) {
        console.error('❌ Error fetching worker record:', workerError)
        // User might not have a worker profile yet
        setAssignments([])
        setTasks([])
        setIsLoading(false)
        return
      }

      const workerId = workerData.id

      // Fetch job assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select(`
          *,
          job:jobs!job_assignments_job_id_fkey(
            id,
            title,
            description,
            status,
            start_date,
            end_date,
            location,
            address_components
          )
        `)
        .eq('worker_id', workerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (assignmentsError) {
        console.error('❌ Error fetching job assignments:', assignmentsError)
        setError('Failed to load job assignments')
        return
      }

      console.log('✅ Job assignments loaded:', assignmentsData)
      setAssignments(assignmentsData || [])

      // Fetch assigned tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          job:jobs!tasks_job_id_fkey(
            id,
            title,
            status
          )
        `)
        .eq('assigned_to', user?.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })

      if (tasksError) {
        console.error('❌ Error fetching tasks:', tasksError)
        setError('Failed to load tasks')
        return
      }

      console.log('✅ Tasks loaded:', tasksData)
      setTasks(tasksData || [])

    } catch (err) {
      console.error('❌ Exception fetching work data:', err)
      setError('Failed to load work assignments')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getFormattedAddress = (job: any) => {
    if (job?.address_components?.formatted) {
      return job.address_components.formatted
    }
    return job?.location || 'No location specified'
  }

  if (!user) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Work</h1>
        <p className="text-gray-600">Your job assignments and tasks</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Briefcase className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Circle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tasks.filter(t => t.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tasks.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Ban className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tasks.filter(t => t.status === 'cancelled').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Briefcase className="h-5 w-5 mr-2" />
              My Job Assignments
            </CardTitle>
            <CardDescription>
              Jobs you're currently assigned to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No active job assignments</p>
                <p className="text-sm text-gray-500 mt-1">
                  You'll see your job assignments here once you're assigned to projects.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map(assignment => {
                  const roleInfo = assignmentRoleConfig[assignment.role as keyof typeof assignmentRoleConfig] || assignmentRoleConfig.worker
                  const jobStatusInfo = jobStatusConfig[assignment.job?.status as keyof typeof jobStatusConfig]
                  
                  return (
                    <div key={assignment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Link 
                              href={`/dashboard/jobs/${assignment.job?.id}`}
                              className="font-medium text-blue-600 hover:text-blue-800"
                            >
                              {assignment.job?.title || 'Unknown Job'}
                            </Link>
                            <Badge variant="outline" className={roleInfo.color}>
                              {roleInfo.label}
                            </Badge>
                          </div>
                          
                          {assignment.job?.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {assignment.job.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              Assigned: {formatDate(assignment.assigned_date)}
                            </div>
                            {assignment.job?.start_date && (
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Start: {formatDate(assignment.job.start_date)}
                              </div>
                            )}
                          </div>
                          
                          {assignment.job && (
                            <div className="flex items-center mt-2 text-sm text-gray-600">
                              <MapPin className="h-3 w-3 mr-1" />
                              {getFormattedAddress(assignment.job)}
                            </div>
                          )}
                        </div>
                        
                        <Badge variant="outline" className={jobStatusInfo?.color}>
                          {jobStatusInfo?.label}
                        </Badge>
                      </div>
                      
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2" />
              My Tasks
            </CardTitle>
            <CardDescription>
              Tasks assigned to you across all jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No pending tasks</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your assigned tasks will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => {
                  const statusInfo = taskStatusConfig[task.status as keyof typeof taskStatusConfig]
                  const StatusIcon = statusInfo.icon
                  
                  return (
                    <div key={task.id} className="border rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <StatusIcon 
                          className={`h-5 w-5 mt-1 ${
                            task.status === 'completed' 
                              ? 'text-green-600' 
                              : task.status === 'in_progress' 
                              ? 'text-blue-600' 
                              : task.status === 'cancelled'
                              ? 'text-red-600'
                              : 'text-gray-400'
                          }`} 
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{task.title}</h4>
                            <Badge variant="outline" className={statusInfo.color}>
                              {statusInfo.label}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {task.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <Link 
                              href={`/dashboard/jobs/${task.job_id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Job #{task.job_id.slice(-8)}
                            </Link>
                            
                            {task.due_date && (
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                Due: {formatDate(task.due_date)}
                              </div>
                            )}
                            
                            {task.estimated_hours && (
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {task.estimated_hours}h est.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}