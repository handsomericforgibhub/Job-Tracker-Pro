'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building2,
  MapPin,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle,
  MapIcon,
  Navigation,
  FileText,
  Zap,
  Shield,
  Users,
  Star
} from 'lucide-react'
import { EXTERNAL_APIS } from '@/config/endpoints'

interface SharedAssignmentData {
  id: string
  role: string
  assigned_date: string
  job: {
    title: string
    description?: string
    location?: string
    address_components?: any
    latitude?: number
    longitude?: number
    start_date?: string
    end_date?: string
    status: string
    client_name?: string
    company: {
      name: string
    }
  }
  worker: {
    name: string
    email: string
    phone?: string
    emergency_contact?: {
      name: string
      phone: string
    }
  }
  tasks: Array<{
    id: string
    title: string
    description?: string
    status: string
    priority: string
    due_date?: string
    estimated_hours?: number
  }>
  shared_at: string
  expires_at?: string
}

const statusConfig = {
  planning: { label: 'Planning', color: 'bg-gray-100 text-gray-800' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' }
}

const taskStatusConfig = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  to_do: { label: 'To Do', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  blocked: { label: 'Blocked', color: 'bg-orange-100 text-orange-800' }
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-800', icon: '●' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-800', icon: '●●' },
  high: { label: 'High', color: 'bg-yellow-100 text-yellow-800', icon: '●●●' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800', icon: '🔥' }
}

export default function SharedAssignmentPage({ params }: { params: { token: string } }) {
  const [assignment, setAssignment] = useState<SharedAssignmentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAssignment()
  }, [params.token])

  const fetchAssignment = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/shared-assignments/${params.token}`)
      
      if (response.ok) {
        const data = await response.json()
        setAssignment(data.assignment)
      } else if (response.status === 404) {
        setError('Assignment not found or sharing has been disabled')
      } else if (response.status === 410) {
        setError('This sharing link has expired')
      } else {
        setError('Failed to load assignment details')
      }
    } catch (err) {
      setError('Failed to load assignment details')
    } finally {
      setIsLoading(false)
    }
  }

  const logAction = async (action: string) => {
    try {
      await fetch(`/api/shared-assignments/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
    } catch (err) {
      console.error('Failed to log action:', err)
    }
  }

  const openDirections = () => {
    if (assignment?.job.latitude && assignment.job.longitude) {
      const url = EXTERNAL_APIS.GOOGLE_MAPS.getDirectionsUrl(assignment.job.latitude, assignment.job.longitude)
      window.open(url, '_blank')
      logAction('view')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assignment details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Assignment</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!assignment) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Building2 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{assignment.job.title}</h1>
          <p className="text-gray-600">{assignment.job.company.name}</p>
        </div>

        {/* Assignment Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Assignment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Worker Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{assignment.worker.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{assignment.worker.email}</span>
                  </div>
                  {assignment.worker.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{assignment.worker.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Assignment Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>Assigned {formatDate(assignment.assigned_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusConfig[assignment.job.status as keyof typeof statusConfig]?.color}>
                      {statusConfig[assignment.job.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Job Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {assignment.job.description && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                    <p className="text-sm text-gray-600">{assignment.job.description}</p>
                  </div>
                )}
                
                {assignment.job.client_name && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Client</h3>
                    <p className="text-sm text-gray-600">{assignment.job.client_name}</p>
                  </div>
                )}

                {(assignment.job.start_date || assignment.job.end_date) && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Schedule</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      {assignment.job.start_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>Start: {formatDate(assignment.job.start_date)}</span>
                        </div>
                      )}
                      {assignment.job.end_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>End: {formatDate(assignment.job.end_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {assignment.job.location && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Location</h3>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p>{assignment.job.location}</p>
                        {assignment.job.latitude && assignment.job.longitude && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={openDirections}
                          >
                            <Navigation className="h-4 w-4 mr-1" />
                            Get Directions
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {assignment.worker.emergency_contact && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Emergency Contact</h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <span>{assignment.worker.emergency_contact.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-red-400" />
                        <a 
                          href={`tel:${assignment.worker.emergency_contact.phone}`}
                          className="text-red-600 hover:underline"
                        >
                          {assignment.worker.emergency_contact.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        {assignment.tasks.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Tasks & Assignments
              </CardTitle>
              <CardDescription>
                {assignment.tasks.length} task(s) assigned to this job
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assignment.tasks.map(task => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <div className="flex gap-2">
                        <Badge className={taskStatusConfig[task.status as keyof typeof taskStatusConfig]?.color}>
                          {taskStatusConfig[task.status as keyof typeof taskStatusConfig]?.label}
                        </Badge>
                        <Badge variant="outline" className={priorityConfig[task.priority as keyof typeof priorityConfig]?.color}>
                          {priorityConfig[task.priority as keyof typeof priorityConfig]?.icon} {priorityConfig[task.priority as keyof typeof priorityConfig]?.label}
                        </Badge>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      {task.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Due: {formatDateTime(task.due_date)}</span>
                        </div>
                      )}
                      {task.estimated_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Est: {task.estimated_hours}h</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Safety & Important Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Safety & Important Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <h3 className="font-medium text-yellow-800 mb-2">Safety Reminders</h3>
                  <ul className="space-y-1 text-yellow-700">
                    <li>• Always wear appropriate PPE (Personal Protective Equipment)</li>
                    <li>• Follow all company safety protocols and procedures</li>
                    <li>• Report any safety hazards immediately to your supervisor</li>
                    <li>• Keep emergency contact information readily available</li>
                    <li>• Take regular breaks and stay hydrated</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8 pb-6">
          <p>Assignment shared on {formatDateTime(assignment.shared_at)}</p>
          {assignment.expires_at && (
            <p>This link expires on {formatDateTime(assignment.expires_at)}</p>
          )}
          <p className="mt-2">Powered by {assignment.job.company.name} - JobTracker Pro</p>
        </div>
      </div>
    </div>
  )
}