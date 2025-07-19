'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Task, User } from '@/lib/types'
import { X, Save } from 'lucide-react'

interface AddTaskFormProps {
  jobId: string
  onTaskCreated: () => void
  onCancel: () => void
  parentTaskId?: string
}

export default function AddTaskForm({ jobId, onTaskCreated, onCancel, parentTaskId }: AddTaskFormProps) {
  const { user, company } = useAuthStore()
  const [companyUsers, setCompanyUsers] = useState<User[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    assigned_to: '',
    due_date: '',
    estimated_hours: ''
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
      console.log('🔄 Creating new task...')

      // Get current highest sort_order for this job
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('sort_order')
        .eq('job_id', jobId)
        .eq('parent_task_id', parentTaskId || null)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextSortOrder = existingTasks && existingTasks.length > 0 
        ? (existingTasks[0].sort_order || 0) + 1 
        : 1

      const taskData = {
        job_id: jobId,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        parent_task_id: parentTaskId || null,
        sort_order: nextSortOrder,
        status: 'todo',
        created_by: user.id
      }

      console.log('📝 Task data:', taskData)

      const { error } = await supabase
        .from('tasks')
        .insert(taskData)

      if (error) {
        console.error('❌ Error creating task:', error)
        setError(`Failed to create task: ${error.message}`)
        return
      }

      console.log('✅ Task created successfully')
      onTaskCreated()
      
    } catch (err) {
      console.error('❌ Exception creating task:', err)
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
            {parentTaskId ? 'Add Subtask' : 'Add New Task'}
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
              autoFocus
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
            
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}