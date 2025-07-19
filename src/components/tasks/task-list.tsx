'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Task } from '@/lib/types'
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Ban,
  User,
  Calendar,
  MoreHorizontal,
  Edit,
  Trash2,
  Users
} from 'lucide-react'
import AddTaskForm from './add-task-form'
import EditTaskForm from './edit-task-form'
import TaskAssignmentManager from './task-assignment-manager'

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Circle,
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  todo: {
    label: 'To Do',
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
  },
  blocked: {
    label: 'Blocked',
    icon: AlertTriangle,
    color: 'bg-red-50 text-red-700 border-red-200'
  }
}

const priorityConfig = {
  low: {
    label: 'Low',
    color: 'bg-gray-50 text-gray-600 border-gray-200'
  },
  medium: {
    label: 'Medium',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  },
  high: {
    label: 'High',
    color: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  urgent: {
    label: 'Urgent',
    color: 'bg-red-50 text-red-700 border-red-200'
  }
}

interface TaskListProps {
  jobId: string
  canEdit: boolean
}

export default function TaskList({ jobId, canEdit }: TaskListProps) {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [managingAssignments, setManagingAssignments] = useState<Task | null>(null)

  useEffect(() => {
    if (jobId) {
      fetchTasks()
    }
  }, [jobId])

  const fetchTasks = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      if (!jobId) {
        console.error('❌ No jobId provided')
        setError('No job ID provided')
        return
      }
      
      console.log('🔄 Fetching tasks for job:', jobId)

      // Test basic connection first
      console.log('🔄 Testing Supabase connection...')
      const { data: testData, error: testError } = await supabase
        .from('tasks')
        .select('count', { count: 'exact', head: true })

      if (testError) {
        console.error('❌ Supabase connection test failed:', testError)
        setError(`Database connection failed: ${testError.message}`)
        return
      }

      console.log('✅ Supabase connection working, total tasks:', testData)

      // Start with basic query that should always work
      console.log('🔄 Using basic task query for job:', jobId)
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('job_id', jobId)
        .is('parent_task_id', null)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Error fetching tasks:', error)
        console.error('❌ Error details:', JSON.stringify(error, null, 2))
        setError(`Failed to load tasks: ${error.message}`)
        return
      }

      console.log('✅ Basic tasks loaded:', data?.length || 0)

      // Now try to add user information if possible
      let tasksWithUsers = data || []
      if (data && data.length > 0) {
        try {
          const { data: tasksWithUserData, error: userError } = await supabase
            .from('tasks')
            .select(`
              *,
              assigned_user:users(full_name, email)
            `)
            .eq('job_id', jobId)
            .is('parent_task_id', null)
            .order('created_at', { ascending: true })

          if (!userError && tasksWithUserData) {
            tasksWithUsers = tasksWithUserData
            console.log('✅ Tasks with user data loaded')
          } else {
            console.log('⚠️ Could not load user data, using basic tasks:', userError?.message)
          }
        } catch (userErr) {
          console.log('⚠️ User data query failed, using basic tasks:', userErr)
        }
      }

      // Fetch subtasks for each main task
      if (tasksWithUsers && tasksWithUsers.length > 0) {
        const tasksWithSubtasks = await Promise.all(
          tasksWithUsers.map(async (task) => {
            try {
              const { data: subtasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('parent_task_id', task.id)
                .order('created_at', { ascending: true })

              return {
                ...task,
                subtasks: subtasks || []
              }
            } catch (subtaskErr) {
              console.log('⚠️ Could not load subtasks for task:', task.id, subtaskErr)
              return {
                ...task,
                subtasks: []
              }
            }
          })
        )
        setTasks(tasksWithSubtasks)
      } else {
        setTasks(tasksWithUsers || [])
      }

      console.log('✅ Tasks loaded:', tasksWithUsers?.length || 0)
      
      // Try to load task assignments if the table exists
      await loadTaskAssignments(tasksWithUsers || [])
      
    } catch (err) {
      console.error('❌ Exception fetching tasks:', err)
      setError('Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTaskAssignments = async (tasksData: Task[]) => {
    try {
      console.log('🔄 Attempting to load task assignments...')
      
      if (!tasksData.length) return

      // Try to fetch task assignments for all tasks
      const taskIds = tasksData.flatMap(task => [
        task.id,
        ...(task.subtasks?.map(subtask => subtask.id) || [])
      ])

      const { data: assignments, error } = await supabase
        .from('task_assignments')
        .select(`
          id,
          task_id,
          worker_id,
          assigned_date,
          assigned_by,
          created_at,
          worker:workers(
            id,
            employee_id,
            user:users(full_name, email, role)
          ),
          assigned_by_user:users(full_name, email)
        `)
        .in('task_id', taskIds)

      if (error) {
        console.log('ℹ️ Task assignments table not available or empty:', error.message)
        return
      }

      if (assignments && assignments.length > 0) {
        console.log('✅ Task assignments loaded:', assignments.length)
        
        // Update tasks with their assignments
        const updatedTasks = tasksData.map(task => ({
          ...task,
          taskAssignments: assignments.filter(a => a.task_id === task.id),
          subtasks: task.subtasks?.map(subtask => ({
            ...subtask,
            taskAssignments: assignments.filter(a => a.task_id === subtask.id)
          }))
        }))
        
        setTasks(updatedTasks)
      } else {
        console.log('ℹ️ No task assignments found')
      }
    } catch (err) {
      console.log('ℹ️ Task assignments not available:', err)
      // This is expected if the table doesn't exist, so we don't show an error
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      console.log('🔄 Updating task status:', taskId, newStatus)

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (error) {
        console.error('❌ Error updating task status:', error)
        return
      }

      // Update local state
      setTasks(prevTasks => 
        prevTasks.map(task => {
          if (task.id === taskId) {
            return { ...task, status: newStatus }
          }
          // Check subtasks
          if (task.subtasks) {
            return {
              ...task,
              subtasks: task.subtasks.map(subtask =>
                subtask.id === taskId ? { ...subtask, status: newStatus } : subtask
              )
            }
          }
          return task
        })
      )

      console.log('✅ Task status updated')
    } catch (err) {
      console.error('❌ Exception updating task status:', err)
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const canUpdateTask = (task: Task) => {
    if (!user) return false
    // Owners and foremen can update any task
    if (user.role === 'owner' || user.role === 'foreman') return true
    // Workers can update tasks assigned to them (check both legacy and new assignments)
    if (task.assigned_to === user.id) return true
    // Check if user is assigned via task_assignments
    if (task.taskAssignments && task.taskAssignments.length > 0) {
      return task.taskAssignments.some(assignment => 
        assignment.worker?.user_id === user.id
      )
    }
    return false
  }

  const TaskItem = ({ task, isSubtask = false }: { task: Task; isSubtask?: boolean }) => {
    const statusInfo = statusConfig[task.status] || statusConfig.pending
    const priorityInfo = priorityConfig[task.priority] || priorityConfig.medium
    const StatusIcon = statusInfo.icon

    // Debug log if status is not recognized
    if (!statusConfig[task.status]) {
      console.warn('⚠️ Unknown task status:', task.status, 'for task:', task.title)
    }
    if (!priorityConfig[task.priority]) {
      console.warn('⚠️ Unknown task priority:', task.priority, 'for task:', task.title)
    }

    return (
      <div className={`border rounded-lg p-4 ${isSubtask ? 'ml-6 border-l-4 border-l-blue-200' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Status Icon/Checkbox */}
            <button
              onClick={() => {
                if (canUpdateTask(task)) {
                  const newStatus = task.status === 'completed' ? 'pending' : 'completed'
                  updateTaskStatus(task.id, newStatus)
                }
              }}
              disabled={!canUpdateTask(task)}
              className={`mt-1 ${canUpdateTask(task) ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50'} transition-transform`}
            >
              <StatusIcon 
                className={`h-5 w-5 ${
                  task.status === 'completed' 
                    ? 'text-green-600' 
                    : task.status === 'in_progress' 
                    ? 'text-blue-600' 
                    : task.status === 'cancelled'
                    ? 'text-red-600'
                    : 'text-gray-400'
                }`} 
              />
            </button>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                  {task.title}
                </h4>
                
                <Badge variant="outline" className={statusInfo.color}>
                  {statusInfo.label}
                </Badge>
                
                <Badge variant="outline" className={priorityInfo.color}>
                  {priorityInfo.label}
                </Badge>
              </div>

              {task.description && (
                <p className={`text-sm mb-2 ${task.status === 'completed' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {task.description}
                </p>
              )}

              {/* Task Metadata */}
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {/* Show multiple assigned workers */}
                {task.taskAssignments && task.taskAssignments.length > 0 ? (
                  <div className="flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    <span>
                      {task.taskAssignments.map(assignment => 
                        assignment.worker?.user?.full_name || 'Unknown'
                      ).join(', ')}
                      {task.taskAssignments.length > 1 && (
                        <span className="ml-1 text-blue-600 font-medium">
                          ({task.taskAssignments.length} workers)
                        </span>
                      )}
                    </span>
                  </div>
                ) : task.assigned_user ? (
                  <div className="flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {task.assigned_user.full_name} (legacy)
                  </div>
                ) : (
                  <div className="flex items-center text-orange-600">
                    <User className="h-3 w-3 mr-1" />
                    Unassigned
                  </div>
                )}
                
                {task.due_date && (
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(task.due_date)}
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

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 ml-2">
              <button 
                onClick={() => setManagingAssignments(task)}
                className="text-gray-400 hover:text-blue-600"
                title="Manage worker assignments"
              >
                <Users className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setEditingTask(task)}
                className="text-gray-400 hover:text-gray-600"
                title="Edit task"
              >
                <Edit className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-4 space-y-2">
            {task.subtasks.map(subtask => (
              <TaskItem key={subtask.id} task={subtask} isSubtask={true} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {showAddTask && (
        <AddTaskForm
          jobId={jobId}
          onTaskCreated={() => {
            setShowAddTask(false)
            fetchTasks()
          }}
          onCancel={() => setShowAddTask(false)}
        />
      )}
      
      {editingTask && (
        <EditTaskForm
          task={editingTask}
          onTaskUpdated={() => {
            setEditingTask(null)
            fetchTasks()
          }}
          onTaskDeleted={() => {
            setEditingTask(null)
            fetchTasks()
          }}
          onCancel={() => setEditingTask(null)}
        />
      )}
      
      {managingAssignments && (
        <TaskAssignmentManager
          task={managingAssignments}
          jobId={jobId}
          onAssignmentsUpdated={() => {
            fetchTasks()
          }}
          onClose={() => setManagingAssignments(null)}
        />
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            {canEdit && !showAddTask && (
              <Button 
                size="sm"
                onClick={() => setShowAddTask(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Tasks Yet</h3>
            <p className="text-gray-600 mb-4">
              Break down this job into manageable tasks to track progress.
            </p>
            {canEdit && !showAddTask && (
              <Button onClick={() => setShowAddTask(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
        </CardContent>
      </Card>
    </>
  )
}