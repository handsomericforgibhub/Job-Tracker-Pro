'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { TIMEOUTS } from '@/config/timeouts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { WorkerApplication } from '@/lib/types'
import { 
  Users, 
  Search, 
  Filter,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Award,
  UserCheck,
  AlertCircle,
  Copy,
  ExternalLink,
  Share2,
  Globe
} from 'lucide-react'

const statusConfig = {
  pending: {
    label: 'Pending Review',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: Clock
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: AlertCircle
  }
}

export default function ApplicationsPage() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  
  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company
  const [applications, setApplications] = useState<WorkerApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'withdrawn'>('all')
  const [selectedApplication, setSelectedApplication] = useState<WorkerApplication | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    if (user && effectiveCompany && (user.role === 'owner' || user.role === 'foreman' || user.role === 'site_admin')) {
      fetchApplications()
    }
  }, [user, effectiveCompany, statusFilter])

  const fetchApplications = async () => {
    try {
      setIsLoading(true)
      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : ''
      const response = await fetch(`/api/applications/worker?company_id=${effectiveCompany?.id}${statusParam}`)
      
      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications || [])
        
        // Show message if table doesn't exist
        if (data.message) {
          console.warn(data.message)
          setSetupRequired(true)
        }
      } else {
        console.error('Failed to fetch applications')
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Error details:', errorData)
        
        // Check if it's a schema issue
        if (errorData.error?.includes('applications') || errorData.details?.includes('worker_applications')) {
          setSetupRequired(true)
        }
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplicationAction = async (applicationId: string, action: 'approved' | 'rejected') => {
    try {
      setIsReviewing(true)
      
      const updateData = {
        status: action,
        reviewer_notes: reviewNotes,
        ...(action === 'rejected' && { rejection_reason: rejectionReason })
      }

      const response = await fetch(`/api/applications/worker/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy-token' // Replace with real auth
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        // Refresh applications list
        await fetchApplications()
        setSelectedApplication(null)
        setReviewNotes('')
        setRejectionReason('')
      } else {
        console.error('Failed to update application')
      }
    } catch (error) {
      console.error('Error updating application:', error)
    } finally {
      setIsReviewing(false)
    }
  }

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.email.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const copyApplicationLink = async () => {
    const applicationUrl = `${window.location.origin}/apply/worker`
    try {
      await navigator.clipboard.writeText(applicationUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), TIMEOUTS.COPY_SUCCESS_FEEDBACK)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = applicationUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), TIMEOUTS.COPY_SUCCESS_FEEDBACK)
    }
  }

  const openApplicationForm = () => {
    window.open('/apply/worker', '_blank')
  }

  const parseSkills = (skillsJson: string | null) => {
    try {
      return skillsJson ? JSON.parse(skillsJson) : []
    } catch {
      return []
    }
  }

  const parseCertifications = (certsJson: string | null) => {
    try {
      return certsJson ? JSON.parse(certsJson) : []
    } catch {
      return []
    }
  }

  const parseAvailability = (availabilityJson: string | null) => {
    try {
      return availabilityJson ? JSON.parse(availabilityJson) : {}
    } catch {
      return {}
    }
  }

  if (!user || (user.role !== 'owner' && user.role !== 'foreman' && user.role !== 'site_admin')) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Access denied. Only owners, foremen, and site administrators can view applications.</p>
      </div>
    )
  }

  // Show site admin specific content if they're not in company context
  if (user.role === 'site_admin' && !currentCompanyContext) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Worker Applications</h1>
            <p className="text-gray-600">Review and manage worker applications across companies</p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <Users className="h-12 w-12 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-blue-900 mb-2">Select a Company to View Applications</h3>
          <p className="text-blue-700 mb-4">
            To see worker applications, navigate to a company from the Companies page and enter its context.
          </p>
          <Button 
            onClick={() => window.location.href = '/dashboard/admin/companies'}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Browse Companies
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Worker Applications</h1>
          <p className="text-gray-600">Review and manage incoming worker applications</p>
        </div>
      </div>

      {/* Worker Recruitment Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Share2 className="h-5 w-5" />
            Recruit New Workers
          </CardTitle>
          <CardDescription className="text-blue-700">
            Share the application link to recruit skilled workers for your construction projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Application Link Section */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Public Application Form</h3>
              <div className="bg-white rounded-lg border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Application URL:</span>
                </div>
                <div className="bg-gray-50 rounded border p-3 mb-3">
                  <code className="text-sm text-gray-700 break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/apply/worker` : '/apply/worker'}
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={copyApplicationLink}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {copySuccess ? 'Copied!' : 'Copy Link'}
                  </Button>
                  <Button
                    onClick={openApplicationForm}
                    size="sm"
                    className="flex-1"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview Form
                  </Button>
                </div>
              </div>
            </div>

            {/* Sharing Instructions */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">How to Share</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Copy the application link</p>
                    <p>Use the "Copy Link" button to get the URL</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Share on multiple channels</p>
                    <p>Post on job boards, social media, or send directly to candidates</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Review applications here</p>
                    <p>New applications will appear in the list below for your approval</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{applications.filter(a => a.status === 'pending').length}</div>
                <div className="text-xs text-gray-600">Pending Review</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{applications.filter(a => a.status === 'approved').length}</div>
                <div className="text-xs text-gray-600">Approved</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{applications.length}</div>
                <div className="text-xs text-gray-600">Total Applications</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {applications.length > 0 ? Math.round((applications.filter(a => a.status === 'approved').length / applications.length) * 100) : 0}%
                </div>
                <div className="text-xs text-gray-600">Approval Rate</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">
                  {applications.filter(a => a.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {applications.filter(a => a.status === 'approved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">
                  {applications.filter(a => a.status === 'rejected').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Applications</p>
                <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Applications</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Required Message */}
      {setupRequired && (
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Database Setup Required</h3>
                <p className="text-sm text-gray-600 mb-4">
                  The worker applications feature requires a database migration to be applied. 
                  Please run the migration script to enable worker onboarding functionality.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Quick Setup:</h4>
                  <ol className="text-sm text-gray-600 space-y-1">
                    <li>1. Go to your Supabase project dashboard</li>
                    <li>2. Navigate to the SQL Editor</li>
                    <li>3. Run the script: <code className="bg-gray-200 px-1 rounded">database-scripts/12-worker-applications-schema-simple.sql</code></li>
                    <li>4. Refresh this page</li>
                  </ol>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : setupRequired ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Worker Applications Feature</h3>
            <p className="text-gray-600">
              Once the database migration is applied, worker applications will appear here.
            </p>
          </CardContent>
        </Card>
      ) : filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Found</h3>
            <p className="text-gray-600">
              {applications.length === 0 
                ? 'No worker applications have been submitted yet.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredApplications.map(application => {
            const statusInfo = statusConfig[application.status]
            const StatusIcon = statusInfo.icon
            const skills = parseSkills(application.skills)
            const certifications = parseCertifications(application.certifications)

            return (
              <Card key={application.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{application.full_name}</CardTitle>
                      <CardDescription className="mt-1">
                        Applied {formatDate(application.applied_at)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={statusInfo.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="truncate">{application.email}</span>
                    </div>
                    
                    {application.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{application.phone}</span>
                      </div>
                    )}
                    
                    {application.years_experience !== null && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Briefcase className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{application.years_experience} years experience</span>
                      </div>
                    )}
                    
                    {application.desired_hourly_rate && (
                      <div className="flex items-center text-sm text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        <span>${application.desired_hourly_rate}/hour</span>
                      </div>
                    )}
                  </div>

                  {skills.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Skills:</p>
                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 5).map((skill: string) => (
                          <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {skills.length > 5 && (
                          <span className="text-xs text-gray-500">+{skills.length - 5} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {application.work_experience && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Experience:</p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {application.work_experience}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedApplication(application)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                    
                    {application.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApplicationAction(application.id, 'approved')}
                          disabled={isReviewing}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => handleApplicationAction(application.id, 'rejected')}
                          disabled={isReviewing}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Application Detail Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedApplication.full_name}</h2>
                  <p className="text-gray-600">Application Details</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedApplication(null)}>
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-sm text-gray-600">{selectedApplication.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-sm text-gray-600">{selectedApplication.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <p className="text-sm text-gray-600">{selectedApplication.address || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Date of Birth</p>
                      <p className="text-sm text-gray-600">
                        {selectedApplication.date_of_birth || 'Not provided'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Work Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Work Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Years of Experience</p>
                      <p className="text-sm text-gray-600">{selectedApplication.years_experience || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Desired Hourly Rate</p>
                      <p className="text-sm text-gray-600">
                        {selectedApplication.desired_hourly_rate ? `$${selectedApplication.desired_hourly_rate}` : 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Previous Employer</p>
                      <p className="text-sm text-gray-600">{selectedApplication.previous_employer || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">How they heard about us</p>
                      <p className="text-sm text-gray-600">{selectedApplication.source || 'Not provided'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Experience Description */}
                {selectedApplication.work_experience && (
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg">Work Experience</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {selectedApplication.work_experience}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Skills and Certifications */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Skills & Certifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {parseSkills(selectedApplication.skills).map((skill: string) => (
                            <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Certifications</p>
                        <div className="space-y-1">
                          {parseCertifications(selectedApplication.certifications).map((cert: any, index: number) => (
                            <p key={index} className="text-xs text-gray-600">{cert.name}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Emergency Contact */}
                {selectedApplication.emergency_contact_name && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Emergency Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Name</p>
                        <p className="text-sm text-gray-600">{selectedApplication.emergency_contact_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Phone</p>
                        <p className="text-sm text-gray-600">{selectedApplication.emergency_contact_phone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Relationship</p>
                        <p className="text-sm text-gray-600">{selectedApplication.emergency_contact_relationship}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* References */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">References</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedApplication.reference1_name && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Reference 1</p>
                        <p className="text-xs text-gray-600">{selectedApplication.reference1_name}</p>
                        <p className="text-xs text-gray-600">{selectedApplication.reference1_phone}</p>
                        <p className="text-xs text-gray-600">{selectedApplication.reference1_relationship}</p>
                      </div>
                    )}
                    {selectedApplication.reference2_name && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Reference 2</p>
                        <p className="text-xs text-gray-600">{selectedApplication.reference2_name}</p>
                        <p className="text-xs text-gray-600">{selectedApplication.reference2_phone}</p>
                        <p className="text-xs text-gray-600">{selectedApplication.reference2_relationship}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Action Section for Pending Applications */}
              {selectedApplication.status === 'pending' && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-medium mb-4">Review Application</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Review Notes
                      </label>
                      <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add any notes about this application..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApplicationAction(selectedApplication.id, 'approved')}
                        disabled={isReviewing}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Approve & Create Worker
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => handleApplicationAction(selectedApplication.id, 'rejected')}
                        disabled={isReviewing}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Application
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Information for Processed Applications */}
              {selectedApplication.status !== 'pending' && selectedApplication.reviewed_at && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-medium mb-2">Review Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      <strong>Status:</strong> {statusConfig[selectedApplication.status].label}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Reviewed:</strong> {formatDate(selectedApplication.reviewed_at)}
                    </p>
                    {selectedApplication.reviewed_by_user && (
                      <p className="text-sm text-gray-600">
                        <strong>Reviewed by:</strong> {selectedApplication.reviewed_by_user.full_name}
                      </p>
                    )}
                    {selectedApplication.reviewer_notes && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Notes:</strong> {selectedApplication.reviewer_notes}
                      </p>
                    )}
                    {selectedApplication.rejection_reason && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Rejection Reason:</strong> {selectedApplication.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}