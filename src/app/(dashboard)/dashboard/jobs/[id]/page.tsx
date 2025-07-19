'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Job } from '@/lib/types'
import { 
  ArrowLeft, 
  Edit, 
  MapPin, 
  Calendar, 
  DollarSign, 
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  Building,
  Phone,
  Mail,
  FileText,
  Upload
} from 'lucide-react'
import Link from 'next/link'
import TaskList from '@/components/tasks/task-list'
import JobAssignments from '@/components/workers/job-assignments'
import { DocumentList } from '@/components/ui/document-list'
import { DocumentUpload } from '@/components/ui/document-upload'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import JobQRGenerator from '@/components/qr/job-qr-generator'

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

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState<any[]>([])
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const jobId = params.id as string

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  useEffect(() => {
    if (user && effectiveCompany && jobId) {
      fetchJob()
      fetchDocuments()
    } else if (user?.role === 'site_admin' && !currentCompanyContext) {
      setIsLoading(false)
      setError('No company context selected')
    }
  }, [user, effectiveCompany, currentCompanyContext, jobId])

  const fetchJob = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching job details for:', jobId)

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          created_by_user:users!jobs_created_by_fkey(full_name, email)
        `)
        .eq('id', jobId)
        .eq('company_id', effectiveCompany?.id)
        .single()

      if (error) {
        console.error('❌ Error fetching job:', error)
        if (error.code === 'PGRST116') {
          setError('Job not found')
        } else {
          setError('Failed to load job details')
        }
        return
      }

      console.log('✅ Job loaded:', data)
      setJob(data)
    } catch (err) {
      console.error('❌ Exception fetching job:', err)
      setError('Failed to load job details')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          category:document_categories(name, icon, color),
          uploader:users(full_name)
        `)
        .eq('job_id', jobId)
        .eq('company_id', effectiveCompany?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        return
      }

      setDocuments(data || [])
    } catch (err) {
      console.error('Exception fetching documents:', err)
    }
  }

  const handleUploadSuccess = () => {
    fetchDocuments()
    setIsUploadOpen(false)
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
      month: 'long',
      day: 'numeric'
    })
  }

  const getFormattedAddress = (job: Job) => {
    if (job.address_components?.formatted) {
      return job.address_components.formatted
    }
    return job.location || 'No location specified'
  }

  const canEditJob = user && (user.role === 'owner' || user.role === 'foreman' || (user.role === 'site_admin' && currentCompanyContext))

  if (!user) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {error || 'Job not found'}
        </h3>
        <p className="text-gray-600 mb-4">
          The job you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link href="/dashboard/jobs">
          <Button>Back to Jobs</Button>
        </Link>
      </div>
    )
  }

  const statusInfo = statusConfig[job.status as keyof typeof statusConfig]
  const StatusIcon = statusInfo.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/jobs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className={statusInfo.bgColor}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
              <span className="text-gray-600">
                Created {formatDate(job.created_at)}
              </span>
            </div>
          </div>
        </div>
        
        {canEditJob && (
          <Link href={`/dashboard/jobs/${job.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Job
            </Button>
          </Link>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Job Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.description && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Start Date</p>
                    <p className="text-sm text-gray-600">{formatDate(job.start_date)}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">End Date</p>
                    <p className="text-sm text-gray-600">{formatDate(job.end_date)}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Budget</p>
                    <p className="text-sm text-gray-600">{formatCurrency(job.budget)}</p>
                  </div>
                </div>
                
                {job.client_name && (
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Client</p>
                      <p className="text-sm text-gray-600">{job.client_name}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-900 font-medium">
                  {getFormattedAddress(job)}
                </p>
                
                {job.address_components && (
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    {job.address_components.city && (
                      <div>
                        <span className="font-medium">City:</span> {job.address_components.city}
                      </div>
                    )}
                    {job.address_components.state && (
                      <div>
                        <span className="font-medium">State:</span> {job.address_components.state}
                      </div>
                    )}
                    {job.address_components.postcode && (
                      <div>
                        <span className="font-medium">ZIP:</span> {job.address_components.postcode}
                      </div>
                    )}
                    {job.address_components.country && (
                      <div>
                        <span className="font-medium">Country:</span> {job.address_components.country}
                      </div>
                    )}
                  </div>
                )}
                
                {job.latitude && job.longitude && (
                  <div className="text-xs text-gray-500">
                    Coordinates: {job.latitude.toFixed(6)}, {job.longitude.toFixed(6)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Content */}
          <Tabs defaultValue="tasks" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="documents">
                Documents
                {documents.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {documents.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="qr">QR Code</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <TaskList jobId={job.id} canEdit={!!canEditJob} />
            </TabsContent>

            <TabsContent value="team">
              <JobAssignments jobId={job.id} canEdit={!!canEditJob} />
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Job Documents
                    </CardTitle>
                    {canEditJob && (
                      <Button 
                        onClick={() => setIsUploadOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Documents
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    Documents, photos, and files related to this job
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No documents yet
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Upload documents, photos, and files related to this job.
                      </p>
                      {canEditJob && (
                        <Button 
                          onClick={() => setIsUploadOpen(true)}
                          variant="outline"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload First Document
                        </Button>
                      )}
                    </div>
                  ) : (
                    <DocumentList
                      documents={documents}
                      categories={[]}
                      onDocumentSelect={() => {}}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr">
              <JobQRGenerator job={job} />
            </TabsContent>
            
            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Job Timeline
                  </CardTitle>
                  <CardDescription>
                    Activity history and important milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Timeline Coming Soon
                    </h3>
                    <p className="text-gray-600">
                      Track job progress and milestones here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Job Info */}
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Job ID</p>
                <p className="text-sm text-gray-600 font-mono">{job.id.split('-')[0]}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-900">Created By</p>
                <div className="flex items-center mt-1">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600">
                    {(job as any).created_by_user?.full_name || 'Unknown'}
                  </span>
                </div>
                {(job as any).created_by_user?.email && (
                  <div className="flex items-center mt-1">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {(job as any).created_by_user.email}
                    </span>
                  </div>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-900">Last Updated</p>
                <p className="text-sm text-gray-600">{formatDate(job.updated_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canEditJob && (
                <>
                  <Link href={`/dashboard/jobs/${job.id}/edit`}>
                    <Button variant="outline" className="w-full justify-start">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Job Details
                    </Button>
                  </Link>
                  
                  <Button variant="outline" className="w-full justify-start" disabled>
                    <User className="h-4 w-4 mr-2" />
                    Assign Workers
                    <span className="ml-auto text-xs text-gray-500">Coming Soon</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Add Documents
                  </Button>
                </>
              )}
              
              <Button variant="outline" className="w-full justify-start" disabled>
                <MapPin className="h-4 w-4 mr-2" />
                View on Map
                <span className="ml-auto text-xs text-gray-500">Coming Soon</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Upload Job Documents</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsUploadOpen(false)}
              >
                ×
              </Button>
            </div>
            <DocumentUpload
              jobId={job.id}
              onUploadSuccess={handleUploadSuccess}
              onCancel={() => setIsUploadOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}