'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Job } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { 
  Clock, 
  CheckCircle, 
  Pause, 
  AlertCircle,
  ArrowRight,
  User,
  Calendar
} from 'lucide-react'

interface JobStatusChangeFormProps {
  job: Job
  onStatusChange?: (newStatus: string, notes?: string) => void
  onClose?: () => void
}

const statusConfig = {
  planning: { 
    label: 'Planning', 
    color: 'bg-blue-500', 
    icon: Clock, 
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Job is in planning phase'
  },
  active: { 
    label: 'Active', 
    color: 'bg-green-500', 
    icon: CheckCircle, 
    bgColor: 'bg-green-50 text-green-700 border-green-200',
    description: 'Job is actively being worked on'
  },
  on_hold: { 
    label: 'On Hold', 
    color: 'bg-yellow-500', 
    icon: Pause, 
    bgColor: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    description: 'Job is temporarily paused'
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-gray-500', 
    icon: CheckCircle, 
    bgColor: 'bg-gray-50 text-gray-700 border-gray-200',
    description: 'Job has been completed'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-500', 
    icon: AlertCircle, 
    bgColor: 'bg-red-50 text-red-700 border-red-200',
    description: 'Job has been cancelled'
  }
}

export function JobStatusChangeForm({ job, onStatusChange, onClose }: JobStatusChangeFormProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>(job.status)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentStatusConfig = statusConfig[job.status as keyof typeof statusConfig]
  const selectedStatusConfig = statusConfig[selectedStatus as keyof typeof statusConfig]
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedStatus === job.status) {
      onClose?.()
      return
    }

    setIsSubmitting(true)
    
    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`/api/jobs/${job.id}/status-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          status: selectedStatus,
          notes: notes.trim() || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      const result = await response.json()
      
      onStatusChange?.(selectedStatus, notes.trim() || undefined)
      onClose?.()
    } catch (error) {
      console.error('Error updating job status:', error)
      alert('Failed to update job status. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusOptions = Object.entries(statusConfig).filter(([status]) => status !== job.status)

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Change Job Status
        </CardTitle>
        <CardDescription>
          Update the status of "{job.title}" and optionally add notes about the change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Status</label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={currentStatusConfig.bgColor}>
              <currentStatusConfig.icon className="h-3 w-3 mr-1" />
              {currentStatusConfig.label}
            </Badge>
            <span className="text-sm text-gray-600">{currentStatusConfig.description}</span>
          </div>
        </div>

        {/* Status Change */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Status Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">New Status</label>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {statusOptions.map(([status, config]) => {
                const Icon = config.icon
                return (
                  <label
                    key={status}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedStatus === status 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={selectedStatus === status}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="sr-only"
                    />
                    <Badge variant="outline" className={config.bgColor}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <span className="text-sm text-gray-600">{config.description}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant notes about this status change..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />
          </div>

          {/* Summary */}
          {selectedStatus !== job.status && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={currentStatusConfig.bgColor}>
                    <currentStatusConfig.icon className="h-3 w-3 mr-1" />
                    {currentStatusConfig.label}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <Badge variant="outline" className={selectedStatusConfig.bgColor}>
                    <selectedStatusConfig.icon className="h-3 w-3 mr-1" />
                    {selectedStatusConfig.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selectedStatus === job.status || isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}