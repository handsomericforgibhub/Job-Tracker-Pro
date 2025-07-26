'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TimeEntry, Worker, Job, Task } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import AddressAutocomplete from '@/components/ui/address-autocomplete'
import { 
  Clock, 
  Save, 
  X, 
  MapPin,
  Calculator,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface TimeEntryFormProps {
  worker?: Worker
  workers?: Worker[]
  jobs: Job[]
  tasks: Task[]
  existingEntry?: TimeEntry
  onSave?: (entry: TimeEntry) => void
  onCancel?: () => void
  className?: string
}

export function TimeEntryForm({ 
  worker, 
  workers = [],
  jobs, 
  tasks, 
  existingEntry, 
  onSave, 
  onCancel, 
  className 
}: TimeEntryFormProps) {
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    worker_id: worker?.id || '',
    job_id: '',
    task_id: '',
    start_time: '',
    end_time: '',
    description: '',
    entry_type: 'regular' as 'regular' | 'overtime' | 'break' | 'travel',
    start_location: '',
    end_location: '',
  })
  const [calculatedDuration, setCalculatedDuration] = useState<number>(0)
  const [estimatedCost, setEstimatedCost] = useState<number>(0)
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])
  const [startLocationComponents, setStartLocationComponents] = useState<any>(null)
  const [endLocationComponents, setEndLocationComponents] = useState<any>(null)
  const [startLocationCoords, setStartLocationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [endLocationCoords, setEndLocationCoords] = useState<{ lat: number; lng: number } | null>(null)

  // Debug workers
  useEffect(() => {
    console.log('TimeEntryForm workers:', workers)
  }, [workers])

  // Populate form with existing entry data
  useEffect(() => {
    if (existingEntry) {
      setFormData({
        worker_id: existingEntry.worker_id,
        job_id: existingEntry.job_id,
        task_id: existingEntry.task_id || '',
        start_time: existingEntry.start_time ? 
          new Date(existingEntry.start_time).toISOString().slice(0, 16) : '',
        end_time: existingEntry.end_time ? 
          new Date(existingEntry.end_time).toISOString().slice(0, 16) : '',
        description: existingEntry.description || '',
        entry_type: existingEntry.entry_type,
        start_location: existingEntry.start_location || '',
        end_location: existingEntry.end_location || '',
      })
    }
  }, [existingEntry])

  // Filter tasks based on selected job
  useEffect(() => {
    if (formData.job_id) {
      const jobTasks = tasks.filter(task => task.job_id === formData.job_id)
      setFilteredTasks(jobTasks)
    } else {
      setFilteredTasks([])
    }
  }, [formData.job_id, tasks])

  // Calculate duration and cost when times change
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const startTime = new Date(formData.start_time)
      const endTime = new Date(formData.end_time)
      const durationMs = endTime.getTime() - startTime.getTime()
      const durationMinutes = Math.floor(durationMs / (1000 * 60))
      
      if (durationMinutes > 0) {
        setCalculatedDuration(durationMinutes)
        
        // Calculate estimated cost
        const hourlyRate = worker?.hourly_rate || 0
        const hours = durationMinutes / 60
        const isOvertime = formData.entry_type === 'overtime'
        const rate = isOvertime ? hourlyRate * 1.5 : hourlyRate
        setEstimatedCost(hours * rate)
      } else {
        setCalculatedDuration(0)
        setEstimatedCost(0)
      }
    } else {
      setCalculatedDuration(0)
      setEstimatedCost(0)
    }
  }, [formData.start_time, formData.end_time, formData.entry_type, worker?.hourly_rate])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear task selection when job changes
    if (field === 'job_id' && value !== formData.job_id) {
      setFormData(prev => ({
        ...prev,
        task_id: ''
      }))
    }
  }

  const handleStartLocationChange = (value: string, components?: any, coords?: { lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      start_location: value
    }))
    setStartLocationComponents(components || null)
    setStartLocationCoords(coords || null)
  }

  const handleEndLocationChange = (value: string, components?: any, coords?: { lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      end_location: value
    }))
    setEndLocationComponents(components || null)
    setEndLocationCoords(coords || null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.worker_id || !formData.job_id || !formData.start_time) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      const entryData = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : undefined,
        task_id: formData.task_id || undefined,
        start_location: formData.start_location || undefined,
        end_location: formData.end_location || undefined,
        start_gps_lat: startLocationCoords?.lat || undefined,
        start_gps_lng: startLocationCoords?.lng || undefined,
        end_gps_lat: endLocationCoords?.lat || undefined,
        end_gps_lng: endLocationCoords?.lng || undefined,
      }

      const url = existingEntry ? `/api/time/entries` : '/api/time/entries'
      const method = existingEntry ? 'PUT' : 'POST'
      
      if (existingEntry) {
        (entryData as any).id = existingEntry.id
      }

      console.log('📝 Submitting time entry data:', entryData)

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`, // Replace with proper auth token
        },
        body: JSON.stringify(entryData),
      })

      if (!response.ok) {
        console.error('❌ Response not OK:', response.status, response.statusText)
        let errorMessage = 'Failed to save time entry'
        try {
          const errorText = await response.text()
          console.error('❌ Raw error response:', errorText)
          
          // Try to parse as JSON
          try {
            const error = JSON.parse(errorText)
            errorMessage = error.error || error.message || errorMessage
            console.error('❌ Parsed API Error:', error)
          } catch (jsonError) {
            console.error('❌ Response is not JSON, likely HTML error page')
            errorMessage = `Server error (${response.status}): ${response.statusText}`
          }
        } catch (textError) {
          console.error('❌ Could not read response text:', textError)
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      // Show success message
      const successMessage = existingEntry ? 'Time entry updated successfully' : 'Time entry created successfully'
      toast.success(successMessage, {
        description: `Duration: ${formatDuration(calculatedDuration)}${estimatedCost > 0 ? ` • Cost: $${estimatedCost.toFixed(2)}` : ''}`,
        duration: 5000
      })
      
      onSave?.(data.time_entry)

    } catch (error) {
      console.error('Save time entry error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save time entry')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const selectedJob = jobs.find(job => job.id === formData.job_id)
  const selectedTask = filteredTasks.find(task => task.id === formData.task_id)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>
            {existingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Worker Selection (if not specified) */}
          {!worker && (
            <div>
              <Label htmlFor="worker_id">Worker *</Label>
              <select
                id="worker_id"
                value={formData.worker_id}
                onChange={(e) => handleInputChange('worker_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Search and select a worker</option>
                {workers
                  .filter(w => w.employment_status === 'active')
                  .map((workerOption) => (
                  <option key={workerOption.id} value={workerOption.id}>
                    {workerOption.users?.full_name || 'Unknown Name'} 
                    {workerOption.users?.role && ` (${workerOption.users.role})`}
                    {workerOption.employee_id && ` - ${workerOption.employee_id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Job Selection */}
          <div>
            <Label htmlFor="job_id">Job *</Label>
            <select
              id="job_id"
              value={formData.job_id}
              onChange={(e) => handleInputChange('job_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.client_name} • {job.status}
                </option>
              ))}
            </select>
          </div>

          {/* Task Selection */}
          {filteredTasks.length > 0 && (
            <div>
              <Label htmlFor="task_id">Task (Optional)</Label>
              <select
                id="task_id"
                value={formData.task_id}
                onChange={(e) => handleInputChange('task_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a task (optional)</option>
                {filteredTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} - Priority: {task.priority} • Status: {task.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => handleInputChange('start_time', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => handleInputChange('end_time', e.target.value)}
              />
            </div>
          </div>

          {/* Entry Type */}
          <div>
            <Label htmlFor="entry_type">Entry Type</Label>
            <select
              id="entry_type"
              value={formData.entry_type}
              onChange={(e) => handleInputChange('entry_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="regular">Regular Time</option>
              <option value="overtime">Overtime</option>
              <option value="travel">Travel Time</option>
              <option value="break">Break Time</option>
            </select>
          </div>

          {/* Duration and Cost Calculation */}
          {calculatedDuration > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-2">
              <div className="flex items-center space-x-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Calculated Values</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Duration:</span>
                  <span className="ml-2 font-medium">{formatDuration(calculatedDuration)}</span>
                </div>
                {worker?.hourly_rate && (
                  <div>
                    <span className="text-blue-600">Estimated Cost:</span>
                    <span className="ml-2 font-medium">${estimatedCost.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {formData.entry_type === 'overtime' && (
                <div className="text-xs text-orange-600">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Overtime rate (1.5x) applied
                </div>
              )}
            </div>
          )}

          {/* Location Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_location">Start Location</Label>
              <AddressAutocomplete
                id="start_location"
                value={formData.start_location}
                onChange={handleStartLocationChange}
                placeholder="Starting location"
                className="w-full"
              />
              {startLocationComponents && (
                <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs text-green-700">
                    ✅ Address verified: {startLocationComponents.city && `${startLocationComponents.city}, `}{startLocationComponents.state} {startLocationComponents.postcode}
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="end_location">End Location</Label>
              <AddressAutocomplete
                id="end_location"
                value={formData.end_location}
                onChange={handleEndLocationChange}
                placeholder="Ending location"
                className="w-full"
              />
              {endLocationComponents && (
                <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-xs text-green-700">
                    ✅ Address verified: {endLocationComponents.city && `${endLocationComponents.city}, `}{endLocationComponents.state} {endLocationComponents.postcode}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe the work performed..."
              rows={3}
            />
          </div>

          {/* Selected Job/Task Info */}
          {selectedJob && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-600 mb-1">Selected Work</div>
              <div className="font-medium">{selectedJob.title}</div>
              <div className="text-sm text-gray-600">{selectedJob.client_name}</div>
              {selectedTask && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-sm">
                    <span className="font-medium">Task:</span> {selectedTask.title}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {selectedTask.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {selectedTask.status}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || !formData.worker_id || !formData.job_id || !formData.start_time}
              className="flex-1"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              {existingEntry ? 'Update Entry' : 'Save Entry'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default TimeEntryForm