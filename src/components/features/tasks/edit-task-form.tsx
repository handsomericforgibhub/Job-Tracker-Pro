'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Task, User } from '@/lib/types'
import { X, Save, Trash2 } from 'lucide-react'

interface EditTaskFormProps {
  task: Task
  onTaskUpdated: () => void
  onTaskDeleted: () => void
  onCancel: () => void
}

export default function EditTaskForm({ task, onTaskUpdated, onTaskDeleted, onCancel }: EditTaskFormProps) {
  const { user, company } = useAuthStore()
  const [companyUsers, setCompanyUsers] = useState<User[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    assigned_to: task.assigned_to || '',
    due_date: task.due_date || '',
    estimated_hours: task.estimated_hours ? task.estimated_hours.toString() : '',
    actual_hours: task.actual_hours ? task.actual_hours.toString() : ''
  })

  useEffect(() => {
    if (company) {
      fetchCompanyUsers()
    }
  }, [company])

  const fetchCompanyUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('company_id', company?.id)
        .order('full_name')

      if (error) {
        console.error('❌ Error fetching company users:', error)
        return
      }

      setCompanyUsers(data || [])
    } catch (err) {
      console.error('❌ Exception fetching company users:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user || !formData.title.trim()) {
      setError('Task title is required')
      return
    }

    setIsSubmitting(true)

    try {
      console.log('🔄 Updating task...')

      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        actual_hours: formData.actual_hours ? parseFloat(formData.actual_hours) : null,
        updated_at: new Date().toISOString()
      }

      console.log('📝 Task update data:', updateData)

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id)

      if (error) {
        console.error('❌ Error updating task:', error)
        setError(`Failed to update task: ${error.message}`)
        return
      }

      console.log('✅ Task updated successfully')
      onTaskUpdated()
      
    } catch (err) {
      console.error('❌ Exception updating task:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)

    try {
      console.log('🔄 Deleting task...')

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)

      if (error) {
        console.error('❌ Error deleting task:', error)
        setError(`Failed to delete task: ${error.message}`)
        return
      }

      console.log('✅ Task deleted successfully')
      onTaskDeleted()
      
    } catch (err) {
      console.error('❌ Exception deleting task:', err)
      setError('Failed to delete task')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const canEdit = user && (user.role === 'owner' || user.role === 'foreman' || task.assigned_to === user.id)

  if (!canEdit) {
    return (
      <Card className="mb-6 border-yellow-200">
        <CardContent className="p-4">
          <p className="text-yellow-700">You don't have permission to edit this task.</p>
          <Button variant="outline" size="sm" onClick={onCancel} className="mt-2">
            Close
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Edit Task</CardTitle>
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

          {/* Task Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="e.g., Install kitchen cabinets"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Additional details about this task..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-2">
              Assign To
            </label>
            <select
              id="assigned_to"
              value={formData.assigned_to}
              onChange={(e) => handleInputChange('assigned_to', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Unassigned</option>
              {companyUsers.map(companyUser => (
                <option key={companyUser.id} value={companyUser.id}>
                  {companyUser.full_name} ({companyUser.role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Due Date */}
            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleInputChange('due_date', e.target.value)}
              />
            </div>

            {/* Estimated Hours */}
            <div>
              <label htmlFor="estimated_hours" className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Hours
              </label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
                placeholder="8.0"
              />
            </div>

            {/* Actual Hours */}
            <div>
              <label htmlFor="actual_hours" className="block text-sm font-medium text-gray-700 mb-2">
                Actual Hours
              </label>
              <Input
                id="actual_hours"
                type="number"
                step="0.5"
                min="0"
                value={formData.actual_hours}
                onChange={(e) => handleInputChange('actual_hours', e.target.value)}
                placeholder="6.5"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-between pt-4">
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Task
                  </>
                )}
              </Button>
              
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>

            {/* Delete Button */}
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-700 mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}