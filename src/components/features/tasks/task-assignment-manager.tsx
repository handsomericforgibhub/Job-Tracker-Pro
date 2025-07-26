'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Task, Worker, TaskAssignment } from '@/lib/types'
import { 
  X, 
  Plus, 
  User, 
  Trash2, 
  Users,
  Calendar,
  AlertTriangle 
} from 'lucide-react'

interface TaskAssignmentManagerProps {
  task: Task
  jobId: string
  onAssignmentsUpdated: () => void
  onClose: () => void
}

export default function TaskAssignmentManager({ 
  task, 
  jobId, 
  onAssignmentsUpdated, 
  onClose 
}: TaskAssignmentManagerProps) {
  const { user, company } = useAuthStore()
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (company) {
      fetchAvailableWorkers()
    }
  }, [company])

  const fetchAvailableWorkers = async () => {
    try {
      console.log('🔄 Fetching available workers for task assignment...')

      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          user:users!workers_user_id_fkey(
            full_name,
            email,
            role
          )
        `)
        .eq('company_id', company?.id)
        .eq('employment_status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching workers:', error)
        setError('Failed to load available workers')
        return
      }

      console.log('✅ Available workers loaded:', data?.length)
      setAvailableWorkers(data || [])
    } catch (err) {
      console.error('❌ Exception fetching workers:', err)
      setError('Failed to load available workers')
    }
  }

  const handleAssignWorker = async () => {
    if (!selectedWorkerId || !user) {
      setError('Please select a worker to assign')
      return
    }

    // Check if worker is already assigned
    const isAlreadyAssigned = task.taskAssignments?.some(
      assignment => assignment.worker_id === selectedWorkerId
    )

    if (isAlreadyAssigned) {
      setError('This worker is already assigned to this task')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      console.log('🔄 Assigning worker to task...')

      const assignmentData = {
        task_id: task.id,
        worker_id: selectedWorkerId,
        assigned_date: new Date().toISOString().split('T')[0],
        assigned_by: user.id
      }

      console.log('📝 Assignment data:', assignmentData)

      const { error } = await supabase
        .from('task_assignments')
        .insert(assignmentData)

      if (error) {
        console.error('❌ Error creating task assignment:', error)
        if (error.message.includes('relation "task_assignments" does not exist')) {
          setError('Multi-worker assignments not available. Please run the database script 09-multi-worker-task-assignments.sql first.')
        } else {
          setError(`Failed to assign worker: ${error.message}`)
        }
        return
      }

      console.log('✅ Worker assigned to task successfully')
      setSelectedWorkerId('')
      onAssignmentsUpdated()
      
    } catch (err) {
      console.error('❌ Exception creating task assignment:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      console.log('🔄 Removing task assignment...')

      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) {
        console.error('❌ Error removing task assignment:', error)
        if (error.message.includes('relation "task_assignments" does not exist')) {
          setError('Multi-worker assignments not available. Please run the database script 09-multi-worker-task-assignments.sql first.')
        } else {
          setError(`Failed to remove assignment: ${error.message}`)
        }
        return
      }

      console.log('✅ Task assignment removed successfully')
      onAssignmentsUpdated()
      
    } catch (err) {
      console.error('❌ Exception removing task assignment:', err)
      setError('An unexpected error occurred')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getUnassignedWorkers = () => {
    const assignedWorkerIds = task.taskAssignments?.map(a => a.worker_id) || []
    return availableWorkers.filter(worker => 
      !assignedWorkerIds.includes(worker.id)
    )
  }

  const unassignedWorkers = getUnassignedWorkers()

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Manage Task Assignments
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-600">
          Task: <span className="font-medium">{task.title}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Current Assignments */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Current Assignments ({task.taskAssignments?.length || 0})
          </h3>
          
          {task.taskAssignments && task.taskAssignments.length > 0 ? (
            <div className="space-y-2">
              {task.taskAssignments.map(assignment => (
                <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {assignment.worker?.user?.full_name || 'Unknown Name'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Assigned {formatDate(assignment.assigned_date)}
                        {assignment.assigned_by_user && 
                          ` by ${assignment.assigned_by_user.full_name}`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveAssignment(assignment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No workers assigned to this task</p>
            </div>
          )}
        </div>

        {/* Add New Assignment */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Assign Additional Worker
          </h3>
          
          {unassignedWorkers.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">
                All available workers are already assigned to this task
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a worker...</option>
                {unassignedWorkers.map(worker => (
                  <option key={worker.id} value={worker.id}>
                    {worker.user?.full_name || 'Unknown Name'} 
                    {worker.user?.role && ` (${worker.user.role})`}
                    {worker.employee_id && ` - ${worker.employee_id}`}
                  </option>
                ))}
              </select>
              
              <Button 
                onClick={handleAssignWorker}
                disabled={!selectedWorkerId || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Assigning...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}