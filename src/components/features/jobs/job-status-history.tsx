'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JobStatusHistory, JobStatusTimeline } from '@/lib/types'
import { 
  Clock, 
  CheckCircle, 
  Pause, 
  AlertCircle,
  User,
  Calendar,
  MessageSquare,
  TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'

interface JobStatusHistoryProps {
  jobId: string
  className?: string
}

const statusConfig = {
  planning: { 
    label: 'Planning', 
    color: 'bg-blue-500', 
    icon: Clock, 
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  active: { 
    label: 'Active', 
    color: 'bg-green-500', 
    icon: CheckCircle, 
    bgColor: 'bg-green-50 text-green-700 border-green-200'
  },
  on_hold: { 
    label: 'On Hold', 
    color: 'bg-yellow-500', 
    icon: Pause, 
    bgColor: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-gray-500', 
    icon: CheckCircle, 
    bgColor: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-500', 
    icon: AlertCircle, 
    bgColor: 'bg-red-50 text-red-700 border-red-200'
  }
}

export function JobStatusHistoryComponent({ jobId, className }: JobStatusHistoryProps) {
  const [statusHistory, setStatusHistory] = useState<JobStatusHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatusHistory()
  }, [jobId])

  const fetchStatusHistory = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/jobs/${jobId}/status-history`)
      if (!response.ok) {
        throw new Error('Failed to fetch status history')
      }
      
      const data: JobStatusTimeline = await response.json()
      setStatusHistory(data.history)
    } catch (err) {
      console.error('Error fetching status history:', err)
      setError('Failed to load status history')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Status History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {statusHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No status changes recorded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {statusHistory.map((entry, index) => {
              const config = statusConfig[entry.status as keyof typeof statusConfig]
              const Icon = config.icon
              const isLast = index === statusHistory.length - 1
              
              return (
                <div key={entry.id} className="relative">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-4 top-8 w-0.5 h-16 bg-gray-200" />
                  )}
                  
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    
                    {/* Status details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={config.bgColor}>
                          {config.label}
                        </Badge>
                        {entry.is_current && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Current
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(entry.changed_at), 'MMM dd, yyyy \'at\' h:mm a')}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{entry.changed_by_name}</span>
                        </div>
                        
                        {entry.duration_days > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{entry.duration_days} day{entry.duration_days !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      
                      {entry.notes && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700">{entry.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}