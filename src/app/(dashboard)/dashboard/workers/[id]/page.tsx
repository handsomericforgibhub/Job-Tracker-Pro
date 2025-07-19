'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Worker, JobAssignment } from '@/lib/types'
import { 
  ArrowLeft, 
  Edit, 
  Phone, 
  Mail, 
  MapPin,
  Calendar, 
  DollarSign, 
  User,
  AlertTriangle,
  Briefcase,
  Clock,
  UserCheck,
  UserX,
  Shield,
  KeyRound
} from 'lucide-react'
import Link from 'next/link'
import WorkerSkills from '@/components/workers/worker-skills'
import WorkerLicenses from '@/components/workers/worker-licenses'
import PasswordReset from '@/components/workers/password-reset'

const employmentStatusConfig = {
  active: {
    label: 'Active',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: UserCheck
  },
  inactive: {
    label: 'Inactive', 
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: UserX
  },
  terminated: {
    label: 'Terminated',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: UserX
  }
}

const roleConfig = {
  owner: {
    label: 'Owner',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Shield
  },
  foreman: {
    label: 'Foreman',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: User
  },
  worker: {
    label: 'Worker',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: User
  }
}

const assignmentStatusConfig = {
  active: {
    label: 'Active',
    color: 'bg-green-50 text-green-700 border-green-200'
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  removed: {
    label: 'Removed',
    color: 'bg-red-50 text-red-700 border-red-200'
  }
}

export default function WorkerProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user, company } = useAuthStore()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)

  const workerId = params.id as string

  useEffect(() => {
    if (user && company && workerId) {
      fetchWorkerData()
    }
  }, [user, company, workerId])

  const fetchWorkerData = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching worker details for:', workerId)

      // Fetch worker profile
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select(`
          *,
          user:users!workers_user_id_fkey(
            full_name,
            email,
            role
          )
        `)
        .eq('id', workerId)
        .eq('company_id', company?.id)
        .single()

      if (workerError) {
        console.error('❌ Error fetching worker:', workerError)
        if (workerError.code === 'PGRST116') {
          setError('Worker not found')
        } else {
          setError('Failed to load worker details')
        }
        return
      }

      console.log('✅ Worker loaded:', workerData)
      setWorker(workerData)

      // Fetch job assignments (with optional assigned_by user)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select(`
          *,
          job:jobs(
            id,
            title,
            status,
            start_date,
            end_date
          )
        `)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })

      if (assignmentsError) {
        console.error('❌ Error fetching job assignments:', assignmentsError)
        console.error('❌ Assignment error details:', JSON.stringify(assignmentsError, null, 2))
        // Don't fail completely, just set empty assignments
        setJobAssignments([])
      } else {
        console.log('✅ Job assignments loaded:', assignmentsData?.length || 0)
        setJobAssignments(assignmentsData || [])
      }

    } catch (err) {
      console.error('❌ Exception fetching worker data:', err)
      setError('Failed to load worker details')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not set'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const canEditWorker = user && (user.role === 'owner' || user.role === 'foreman')

  if (!user) return null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !worker) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {error || 'Worker not found'}
        </h3>
        <p className="text-gray-600 mb-4">
          The worker you're looking for doesn't exist or you don't have access to them.
        </p>
        <Link href="/dashboard/workers">
          <Button>Back to Workers</Button>
        </Link>
      </div>
    )
  }

  const statusInfo = employmentStatusConfig[worker.employment_status] || employmentStatusConfig.active
  const roleInfo = roleConfig[worker.user?.role || 'worker'] || roleConfig.worker
  const StatusIcon = statusInfo.icon
  const RoleIcon = roleInfo.icon

  // Debug log if status/role is not recognized
  if (!employmentStatusConfig[worker.employment_status]) {
    console.warn('⚠️ Unknown employment status:', worker.employment_status, 'for worker:', worker.id)
  }
  if (!roleConfig[worker.user?.role || 'worker']) {
    console.warn('⚠️ Unknown role:', worker.user?.role, 'for worker:', worker.id)
  }

  return (
    <>
      {/* Password Reset Modal */}
      {showPasswordReset && worker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full">
            <PasswordReset 
              worker={worker} 
              onClose={() => setShowPasswordReset(false)} 
            />
          </div>
        </div>
      )}
      
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/workers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workers
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {worker.user?.full_name || 'Unknown Name'}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className={statusInfo.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className={roleInfo.color}>
                <RoleIcon className="h-3 w-3 mr-1" />
                {roleInfo.label}
              </Badge>
              {worker.employee_id && (
                <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                  ID: {worker.employee_id}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {canEditWorker && (
          <Link href={`/dashboard/workers/${worker.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Worker
            </Button>
          </Link>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {worker.user?.email && (
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email</p>
                      <p className="text-sm text-gray-600">{worker.user.email}</p>
                    </div>
                  </div>
                )}
                
                {worker.phone && (
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Phone</p>
                      <p className="text-sm text-gray-600">{worker.phone}</p>
                    </div>
                  </div>
                )}
                
                {worker.address && (
                  <div className="flex items-center md:col-span-2">
                    <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Address</p>
                      <p className="text-sm text-gray-600">{worker.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          {(worker.emergency_contact_name || worker.emergency_contact_phone) && (
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {worker.emergency_contact_name && (
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Name</p>
                        <p className="text-sm text-gray-600">{worker.emergency_contact_name}</p>
                      </div>
                    </div>
                  )}
                  
                  {worker.emergency_contact_phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <p className="text-sm text-gray-600">{worker.emergency_contact_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Briefcase className="h-5 w-5 mr-2" />
                Job Assignments
              </CardTitle>
              <CardDescription>
                Current and past job assignments for this worker
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">No job assignments yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobAssignments.map(assignment => {
                    const assignmentStatus = assignmentStatusConfig.active
                    return (
                      <div key={assignment.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Link 
                                href={`/dashboard/jobs/${assignment.job?.id}`}
                                className="font-medium text-blue-600 hover:text-blue-800"
                              >
                                {assignment.job?.title || 'Unknown Job'}
                              </Link>
                              <Badge variant="outline" className={assignmentStatus.color}>
                                {assignmentStatus.label}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Role: <span className="capitalize">{assignment.role || 'Worker'}</span></p>
                              <p>Assigned: {formatDate(assignment.assigned_date)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skills & Certifications */}
          <WorkerSkills workerId={worker.id} canEdit={canEditWorker} />

          {/* Licenses & Documents */}
          <WorkerLicenses workerId={worker.id} canEdit={canEditWorker} />

          {/* Notes */}
          {worker.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{worker.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Employment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {worker.hourly_rate && (
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Hourly Rate</p>
                    <p className="text-sm text-gray-600">{formatCurrency(worker.hourly_rate)}</p>
                  </div>
                </div>
              )}
              
              {worker.hire_date && (
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Hire Date</p>
                    <p className="text-sm text-gray-600">{formatDate(worker.hire_date)}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Member Since</p>
                  <p className="text-sm text-gray-600">{formatDate(worker.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Assignments</span>
                <span className="font-medium">
                  {jobAssignments.filter(a => a.status === 'active').length}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Assignments</span>
                <span className="font-medium">{jobAssignments.length}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Completed Jobs</span>
                <span className="font-medium">
                  {jobAssignments.filter(a => a.status === 'completed').length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {canEditWorker && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href={`/dashboard/workers/${worker.id}/edit`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Worker Details
                  </Button>
                </Link>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setShowPasswordReset(true)}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
                
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Assign to Job
                  <span className="ml-auto text-xs text-gray-500">Soon</span>
                </Button>
                
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Calendar className="h-4 w-4 mr-2" />
                  View Schedule
                  <span className="ml-auto text-xs text-gray-500">Soon</span>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </>
  )
}