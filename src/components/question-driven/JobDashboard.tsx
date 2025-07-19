'use client'

import { useState, useEffect } from 'react'
import { EnhancedJob, QuestionFormData, TaskUpdateRequest } from '@/lib/types/question-driven'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Building2, 
  Calendar, 
  User, 
  Phone, 
  FileText, 
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react'

// Import the mobile components we just created
import MobileQuestionInterface from './MobileQuestionInterface'
import MobileTaskList from './MobileTaskList'
import StageProgressIndicator from './StageProgressIndicator'

interface JobDashboardProps {
  jobId: string
  className?: string
}

export default function JobDashboard({ jobId, className = '' }: JobDashboardProps) {
  const [job, setJob] = useState<EnhancedJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('questions')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    loadJob()
  }, [jobId])

  const loadJob = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load job')
      }

      const data = await response.json()
      setJob(data.data)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionAnswered = (response: QuestionFormData) => {
    console.log('Question answered:', response)
    // Refresh job data after question is answered
    loadJob()
  }

  const handleStageComplete = () => {
    console.log('Stage completed')
    // Switch to progress tab to show completion
    setActiveTab('progress')
    // Refresh job data
    loadJob()
  }

  const handleTaskUpdate = (taskId: string, updates: TaskUpdateRequest) => {
    console.log('Task updated:', taskId, updates)
    // Optionally refresh job data or update local state
    loadJob()
  }

  const handleRefresh = () => {
    loadJob()
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading job...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className={className} variant="destructive">
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={loadJob} className="mt-2">
          Try Again
        </Button>
      </Alert>
    )
  }

  if (!job) {
    return (
      <Alert className={className}>
        <AlertDescription>Job not found</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Job header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{job.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="default" 
                  className="text-sm"
                  style={{ 
                    backgroundColor: job.current_stage?.color || '#6B7280'
                  }}
                >
                  {job.current_stage?.name || job.status}
                </Badge>
                {job.job_type && (
                  <Badge variant="outline" className="text-sm">
                    {job.job_type}
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="ml-2"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {job.client_name && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span>{job.client_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>Created {new Date(job.created_at).toLocaleDateString()}</span>
            </div>
            {job.stage_entered_at && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>
                  Current stage since {new Date(job.stage_entered_at).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span>Last updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Questions
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <MobileQuestionInterface
                jobId={jobId}
                onQuestionAnswered={handleQuestionAnswered}
                onStageComplete={handleStageComplete}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <MobileTaskList
                jobId={jobId}
                onTaskUpdate={handleTaskUpdate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <StageProgressIndicator
            jobId={jobId}
            currentStageId={job.current_stage_id}
            showHistory={true}
            showMetrics={true}
          />
        </TabsContent>
      </Tabs>

      {/* Quick stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-600">
                {job.active_tasks?.filter(t => t.status === 'completed').length || 0}
              </div>
              <div className="text-xs text-gray-500">Completed Tasks</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-orange-600">
                {job.active_tasks?.filter(t => t.status === 'in_progress').length || 0}
              </div>
              <div className="text-xs text-gray-500">In Progress</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-red-600">
                {job.active_tasks?.filter(t => t.status === 'overdue').length || 0}
              </div>
              <div className="text-xs text-gray-500">Overdue</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile optimizations indicator */}
      {job.mobile_optimized && (
        <Alert>
          <Phone className="w-4 h-4" />
          <AlertDescription>
            This job is optimized for mobile use. You can safely access it from your phone on-site.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}