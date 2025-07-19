'use client'

import { useState, useEffect } from 'react'
import { JobStage, StageAuditLog, StagePerformanceMetrics } from '@/lib/types/question-driven'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  Calendar,
  User,
  TrendingUp,
  AlertTriangle,
  Loader2
} from 'lucide-react'

interface StageProgressIndicatorProps {
  jobId: string
  currentStageId?: string
  showHistory?: boolean
  showMetrics?: boolean
  className?: string
}

interface StageProgressData {
  stages: JobStage[]
  currentStageIndex: number
  auditHistory: StageAuditLog[]
  performanceMetrics: StagePerformanceMetrics[]
}

export default function StageProgressIndicator({
  jobId,
  currentStageId,
  showHistory = false,
  showMetrics = false,
  className = ''
}: StageProgressIndicatorProps) {
  const [progressData, setProgressData] = useState<StageProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProgressData()
  }, [jobId, currentStageId])

  const loadProgressData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all stages
      const stagesResponse = await fetch('/api/stages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!stagesResponse.ok) {
        throw new Error('Failed to load stages')
      }

      const stagesData = await stagesResponse.json()
      const stages: JobStage[] = stagesData.data || []

      // Find current stage index
      const currentStageIndex = currentStageId 
        ? stages.findIndex(s => s.id === currentStageId)
        : -1

      // Load audit history if requested
      let auditHistory: StageAuditLog[] = []
      if (showHistory) {
        const historyResponse = await fetch(`/api/jobs/${jobId}/audit-history`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })

        if (historyResponse.ok) {
          const historyData = await historyResponse.json()
          auditHistory = historyData.data || []
        }
      }

      // Load performance metrics if requested
      let performanceMetrics: StagePerformanceMetrics[] = []
      if (showMetrics) {
        const metricsResponse = await fetch(`/api/jobs/${jobId}/performance-metrics`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json()
          performanceMetrics = metricsData.data || []
        }
      }

      setProgressData({
        stages,
        currentStageIndex,
        auditHistory,
        performanceMetrics
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  const getStageStatus = (stageIndex: number, currentIndex: number) => {
    if (stageIndex < currentIndex) return 'completed'
    if (stageIndex === currentIndex) return 'current'
    return 'upcoming'
  }

  const formatDuration = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)}h`
    } else {
      const days = Math.floor(hours / 24)
      const remainingHours = Math.round(hours % 24)
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading progress...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className={className} variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!progressData) {
    return (
      <Alert className={className}>
        <AlertDescription>No progress data available</AlertDescription>
      </Alert>
    )
  }

  const { stages, currentStageIndex, auditHistory, performanceMetrics } = progressData
  const progressPercentage = currentStageIndex >= 0 
    ? ((currentStageIndex + 1) / stages.length) * 100 
    : 0

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Job Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Overall Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Stage {currentStageIndex + 1} of {stages.length}</span>
              <span>{stages.length - currentStageIndex - 1} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Stage Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stages.map((stage, index) => {
              const status = getStageStatus(index, currentStageIndex)
              const metric = performanceMetrics.find(m => m.stage_id === stage.id)
              
              return (
                <div key={stage.id} className="flex items-start gap-3">
                  {/* Stage indicator */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      status === 'completed' 
                        ? 'bg-green-500' 
                        : status === 'current' 
                        ? 'bg-blue-500' 
                        : 'bg-gray-300'
                    }`}>
                      {status === 'completed' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : status === 'current' ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    {index < stages.length - 1 && (
                      <div className={`absolute top-8 left-1/2 w-0.5 h-8 transform -translate-x-1/2 ${
                        status === 'completed' ? 'bg-green-200' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>

                  {/* Stage content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium ${
                        status === 'current' ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {stage.name}
                      </h4>
                      <Badge 
                        variant={status === 'current' ? 'default' : 'secondary'}
                        className="text-xs"
                        style={{ 
                          backgroundColor: status === 'current' ? stage.color : undefined 
                        }}
                      >
                        {stage.maps_to_status}
                      </Badge>
                    </div>
                    
                    {stage.description && (
                      <p className="text-sm text-gray-600 mb-2">{stage.description}</p>
                    )}

                    {/* Stage metrics */}
                    {showMetrics && metric && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-2">
                        {metric.duration_hours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(metric.duration_hours)}</span>
                          </div>
                        )}
                        {metric.tasks_completed > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>{metric.tasks_completed} tasks</span>
                          </div>
                        )}
                        {metric.tasks_overdue > 0 && (
                          <div className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{metric.tasks_overdue} overdue</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stage timing */}
                    {status === 'current' && (
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            Entered: {metric?.entered_at 
                              ? new Date(metric.entered_at).toLocaleDateString()
                              : 'Recently'
                            }
                          </span>
                        </div>
                        {stage.max_duration_hours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              Target: {formatDuration(stage.max_duration_hours)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent history */}
      {showHistory && auditHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditHistory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {entry.from_stage?.name || 'Started'} 
                        {entry.to_stage && (
                          <>
                            <ArrowRight className="w-3 h-3 inline mx-1" />
                            {entry.to_stage.name}
                          </>
                        )}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {entry.trigger_source.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                      </div>
                      {entry.triggered_by_user && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{entry.triggered_by_user.full_name}</span>
                        </div>
                      )}
                      {entry.duration_in_previous_stage_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(entry.duration_in_previous_stage_hours)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}