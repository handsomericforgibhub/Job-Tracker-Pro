'use client'

import { useState, useEffect } from 'react'
import { EnhancedJob } from '@/lib/types/question-driven'
import { JobDashboard } from '@/components/question-driven'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  MapPin, 
  Calendar, 
  User, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Settings,
  FileText,
  History,
  Loader2
} from 'lucide-react'

interface EnhancedJobDetailsProps {
  jobId: string
  job?: EnhancedJob | null
  showQuestionDriven?: boolean
  className?: string
}

export default function EnhancedJobDetails({ 
  jobId, 
  job: propJob,
  showQuestionDriven = true,
  className 
}: EnhancedJobDetailsProps) {
  const [job, setJob] = useState<EnhancedJob | null>(propJob || null)
  const [loading, setLoading] = useState(!propJob)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (propJob) {
      setJob(propJob)
      setLoading(false)
    } else {
      loadJob()
    }
  }, [jobId, propJob])

  const loadJob = async () => {
    // Don't attempt to load if we already have job data
    if (propJob) return
    
    try {
      setLoading(true)
      setError(null)

      // Use Next.js server-side request instead of client-side fetch
      const response = await fetch(`/api/jobs/${jobId}`)

      if (!response.ok) {
        throw new Error('Failed to load job details')
      }

      const data = await response.json()
      setJob(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading job details...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className={className} variant="destructive">
        <AlertTriangle className="w-4 h-4" />
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

  // Check if this job uses the question-driven system
  const hasQuestionDrivenSystem = job.current_stage_id && showQuestionDriven

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Job Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{job.title}</CardTitle>
              <div className="flex flex-wrap gap-2 mb-4">
                {job.current_stage ? (
                  <Badge 
                    variant="default" 
                    className="text-sm"
                    style={{ backgroundColor: job.current_stage.color }}
                  >
                    {job.current_stage.name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-sm">
                    {job.status}
                  </Badge>
                )}
                {job.job_type && (
                  <Badge variant="secondary" className="text-sm">
                    {job.job_type}
                  </Badge>
                )}
                {hasQuestionDrivenSystem && (
                  <Badge variant="default" className="text-sm bg-blue-500">
                    Question-Driven
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `/dashboard/jobs/${jobId}/edit`}
              >
                <Settings className="w-4 h-4 mr-2" />
                Edit Job
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {job.client_name && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Client:</span>
                <span>{job.client_name}</span>
              </div>
            )}
            {job.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Location:</span>
                <span>{job.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-medium">Start Date:</span>
              <span>{new Date(job.start_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="font-medium">End Date:</span>
              <span>{new Date(job.end_date).toLocaleDateString()}</span>
            </div>
            {job.foreman && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Foreman:</span>
                <span>{job.foreman.full_name}</span>
              </div>
            )}
            {job.budget && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Budget:</span>
                <span>${job.budget.toLocaleString()}</span>
              </div>
            )}
            {job.stage_entered_at && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="font-medium">Current Stage Since:</span>
                <span>{new Date(job.stage_entered_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          {job.description && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-gray-700">{job.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {hasQuestionDrivenSystem && (
            <TabsTrigger value="questions">Questions</TabsTrigger>
          )}
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="text-lg font-semibold">{job.status}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Days Running</p>
                    <p className="text-lg font-semibold">
                      {Math.ceil((Date.now() - new Date(job.start_date).getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Tasks</p>
                    <p className="text-lg font-semibold">
                      {job.active_tasks?.filter(t => t.status === 'in_progress').length || 0}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed Tasks</p>
                    <p className="text-lg font-semibold">
                      {job.active_tasks?.filter(t => t.status === 'completed').length || 0}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.audit_history?.slice(0, 5).map((entry, index) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {entry.trigger_source === 'question_response' ? 'Question Answered' : 'Stage Change'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {entry.trigger_source.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {entry.from_stage?.name} → {entry.to_stage?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleDateString()} • 
                        {entry.triggered_by_user?.full_name || 'System'}
                      </p>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-500 text-sm">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {hasQuestionDrivenSystem && (
          <TabsContent value="questions" className="space-y-4">
            <JobDashboard jobId={jobId} />
          </TabsContent>
        )}

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Timeline</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Created:</span>
                      <span className="text-sm">{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Start Date:</span>
                      <span className="text-sm">{new Date(job.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">End Date:</span>
                      <span className="text-sm">{new Date(job.end_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Updated:</span>
                      <span className="text-sm">{new Date(job.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Team</h4>
                  <div className="space-y-2">
                    {job.foreman && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          {job.foreman.full_name} (Foreman)
                        </span>
                      </div>
                    )}
                    {/* Add more team members here */}
                  </div>
                </div>
                
                {job.address_components && (
                  <div>
                    <h4 className="font-medium mb-3">Location Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Address:</span>
                        <span className="text-sm">{job.address_components.formatted}</span>
                      </div>
                      {job.address_components.city && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">City:</span>
                          <span className="text-sm">{job.address_components.city}</span>
                        </div>
                      )}
                      {job.address_components.state && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">State:</span>
                          <span className="text-sm">{job.address_components.state}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Stage History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {job.audit_history?.map((entry, index) => (
                  <div key={entry.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                         style={{ backgroundColor: entry.to_stage?.color || '#6B7280' }}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">
                          {entry.from_stage?.name || 'Start'} → {entry.to_stage?.name || 'Unknown'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {entry.trigger_source.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Date:</span> {new Date(entry.created_at).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">By:</span> {entry.triggered_by_user?.full_name || 'System'}
                        </div>
                        {entry.duration_in_previous_stage_hours && (
                          <div>
                            <span className="font-medium">Duration:</span> {Math.round(entry.duration_in_previous_stage_hours)} hours
                          </div>
                        )}
                        {entry.response_value && (
                          <div>
                            <span className="font-medium">Response:</span> {entry.response_value}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-gray-500 text-sm">No stage history available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}