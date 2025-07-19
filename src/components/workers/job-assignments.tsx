'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JobAssignment, Worker } from '@/lib/types'
import { 
  Plus, 
  UserMinus, 
  User, 
  Mail, 
  Phone,
  AlertTriangle,
  Settings,
  Edit
} from 'lucide-react'
import Link from 'next/link'
import AssignWorkerForm from './assign-worker-form'

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

const assignmentStatusConfig = {
  active: {
    label: 'Active',
    color: 'bg-green-50 text-green-700 border-green-200'
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  removed: {
    label: 'Removed',
    color: 'bg-red-50 text-red-700 border-red-200'
  }
}

interface JobAssignmentsProps {
  jobId: string
  canEdit: boolean
}

export default function JobAssignments({ jobId, canEdit }: JobAssignmentsProps) {
  const { user } = useAuthStore()
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<JobAssignment | null>(null)

  useEffect(() => {
    if (jobId) {
      fetchAssignments()
    }
  }, [jobId])

  const fetchAssignments = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching job assignments for job:', jobId)

      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          *,
          worker:workers!job_assignments_worker_id_fkey(
            id,
            employee_id,
            phone,
            user:users!workers_user_id_fkey(
              full_name,
              email,
              role
            )
          ),
          assigned_by_user:users!job_assignments_assigned_by_fkey(
            full_name,
            email
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching job assignments:', error)
        setError('Failed to load team assignments')
        return
      }

      console.log('✅ Job assignments loaded:', data)
      setAssignments(data || [])
    } catch (err) {
      console.error('❌ Exception fetching job assignments:', err)
      setError('Failed to load team assignments')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditAssignment = (assignment: JobAssignment) => {
    setEditingAssignment(assignment)
    setShowAssignForm(true)
  }

  const handleUpdateAssignment = async (assignmentId: string, newRole: string) => {
    try {
      console.log('🔄 Updating assignment role:', assignmentId, newRole)

      const { error } = await supabase
        .from('job_assignments')
        .update({ role: newRole })
        .eq('id', assignmentId)

      if (error) {
        console.error('❌ Error updating assignment:', error)
        setError(`Failed to update assignment: ${error.message}`)
        return
      }

      console.log('✅ Assignment updated successfully')
      fetchAssignments() // Refresh the list
      setEditingAssignment(null)
      setShowAssignForm(false)
      
    } catch (err) {
      console.error('❌ Exception updating assignment:', err)
      setError('Failed to update assignment')
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId)
    const workerName = assignment?.worker?.user?.full_name || 'this worker'
    
    if (!confirm(`Are you sure you want to remove ${workerName} from this job?`)) {
      return
    }

    try {
      console.log('🔄 Removing job assignment:', assignmentId)

      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) {
        console.error('❌ Error removing assignment:', error)
        return
      }

      console.log('✅ Assignment removed')
      fetchAssignments()
    } catch (err) {
      console.error('❌ Exception removing assignment:', err)
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

  // Since our current schema doesn't have status, treat all as active for now
  const activeAssignments = assignments
  const completedAssignments: JobAssignment[] = []

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Assignments</CardTitle>
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
      {showAssignForm && (
        <AssignWorkerForm
          jobId={jobId}
          editingAssignment={editingAssignment}
          onAssignmentCreated={() => {
            setShowAssignForm(false)
            setEditingAssignment(null)
            fetchAssignments()
          }}
          onCancel={() => {
            setShowAssignForm(false)
            setEditingAssignment(null)
          }}
          existingAssignments={activeAssignments}
        />
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Assignments</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Workers assigned to this job
              </p>
            </div>
            {canEdit && !showAssignForm && (
              <Button 
                size="sm"
                onClick={() => setShowAssignForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Assign Worker
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

          {/* Active Assignments */}
          {activeAssignments.length > 0 && (
            <div className="space-y-3 mb-6">
              <h4 className="font-medium text-gray-900">Active Team Members ({activeAssignments.length})</h4>
              <div className="space-y-3">
                {activeAssignments.map(assignment => {
                  const roleInfo = assignmentRoleConfig[assignment.role || 'worker']
                  const statusInfo = assignmentStatusConfig[assignment.status || 'active']
                  
                  return (
                    <div key={assignment.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <Link 
                                href={`/dashboard/workers/${assignment.worker?.id}`}
                                className="font-medium text-blue-600 hover:text-blue-800"
                              >
                                {assignment.worker?.user?.full_name || 'Unknown Worker'}
                              </Link>
                              
                              <Badge variant="outline" className={roleInfo.color}>
                                {roleInfo.label}
                              </Badge>
                              
                              <Badge variant="outline" className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-sm text-gray-600">
                              {assignment.worker?.user?.email && (
                                <div className="flex items-center">
                                  <Mail className="h-3 w-3 mr-2" />
                                  {assignment.worker.user.email}
                                </div>
                              )}
                              
                              {assignment.worker?.phone && (
                                <div className="flex items-center">
                                  <Phone className="h-3 w-3 mr-2" />
                                  {assignment.worker.phone}
                                </div>
                              )}
                              
                              <div className="flex items-center space-x-4 text-xs">
                                <span>Assigned: {formatDate(assignment.assigned_date)}</span>
                                {assignment.start_date && (
                                  <span>Start: {formatDate(assignment.start_date)}</span>
                                )}
                                {assignment.assigned_by_user && (
                                  <span>By: {assignment.assigned_by_user.full_name}</span>
                                )}
                              </div>
                            </div>
                            
                            {assignment.notes && (
                              <p className="text-sm text-gray-600 mt-2 italic">
                                {assignment.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAssignment(assignment)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveAssignment(assignment.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Completed/Removed Assignments */}
          {completedAssignments.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-medium text-gray-900">Past Assignments ({completedAssignments.length})</h4>
              <div className="space-y-2">
                {completedAssignments.map(assignment => {
                  const roleInfo = assignmentRoleConfig[assignment.role || 'worker']
                  const statusInfo = assignmentStatusConfig[assignment.status || 'completed']
                  
                  return (
                    <div key={assignment.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-700">
                                {assignment.worker?.user?.full_name || 'Unknown Worker'}
                              </span>
                              
                              <Badge variant="outline" className={roleInfo.color}>
                                {roleInfo.label}
                              </Badge>
                              
                              <Badge variant="outline" className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(assignment.assigned_date)} - {formatDate(assignment.end_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {assignments.length === 0 && (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Team Members Assigned</h3>
              <p className="text-gray-600 mb-4">
                Assign workers to this job to start tracking team progress.
              </p>
              {canEdit && !showAssignForm && (
                <Button onClick={() => setShowAssignForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign First Worker
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}