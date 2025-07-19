'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Worker, JobAssignment } from '@/lib/types'
import { X, Save, User } from 'lucide-react'

interface AssignWorkerFormProps {
  jobId: string
  editingAssignment?: JobAssignment | null
  onAssignmentCreated: () => void
  onCancel: () => void
  existingAssignments: JobAssignment[]
}

export default function AssignWorkerForm({ 
  jobId, 
  editingAssignment,
  onAssignmentCreated, 
  onCancel, 
  existingAssignments 
}: AssignWorkerFormProps) {
  const { user, company } = useAuthStore()
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    worker_id: editingAssignment?.worker_id || '',
    assignment_role: (editingAssignment?.role || 'worker') as 'lead' | 'foreman' | 'worker' | 'specialist' | 'apprentice'
  })

  useEffect(() => {
    if (company) {
      fetchAvailableWorkers()
    }
  }, [company])

  const fetchAvailableWorkers = async () => {
    try {
      console.log('🔄 Fetching available workers for assignment...')

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

      // Filter out workers already assigned to this job
      const assignedWorkerIds = existingAssignments
        .map(a => a.worker_id)
      
      const unassignedWorkers = (data || []).filter(worker => 
        !assignedWorkerIds.includes(worker.id)
      )

      console.log('✅ Available workers loaded:', unassignedWorkers.length)
      setAvailableWorkers(unassignedWorkers)
    } catch (err) {
      console.error('❌ Exception fetching workers:', err)
      setError('Failed to load available workers')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user || !formData.worker_id) {
      setError('Please select a worker to assign')
      return
    }

    setIsSubmitting(true)

    try {
      if (editingAssignment) {
        // Update existing assignment
        console.log('🔄 Updating assignment role...')

        const { error } = await supabase
          .from('job_assignments')
          .update({ role: formData.assignment_role })
          .eq('id', editingAssignment.id)

        if (error) {
          console.error('❌ Error updating assignment:', error)
          setError(`Failed to update assignment: ${error.message}`)
          return
        }

        console.log('✅ Assignment updated successfully')
      } else {
        // Create new assignment
        console.log('🔄 Creating job assignment...')

        const assignmentData = {
          job_id: jobId,
          worker_id: formData.worker_id,
          role: formData.assignment_role,
          assigned_date: new Date().toISOString().split('T')[0],
          assigned_by: user.id,
          created_by: user.id
        }

        console.log('📝 Assignment data:', assignmentData)

        const { error } = await supabase
          .from('job_assignments')
          .insert(assignmentData)

        if (error) {
          console.error('❌ Error creating assignment:', error)
          setError(`Failed to assign worker: ${error.message}`)
          return
        }

        console.log('✅ Worker assigned successfully')
      }
      
      onAssignmentCreated()
      
    } catch (err) {
      console.error('❌ Exception creating assignment:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {editingAssignment ? 'Edit Assignment' : 'Assign Worker to Job'}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {availableWorkers.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No available workers to assign</p>
              <p className="text-sm text-gray-500 mt-1">
                All active workers are already assigned to this job or there are no active workers.
              </p>
            </div>
          ) : (
            <>
              {/* Worker Selection */}
              <div>
                <label htmlFor="worker_id" className="block text-sm font-medium text-gray-700 mb-2">
                  {editingAssignment ? 'Worker' : 'Select Worker *'}
                </label>
                {editingAssignment ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    {editingAssignment.worker?.user?.full_name || 'Unknown Name'}
                    {editingAssignment.worker?.employee_id && ` - ${editingAssignment.worker.employee_id}`}
                  </div>
                ) : (
                  <select
                    id="worker_id"
                    value={formData.worker_id}
                    onChange={(e) => handleInputChange('worker_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Choose a worker...</option>
                    {availableWorkers.map(worker => (
                      <option key={worker.id} value={worker.id}>
                        {worker.user?.full_name || 'Unknown Name'} 
                        {worker.user?.role && ` (${worker.user.role})`}
                        {worker.employee_id && ` - ${worker.employee_id}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assignment Role */}
                <div>
                  <label htmlFor="assignment_role" className="block text-sm font-medium text-gray-700 mb-2">
                    Assignment Role
                  </label>
                  <select
                    id="assignment_role"
                    value={formData.assignment_role}
                    onChange={(e) => handleInputChange('assignment_role', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="worker">Worker</option>
                    <option value="lead">Team Lead</option>
                    <option value="foreman">Foreman</option>
                    <option value="specialist">Specialist</option>
                    <option value="apprentice">Apprentice</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                    min={formData.start_date || undefined}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Special instructions or notes for this assignment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingAssignment ? 'Updating...' : 'Assigning...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingAssignment ? 'Update Assignment' : 'Assign Worker'}
                    </>
                  )}
                </Button>
                
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  )
}