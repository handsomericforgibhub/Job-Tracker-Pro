'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AddressAutocomplete from '@/components/ui/address-autocomplete'
import { Job } from '@/lib/types'
import { ArrowLeft, Save, Trash2, MapPin, AlertCircle, Users } from 'lucide-react'
import Link from 'next/link'
import ForemanSelect from '@/components/ui/foreman-select'
import { EditJobStatusSelect } from '@/components/ui/job-status-select'
import { useCompanyStages } from '@/hooks/useCompanyStages'

export default function EditJobPage() {
  const params = useParams()
  const router = useRouter()
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  
  const jobId = params.id as string
  
  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company
  
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_name: '',
    location: '',
    start_date: '',
    end_date: '',
    budget: '',
    status: 'planning' as const,
    foreman_id: ''
  })
  
  const [addressComponents, setAddressComponents] = useState<any>(null)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  // Question-driven system state
  const [questionResponses, setQuestionResponses] = useState<Record<string, string>>({})
  const [currentStage, setCurrentStage] = useState('')
  const [isProcessingResponse, setIsProcessingResponse] = useState(false)

  // Use dynamic stage data
  const { 
    stages, 
    stageProgression, 
    stageNameToId, 
    questionsByStage,
    getStageById,
    getStageByName,
    getNextStage,
    getQuestionsForStage,
    isLoading: stagesLoading,
    error: stagesError,
    hasCustomStages
  } = useCompanyStages()

  useEffect(() => {
    if (user && effectiveCompany && jobId) {
      fetchJob()
    } else if (user?.role === 'site_admin' && !currentCompanyContext) {
      setIsLoading(false)
      setError('No company context selected')
    }
  }, [user, effectiveCompany, currentCompanyContext, jobId])

  // Auto-assign first stage if job doesn't have current_stage_id (for legacy jobs)
  useEffect(() => {
    if (job && !job.current_stage_id && stages.length > 0) {
      assignFirstStage()
    }
  }, [job, stages])

  // Update current stage when stages are loaded and job has no current stage
  useEffect(() => {
    if (job && !job.current_stage && stages.length > 0 && !currentStage) {
      const firstStage = stages.find(s => s.sequence_order === 1)
      if (firstStage) {
        setCurrentStage(firstStage.name)
        console.log('🎯 Default stage set to:', firstStage.name)
      }
    }
  }, [job, stages, currentStage])

  const assignFirstStage = async () => {
    try {
      const firstStage = stages.find(s => s.sequence_order === 1)
      if (!firstStage) {
        console.error('❌ No first stage found')
        return
      }
      
      console.log('🔄 Auto-assigning first stage to job:', firstStage.name)
      
      const response = await fetch(`/api/jobs/${jobId}/assign-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stage_id: firstStage.id
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Stage assigned:', result)
        // Refresh job data to show the new stage
        fetchJob()
      } else {
        console.error('❌ Failed to assign stage:', await response.text())
      }
    } catch (error) {
      console.error('❌ Error assigning stage:', error)
    }
  }

  const fetchJob = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching job for editing:', jobId)

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          current_stage:job_stages!current_stage_id (
            id,
            name,
            color,
            sequence_order
          )
        `)
        .eq('id', jobId)
        .eq('company_id', effectiveCompany?.id)
        .single()

      if (error) {
        console.error('❌ Error fetching job:', error)
        setError(error.code === 'PGRST116' ? 'Job not found' : 'Failed to load job')
        return
      }

      console.log('✅ Job loaded for editing:', data)
      setJob(data)
      
      // Initialize current stage from job data
      if (data.current_stage) {
        setCurrentStage(data.current_stage.name)
        console.log('🎯 Current stage set to:', data.current_stage.name)
      } else if (stages.length > 0) {
        // Set to first stage if no current stage set
        const firstStage = stages.find(s => s.sequence_order === 1)
        if (firstStage) {
          setCurrentStage(firstStage.name)
          console.log('🎯 Default stage set to:', firstStage.name)
        }
      }
      
      // Populate form with existing data
      setFormData({
        title: data.title || '',
        description: data.description || '',
        client_name: data.client_name || '',
        location: data.location || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        budget: data.budget ? data.budget.toString() : '',
        status: data.status || 'planning',
        foreman_id: data.foreman_id || ''
      })
      
      // Set address components if available
      if (data.address_components) {
        setAddressComponents({
          formatted: data.address_components.formatted || '',
          street: data.address_components.street,
          house_number: data.address_components.house_number,
          city: data.address_components.city,
          state: data.address_components.state,
          postcode: data.address_components.postcode,
          country: data.address_components.country
        })
      }
      
      // Set coordinates if available
      if (data.latitude && data.longitude) {
        setCoordinates({
          lat: data.latitude,
          lng: data.longitude
        })
      }
      
    } catch (err) {
      console.error('❌ Exception fetching job:', err)
      setError('Failed to load job')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    console.log('🚀 Form submission started')
    console.log('🚀 Form data:', formData)
    console.log('🚀 User:', user?.email)
    console.log('🚀 Effective company:', effectiveCompany?.id)
    
    if (!user || !effectiveCompany || !job) {
      console.log('❌ Missing requirements:', { user: !!user, effectiveCompany: !!effectiveCompany, job: !!job })
      return
    }

    if (!formData.title.trim()) {
      setError('Job title is required')
      return
    }

    setIsSubmitting(true)

    try {
      console.log('🔄 Updating job...')
      
      const jobData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        client_name: formData.client_name.trim() || null,
        location: formData.location.trim() || null,
        address_components: addressComponents || null,
        latitude: coordinates?.lat || null,
        longitude: coordinates?.lng || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        // foreman_id: formData.foreman_id || null, // Column doesn't exist in database
        updated_at: new Date().toISOString()
      }

      console.log('📝 Updating job with data:', jobData)
      console.log('📝 Using effectiveCompany:', effectiveCompany?.id)
      console.log('📝 Current job status:', job.status)
      console.log('📝 New job status:', formData.status)

      // Check if status has changed
      const statusChanged = job.status !== formData.status
      
      // First, update all job fields EXCEPT status
      console.log('🔄 Performing database update (excluding status)...')
      console.log('🔄 Update query params:', { jobId, companyId: effectiveCompany?.id })
      console.log('🔄 Final jobData for update:', jobData)
      
      const { error } = await supabase
        .from('jobs')
        .update(jobData)
        .eq('id', jobId)
        .eq('company_id', effectiveCompany.id)

      if (error) {
        console.error('❌ Error updating job:', error)
        setError(`Failed to update job: ${error.message}`)
        return
      }

      // If status has changed, update it using the safe function
      if (statusChanged) {
        console.log(`🔄 Status changed from ${job.status} to ${formData.status}, using safe function...`)
        
        // Get the current session to include auth token
        const { data: { session } } = await supabase.auth.getSession()
        
        console.log('🔍 Session:', session ? 'Present' : 'Missing')
        console.log('🔍 Access token:', session?.access_token ? 'Present' : 'Missing')
        
        const statusResponse = await fetch(`/api/jobs/${jobId}/status-history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            status: formData.status,
            notes: `Status changed via edit form from ${job.status} to ${formData.status}`
          })
        })

        if (!statusResponse.ok) {
          const statusError = await statusResponse.json()
          console.error('❌ Error updating job status:', statusError)
          setError(`Failed to update job status: ${statusError.error}`)
          return
        } else {
          const statusResult = await statusResponse.json()
          console.log('✅ Status update successful:', statusResult)
        }
      }

      console.log('✅ Job updated successfully')
      router.push(`/dashboard/jobs/${jobId}`)
      
    } catch (err) {
      console.error('❌ Exception updating job:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !effectiveCompany || !job) return
    
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)

    try {
      console.log('🔄 Deleting job...')

      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('company_id', effectiveCompany.id)

      if (error) {
        console.error('❌ Error deleting job:', error)
        setError(`Failed to delete job: ${error.message}`)
        return
      }

      console.log('✅ Job deleted successfully')
      router.push('/dashboard/jobs')
      
    } catch (err) {
      console.error('❌ Exception deleting job:', err)
      setError('Failed to delete job')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleLocationChange = (value: string, components?: any, coords?: { lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      location: value
    }))
    setAddressComponents(components || null)
    setCoordinates(coords || null)
    console.log('📍 Location updated:', { value, components, coords })
  }

  // Question-driven system handlers
  const handleQuestionResponse = async (questionId: string, response: string) => {
    setIsProcessingResponse(true)
    
    try {
      console.log(`📝 Answering question ${questionId} with: ${response}`)
      
      // Get the current session token
      const session = await supabase.auth.getSession()
      if (!session.data.session?.access_token) {
        throw new Error('No valid session found')
      }
      
      // Use the proper API endpoint for stage responses
      const apiResponse = await fetch(`/api/jobs/${jobId}/stage-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`
        },
        body: JSON.stringify({
          question_id: questionId,
          response_value: response,
          response_source: 'web_app'
        })
      })

      if (!apiResponse.ok) {
        throw new Error('Failed to save response')
      }

      const result = await apiResponse.json()
      console.log('✅ Response saved successfully:', result)
      
      // Update local state
      const updatedResponses = { ...questionResponses, [questionId]: response }
      setQuestionResponses(updatedResponses)

      // Check if the job progressed to next stage
      if (result.stage_progressed) {
        console.log('🎉 Job progressed to next stage!')
        // Refresh the job data to get updated stage
        await fetchJobData()
        // Clear question responses since we moved to next stage
        setQuestionResponses({})
      }
      
    } catch (error) {
      console.error('❌ Error processing question response:', error)
      setError('Failed to save response. Please try again.')
    } finally {
      setIsProcessingResponse(false)
    }
  }


  const isQuestionAnswered = (questionId: string) => {
    return questionResponses[questionId] !== undefined
  }

  const isQuestionEnabled = (questionId: string) => {
    // Get all questions for the current stage ordered by sequence
    const questions = getQuestionsForStage(currentStage)
    const currentQuestionIndex = questions.findIndex(q => q.id === questionId)
    
    if (currentQuestionIndex === -1) return false
    
    // First question is always enabled
    if (currentQuestionIndex === 0) return true
    
    // All previous questions must be answered
    for (let i = 0; i < currentQuestionIndex; i++) {
      if (!isQuestionAnswered(questions[i].id)) {
        return false
      }
    }
    
    return true
  }

  const getQuestionsByStage = (stage: string) => {
    // Use dynamic questions from the hook (already sorted by sequence_order)
    const questions = getQuestionsForStage(stage)
    
    // Return full question data with proper types
    return questions.map((question, index) => ({
      id: question.id,
      title: question.question_text.split('?')[0] || `Question ${index + 1}`,
      text: question.question_text,
      response_type: question.response_type,
      help_text: question.help_text,
      sequence_order: question.sequence_order
    }))
  }

  // Render input field based on question type
  const renderQuestionInput = (question: any, isEnabled: boolean, isAnswered: boolean) => {
    const currentResponse = questionResponses[question.id] || ''
    
    if (isAnswered) {
      return (
        <div className="text-green-700 font-medium">
          ✅ Answered: {currentResponse}
        </div>
      )
    }

    if (!isEnabled) {
      return (
        <p className="text-xs text-gray-500 mt-2">
          Complete previous questions first
        </p>
      )
    }

    const handleInputResponse = (value: string) => {
      handleQuestionResponse(question.id, value)
    }

    switch (question.response_type) {
      case 'yes_no':
        return (
          <div className="flex gap-3">
            <button 
              onClick={() => handleInputResponse('Yes')}
              disabled={isProcessingResponse}
              className={`px-4 py-2 rounded transition-colors ${
                !isProcessingResponse
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
            >
              {isProcessingResponse ? '...' : 'Yes'}
            </button>
            <button 
              onClick={() => handleInputResponse('No')}
              disabled={isProcessingResponse}
              className={`px-4 py-2 rounded transition-colors ${
                !isProcessingResponse
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
            >
              {isProcessingResponse ? '...' : 'No'}
            </button>
          </div>
        )

      case 'number':
        return (
          <div className="flex gap-3 items-center">
            <Input
              type="number"
              placeholder="Enter number"
              className="flex-1 max-w-xs"
              disabled={isProcessingResponse}
              id={`number-input-${question.id}`}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value
                  if (value.trim()) {
                    handleInputResponse(value.trim())
                  }
                }
              }}
            />
            <Button
              size="sm" 
              onClick={() => {
                const input = document.getElementById(`number-input-${question.id}`) as HTMLInputElement
                if (input && input.value.trim()) {
                  handleInputResponse(input.value.trim())
                }
              }}
              disabled={isProcessingResponse}
            >
              {isProcessingResponse ? '...' : 'Submit'}
            </Button>
          </div>
        )

      case 'text':
        return (
          <div className="flex gap-3 items-center">
            <Input
              type="text"
              placeholder="Enter text"
              className="flex-1 max-w-md"
              disabled={isProcessingResponse}
              id={`text-input-${question.id}`}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value
                  if (value.trim()) {
                    handleInputResponse(value.trim())
                  }
                }
              }}
            />
            <Button
              size="sm" 
              onClick={() => {
                const input = document.getElementById(`text-input-${question.id}`) as HTMLInputElement
                if (input && input.value.trim()) {
                  handleInputResponse(input.value.trim())
                }
              }}
              disabled={isProcessingResponse}
            >
              {isProcessingResponse ? '...' : 'Submit'}
            </Button>
          </div>
        )

      case 'date':
        return (
          <div className="flex gap-3 items-center">
            <Input
              type="date"
              className="flex-1 max-w-xs"
              disabled={isProcessingResponse}
              id={`date-input-${question.id}`}
              onChange={(e) => {
                const value = e.target.value
                if (value) {
                  handleInputResponse(value)
                }
              }}
            />
          </div>
        )

      case 'multiple_choice':
        // For multiple choice, we'd need the options from the question config
        return (
          <div className="text-sm text-gray-600">
            Multiple choice questions not yet implemented
          </div>
        )

      case 'file_upload':
        return (
          <div className="text-sm text-gray-600">
            File upload questions not yet implemented
          </div>
        )

      default:
        return (
          <div className="text-sm text-red-600">
            Unknown question type: {question.response_type}
          </div>
        )
    }
  }

  const canEditJob = user && (user.role === 'owner' || user.role === 'foreman' || (user.role === 'site_admin' && currentCompanyContext))

  if (!user || !canEditJob) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-gray-600">Only owners, foremen, and site administrators can edit jobs.</p>
        <Link href="/dashboard/jobs">
          <Button className="mt-4">Back to Jobs</Button>
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
        <Link href="/dashboard/jobs">
          <Button>Back to Jobs</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/jobs/${jobId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Job
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Job</h1>
          <p className="text-gray-600 mt-2">
            Update the details for "{job?.title}"
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>
                Update the information for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                    {error}
                  </div>
                )}

                {/* Job Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Kitchen Renovation Project"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description of the project scope and requirements..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Client Name */}
                <div>
                  <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name
                  </label>
                  <Input
                    id="client_name"
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => handleInputChange('client_name', e.target.value)}
                    placeholder="e.g., John Smith"
                  />
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Location
                  </label>
                  <AddressAutocomplete
                    value={formData.location}
                    onChange={handleLocationChange}
                    placeholder="Start typing an address..."
                    className="w-full"
                  />
                  {addressComponents && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-xs text-green-700">
                        ✅ Address verified: {addressComponents.city && `${addressComponents.city}, `}{addressComponents.state} {addressComponents.postcode}
                      </p>
                    </div>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => handleInputChange('start_date', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => handleInputChange('end_date', e.target.value)}
                      min={formData.start_date}
                      required
                    />
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-2">
                    Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="budget"
                      type="number"
                      step="0.01"
                      value={formData.budget}
                      onChange={(e) => handleInputChange('budget', e.target.value)}
                      placeholder="0.00"
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Foreman Assignment - Temporarily disabled: foreman_id column doesn't exist in database */}
                {/* 
                <div>
                  <label htmlFor="foreman_id" className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline mr-2" />
                    Assigned Foreman
                  </label>
                  <ForemanSelect
                    value={formData.foreman_id}
                    onChange={(value) => handleInputChange('foreman_id', value)}
                    placeholder="Select a foreman to oversee this job (optional)"
                  />
                </div>
                */}

                {/* Status */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <EditJobStatusSelect
                    value={formData.status}
                    onChange={(value) => handleInputChange('status', value)}
                    currentStage={job?.status}
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="flex-1"
                    onClick={() => console.log('📱 Update Job button clicked')}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Updating Job...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Update Job
                      </>
                    )}
                  </Button>
                  
                  <Link href={`/dashboard/jobs/${jobId}`}>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Question-Driven System */}
        {job && !job.current_stage_id && (
          <div className="mb-6">
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-700">Enable Question-Driven System</CardTitle>
                <CardDescription>
                  Migrate this job to use the new 12-stage workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                  onClick={assignFirstStage}
                >
                  ✨ Enable Question-Driven Stages
                </Button>
                <p className="text-xs text-gray-600 mt-2">
                  This will start the job at "Lead Qualification" stage with guided questions.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sidebar - Danger Zone */}
        <div>
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-700 mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-600 mt-2">
                This will permanently delete the job and all associated data.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Question-Driven Interface */}
      {job && job.current_stage_id && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Stage Questions & Progression</CardTitle>
              <CardDescription>
                Answer questions to automatically progress this job through stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Simple stage info display without duplication */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">Current Stage</h4>
                    <p className="text-sm text-blue-700">
                      This job is currently in the question-driven progression system
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-blue-900">Stage: {currentStage}</p>
                    <p className="text-xs text-blue-600">Status: {job.status}</p>
                  </div>
                </div>
              </div>
              
              {/* Interactive Questions Interface */}
              <div className="space-y-6">
                <div className="bg-white border rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Stage Questions: {currentStage}</h4>
                  
                  <div className="space-y-4">
                    {getQuestionsByStage(currentStage).map((question, index) => {
                      const isEnabled = isQuestionEnabled(question.id)
                      const isAnswered = isQuestionAnswered(question.id)
                      const response = questionResponses[question.id]
                      
                      return (
                        <div 
                          key={question.id}
                          className={`p-4 border rounded-lg ${
                            isAnswered 
                              ? 'border-green-200 bg-green-50' 
                              : isEnabled 
                                ? 'border-blue-200 bg-blue-50' 
                                : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <h5 className={`font-medium mb-2 ${
                            isAnswered 
                              ? 'text-green-900' 
                              : isEnabled 
                                ? 'text-blue-900' 
                                : 'text-gray-700'
                          }`}>
                            Question {question.sequence_order || (index + 1)}: {question.title}
                            <span className="ml-2 text-xs text-gray-500">
                              ({question.response_type || 'unknown'})
                            </span>
                          </h5>
                          <p className={`mb-3 ${
                            isAnswered 
                              ? 'text-green-700' 
                              : isEnabled 
                                ? 'text-blue-700' 
                                : 'text-gray-600'
                          }`}>
                            {question.text}
                          </p>
                          
                          {question.help_text && (
                            <p className="text-xs text-gray-500 mb-3 italic">
                              💡 {question.help_text}
                            </p>
                          )}
                          
                          <div className="mt-3">
                            {renderQuestionInput(question, isEnabled, isAnswered)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h5 className="font-medium text-yellow-800 mb-2">🚀 Stage Progression</h5>
                    <p className="text-yellow-700 text-sm">
                      Answer all questions to automatically progress to the next stage
                      {currentStage !== 'Handover & Close' && (
                        <>: <strong>
                          {currentStage === 'Lead Qualification' ? 'Initial Client Meeting' :
                           currentStage === 'Initial Client Meeting' ? 'Quote Preparation' :
                           currentStage === 'Quote Preparation' ? 'Quote Submission' :
                           currentStage === 'Quote Submission' ? 'Client Decision' :
                           currentStage === 'Client Decision' ? 'Contract & Deposit' :
                           currentStage === 'Contract & Deposit' ? 'Planning & Procurement' :
                           currentStage === 'Planning & Procurement' ? 'On-Site Preparation' :
                           currentStage === 'On-Site Preparation' ? 'Construction Execution' :
                           currentStage === 'Construction Execution' ? 'Inspections & Progress Payments' :
                           currentStage === 'Inspections & Progress Payments' ? 'Finalisation' :
                           currentStage === 'Finalisation' ? 'Handover & Close' :
                           'Complete'}
                        </strong></>
                      )}
                      {currentStage === 'Handover & Close' && (
                        <span className="text-green-600 font-medium"> - Final Stage!</span>
                      )}
                    </p>
                    
                    {Object.keys(questionResponses).length > 0 && (
                      <div className="mt-2 text-sm text-yellow-600">
                        Progress: {Object.keys(questionResponses).length} / {getQuestionsByStage(currentStage).length} questions answered
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}