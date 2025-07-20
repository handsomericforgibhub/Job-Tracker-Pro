'use client'

import { useState, useEffect } from 'react'
import { 
  JobTask, 
  TaskStatus, 
  SubtaskInstance, 
  SubtaskUpdateRequest,
  TaskUpdateRequest 
} from '@/lib/types/question-driven'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Upload, 
  User,
  Calendar,
  Loader2,
  X
} from 'lucide-react'
import FileUploadHandler from './FileUploadHandler'
import { FileUploadResult } from '@/lib/types/question-driven'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface MobileTaskListProps {
  jobId: string
  filterStatus?: TaskStatus
  showClientVisible?: boolean
  onTaskUpdate?: (taskId: string, updates: TaskUpdateRequest) => void
  className?: string
}

export default function MobileTaskList({
  jobId,
  filterStatus,
  showClientVisible = false,
  onTaskUpdate,
  className = ''
}: MobileTaskListProps) {
  const [tasks, setTasks] = useState<JobTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set())
  const [uploadDialogOpen, setUploadDialogOpen] = useState<string | null>(null)

  useEffect(() => {
    loadTasks()
  }, [jobId, filterStatus, showClientVisible])

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (showClientVisible) params.append('client_visible', 'true')

      const response = await fetch(`/api/jobs/${jobId}/tasks?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load tasks')
      }

      const data = await response.json()
      setTasks(data.data.tasks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const handleSubtaskToggle = async (taskId: string, subtaskId: string, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    try {
      setUpdatingTasks(prev => new Set(prev).add(taskId))

      const subtaskUpdates: SubtaskUpdateRequest[] = [{
        id: subtaskId,
        completed
      }]

      const response = await fetch(`/api/jobs/${jobId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subtasks: subtaskUpdates
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update subtask')
      }

      const result = await response.json()
      
      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, ...result.data } : t
      ))

      // Notify parent component
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { subtasks: subtaskUpdates })
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subtask')
    } finally {
      setUpdatingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      setUpdatingTasks(prev => new Set(prev).add(taskId))

      const response = await fetch(`/api/jobs/${jobId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update task status')
      }

      const result = await response.json()
      
      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, ...result.data } : t
      ))

      // Notify parent component
      if (onTaskUpdate) {
        onTaskUpdate(taskId, { status: newStatus })
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task status')
    } finally {
      setUpdatingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleFileUpload = async (taskId: string, results: FileUploadResult[]) => {
    try {
      // Filter successful uploads
      const successfulUploads = results.filter(r => r.success)
      
      if (successfulUploads.length === 0) {
        setError('No files were uploaded successfully')
        return
      }

      // In a real implementation, you would save these files to the task
      // For now, we'll simulate saving the file references
      const fileData = successfulUploads.map(result => ({
        url: result.file_url,
        name: result.file_name,
        size: result.file_size
      }))

      // Here you would typically make an API call to save the files to the task
      // await fetch(`/api/jobs/${jobId}/tasks/${taskId}/files`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ files: fileData })
      // })

      // Close the upload dialog
      setUploadDialogOpen(null)
      
      // Show success message
      const fileCount = successfulUploads.length
      const fileText = fileCount === 1 ? 'file' : 'files'
      console.log(`Successfully uploaded ${fileCount} ${fileText} for task ${taskId}:`, fileData)
      
      // Update task state to show files were uploaded (optional)
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, files: [...(t.files || []), ...fileData] } 
          : t
      ))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save uploaded files')
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'overdue': return 'bg-red-500'
      case 'cancelled': return 'bg-gray-500'
      default: return 'bg-yellow-500'
    }
  }

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'overdue': return <AlertTriangle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateProgress = (subtasks: SubtaskInstance[]) => {
    if (subtasks.length === 0) return 0
    const completed = subtasks.filter(st => st.completed).length
    return Math.round((completed / subtasks.length) * 100)
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading tasks...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className={className} variant="destructive">
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={loadTasks} className="mt-2">
          Try Again
        </Button>
      </Alert>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className={`text-center p-8 text-gray-500 ${className}`}>
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No tasks found</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {tasks.map((task) => {
        const isExpanded = expandedTasks.has(task.id)
        const isUpdating = updatingTasks.has(task.id)
        const progress = calculateProgress(task.subtasks)

        return (
          <Card key={task.id} className="overflow-hidden">
            <CardHeader 
              className="pb-3 cursor-pointer"
              onClick={() => toggleTaskExpansion(task.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-1 rounded-full text-white ${getStatusColor(task.status)}`}>
                  {getStatusIcon(task.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight mb-1">
                    {task.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {task.status.replace('_', ' ')}
                    </Badge>
                    {task.template?.priority && (
                      <Badge className={`text-xs ${getPriorityColor(task.template.priority)}`}>
                        {task.template.priority}
                      </Badge>
                    )}
                    {task.template?.client_visible && (
                      <Badge variant="secondary" className="text-xs">
                        Client Visible
                      </Badge>
                    )}
                  </div>
                  {task.subtasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                </div>
                {isUpdating && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {task.description && (
                  <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                )}

                {/* Task metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mb-4">
                  {task.assignee && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{task.assignee.full_name}</span>
                    </div>
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(task.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Subtasks */}
                {task.subtasks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <h4 className="text-sm font-medium">Subtasks</h4>
                    {task.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={(e) => handleSubtaskToggle(task.id, subtask.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className={`text-sm flex-1 ${subtask.completed ? 'line-through text-gray-500' : ''}`}>
                          {subtask.title}
                        </span>
                        {subtask.upload_urls && subtask.upload_urls.length > 0 && (
                          <Upload className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Task actions */}
                <div className="flex gap-2">
                  {task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleTaskStatusChange(task.id, 'in_progress')}
                      disabled={isUpdating}
                    >
                      Start Task
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => handleTaskStatusChange(task.id, 'completed')}
                      disabled={isUpdating}
                    >
                      Mark Complete
                    </Button>
                  )}
                  {task.template?.upload_required && task.status !== 'completed' && (
                    <Dialog 
                      open={uploadDialogOpen === task.id} 
                      onOpenChange={(open) => setUploadDialogOpen(open ? task.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Upload className="w-4 h-4 mr-1" />
                          Upload
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Upload Files for Task</DialogTitle>
                        </DialogHeader>
                        <FileUploadHandler
                          acceptedTypes={['image/*', 'application/pdf', '.doc', '.docx']}
                          maxFileSize={10}
                          maxFiles={5}
                          onFilesUploaded={(results) => handleFileUpload(task.id, results)}
                          onError={(error) => setError(error)}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {/* Notes */}
                {task.notes && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                    <span className="font-medium">Notes: </span>
                    {task.notes}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}