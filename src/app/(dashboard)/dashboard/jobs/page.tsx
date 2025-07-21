'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Job } from '@/lib/types'
import { 
  Plus, 
  Calendar, 
  DollarSign, 
  MapPin, 
  User,
  Briefcase,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause
} from 'lucide-react'
import Link from 'next/link'
import { GanttChart } from '@/components/gantt/gantt-chart'

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

export default function JobsPage() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  useEffect(() => {
    if (user && effectiveCompany) {
      fetchJobs()
    } else if (user?.role === 'site_admin' && !currentCompanyContext) {
      setIsLoading(false)
    }
  }, [user, effectiveCompany, currentCompanyContext])

  const fetchJobs = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching jobs for company:', effectiveCompany?.id)

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          created_by_user:users!jobs_created_by_fkey(full_name),
          current_stage:job_stages!current_stage_id (
            id,
            name,
            color,
            sequence_order,
            maps_to_status
          )
        `)
        .eq('company_id', effectiveCompany?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching jobs:', error)
        setError('Failed to load jobs')
        return
      }

      console.log('✅ Jobs loaded:', data)
      console.log('📊 Jobs data structure:', data?.[0]) // Log first job structure
      setJobs(data || [])
    } catch (err) {
      console.error('❌ Exception fetching jobs:', err)
      setError('Failed to load jobs')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'Not set'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!user) return null

  // Show site admin message if no company context
  if (user.role === 'site_admin' && !currentCompanyContext) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
            <p className="text-gray-600 mt-2">
              Manage construction projects and track progress
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Briefcase className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">No Company Context Selected</h3>
          <p className="text-blue-700 mb-4">
            As a site administrator, you need to select a company context to view jobs.
          </p>
          <Link href="/dashboard/site-admin/companies">
            <Button>
              Select Company
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-600 mt-2">
            Manage your construction projects and track progress
            {user.role === 'site_admin' && currentCompanyContext && (
              <span className="text-blue-600"> • {currentCompanyContext.name}</span>
            )}
          </p>
        </div>
        
        {(user.role === 'owner' || user.role === 'foreman' || (user.role === 'site_admin' && currentCompanyContext)) && (
          <Link href="/dashboard/jobs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </Link>
        )}
      </div>

      {/* Gantt Chart */}
      <GanttChart jobs={jobs} className="mb-6" />

      {/* Stage-based Stats for Question-Driven Jobs */}
      {jobs.some(job => job.current_stage) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question-Driven Stage Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from(new Set(jobs.filter(job => job.current_stage).map(job => job.current_stage.name)))
              .map(stageName => {
                const count = jobs.filter(job => job.current_stage?.name === stageName).length
                const stageJob = jobs.find(job => job.current_stage?.name === stageName)
                const stageColor = stageJob?.current_stage?.color || '#6B7280'
                const stageOrder = stageJob?.current_stage?.sequence_order || 999
                
                return {
                  name: stageName,
                  count,
                  color: stageColor,
                  order: stageOrder
                }
              })
              .sort((a, b) => a.order - b.order) // Sort by pipeline order
              .map(stage => (
                <Card key={stage.name} className="border-l-4" style={{ borderLeftColor: stage.color }}>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-600 truncate" title={stage.name}>
                        {stage.name}
                      </p>
                      <p className="text-xl font-bold text-gray-900">{stage.count}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            }
          </div>
        </div>
      )}

      {/* Traditional Status Stats - Only show if no jobs are using question-driven system */}
      {!jobs.some(job => job.current_stage) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = jobs.filter(job => job.status === status).length
            const Icon = config.icon
            
            return (
              <Card key={status}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{config.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                    </div>
                    <Icon className={`h-8 w-8 text-white p-1.5 rounded-lg ${config.color}`} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
          <CardDescription>
            {jobs.length} total jobs in your company
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Jobs</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchJobs}>Try Again</Button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first job to get started with project management.
              </p>
              {(user.role === 'owner' || user.role === 'foreman' || (user.role === 'site_admin' && currentCompanyContext)) && (
                <Link href="/dashboard/jobs/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Job
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => {
                const statusInfo = statusConfig[job.status as keyof typeof statusConfig]
                const StatusIcon = statusInfo.icon
                
                return (
                  <div
                    key={job.id}
                    className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {job.title}
                          </h3>
                          {job.current_stage ? (
                            <Badge 
                              variant="outline" 
                              className="border-2"
                              style={{ 
                                borderColor: job.current_stage.color, 
                                color: job.current_stage.color,
                                backgroundColor: job.current_stage.color + '10'
                              }}
                            >
                              ✨ {job.current_stage.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={statusInfo.bgColor}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          )}
                        </div>
                        
                        {job.description && (
                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {job.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          {job.client_name && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2" />
                              {job.client_name}
                            </div>
                          )}
                          
                          {job.location && (
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-2" />
                              {job.location}
                            </div>
                          )}
                          
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2" />
                            {formatDate(job.start_date)}
                          </div>
                          
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2" />
                            {formatCurrency(job.budget)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <Link href={`/dashboard/jobs/${job.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}