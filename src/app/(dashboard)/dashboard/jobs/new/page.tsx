'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AddressAutocomplete from '@/components/ui/address-autocomplete'
import { ArrowLeft, Save, MapPin, Users } from 'lucide-react'
import Link from 'next/link'
import ForemanSelect from '@/components/ui/foreman-select'
import { NewJobStatusSelect } from '@/components/ui/job-status-select'
import { useJobStages } from '@/hooks/useJobStages'

export default function NewJobPage() {
  const router = useRouter()
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const { getInitialStage } = useJobStages()
  
  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_name: '',
    location: '',
    start_date: '',
    end_date: '',
    budget: '',
    status: '',
    foreman_id: ''
  })

  // Set initial status when job stages are loaded
  React.useEffect(() => {
    const initialStage = getInitialStage()
    if (initialStage && !formData.status) {
      setFormData(prev => ({
        ...prev,
        status: initialStage.key
      }))
    }
  }, [getInitialStage, formData.status])
  
  const [addressComponents, setAddressComponents] = useState<any>(null)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [titleSuggestion, setTitleSuggestion] = useState('')

  // Get the first available stage ID from the database
  const getInitialStageId = async (companyId: string) => {
    try {
      // First, try to get company-specific or global stages from job_stages table
      const { data: stages, error } = await supabase
        .from('job_stages')
        .select('id, sequence_order, name, company_id')
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order('sequence_order', { ascending: true })
        .limit(1)

      if (error) {
        console.warn('Error fetching job stages:', error)
        return null
      }

      if (stages && stages.length > 0) {
        console.log('✅ Found initial stage:', stages[0])
        return stages[0].id
      }

      console.warn('⚠️ No stages found in job_stages table')
      return null
    } catch (err) {
      console.error('Exception fetching initial stage:', err)
      return null
    }
  }

  // Check for duplicate job titles and suggest alternatives
  const checkJobTitleUniqueness = async (title: string, companyId: string) => {
    try {
      const { data: existingJobs, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('company_id', companyId)
        .ilike('title', `%${title.trim()}%`)
        .limit(5)

      if (error) {
        console.warn('Error checking job title uniqueness:', error)
        return { isUnique: true, suggestions: [] }
      }

      const exactMatch = existingJobs?.find(job => 
        job.title.toLowerCase().trim() === title.toLowerCase().trim()
      )

      if (exactMatch) {
        // Generate alternative suggestions
        const baseName = title.trim()
        const now = new Date()
        const suggestions = [
          `${baseName} (${now.getFullYear()})`,
          `${baseName} - Phase 2`,
          `${baseName} - ${now.toLocaleDateString()}`,
          `${baseName} - Copy`
        ]
        
        return { isUnique: false, suggestions }
      }

      return { isUnique: true, suggestions: [] }
    } catch (err) {
      console.warn('Exception checking job title uniqueness:', err)
      return { isUnique: true, suggestions: [] }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setTitleSuggestion('')
    
    if (!user || !effectiveCompany) {
      setError('User authentication required')
      return
    }

    if (!formData.title.trim()) {
      setError('Job title is required')
      return
    }

    setIsSubmitting(true)

    // Check for duplicate job title before submitting
    const titleCheck = await checkJobTitleUniqueness(formData.title, effectiveCompany.id)
    if (!titleCheck.isUnique) {
      setError(`A job with the title "${formData.title}" already exists. Try one of these alternatives:`)
      setTitleSuggestion(titleCheck.suggestions[0] || '')
      setIsSubmitting(false)
      return
    }

    // Get the initial stage ID dynamically
    const initialStageId = await getInitialStageId(effectiveCompany.id)
    if (!initialStageId) {
      setError('Cannot create job: No valid job stages found. Please contact your administrator to set up job stages.')
      setIsSubmitting(false)
      return
    }

    try {
      console.log('🔄 Creating new job...')
      
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
        status: formData.status,
        // foreman_id: formData.foreman_id || null, // Column doesn't exist in database
        company_id: effectiveCompany.id,
        created_by: user.id,
        // Auto-assign to first available stage from database
        current_stage_id: initialStageId,
        stage_entered_at: new Date().toISOString()
      }

      console.log('📝 Job data:', jobData)

      const { data, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating job:', JSON.stringify(error, null, 2))
        
        // Parse Supabase error for user-friendly messages
        let userMessage = ''
        
        if (error.code === '23505') {
          // PostgreSQL unique violation
          if (error.details && error.details.includes('title')) {
            userMessage = `A job with the title "${formData.title}" already exists in your company. Please choose a different title.`
          } else {
            userMessage = 'A job with similar details already exists. Please modify your job details and try again.'
          }
        } else if (error.code === '23503') {
          // Foreign key violation
          userMessage = 'Invalid reference data. Please check your selections and try again.'
        } else if (error.message) {
          userMessage = `Failed to create job: ${error.message}`
        } else {
          // Fallback for unknown errors
          userMessage = 'Failed to create job. Please check all fields and try again.'
        }
        
        setError(userMessage)
        return
      }

      console.log('✅ Job created successfully:', data)
      router.push('/dashboard/jobs')
      
    } catch (err) {
      console.error('❌ Exception creating job:', JSON.stringify(err, null, 2))
      
      // Handle different types of exceptions
      if (err instanceof Error) {
        if (err.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.')
        } else if (err.message.includes('timeout')) {
          setError('Request timed out. Please try again.')
        } else {
          setError(`An error occurred: ${err.message}`)
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
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

  if (!user || (user.role !== 'owner' && user.role !== 'foreman' && !(user.role === 'site_admin' && currentCompanyContext))) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-gray-600">Only owners, foremen, and site administrators can create jobs.</p>
        <Link href="/dashboard/jobs">
          <Button className="mt-4">Back to Jobs</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/jobs">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Job</h1>
          <p className="text-gray-600 mt-2">
            Add a new construction project to your company
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <CardDescription>
            Fill in the basic information for your new project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
                {titleSuggestion && (
                  <div className="mt-2 pt-2 border-t border-red-300">
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange('title', titleSuggestion)
                        setError('')
                        setTitleSuggestion('')
                      }}
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      Use suggestion: "{titleSuggestion}"
                    </button>
                  </div>
                )}
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
                Initial Status
              </label>
              <NewJobStatusSelect
                value={formData.status}
                onChange={(value) => handleInputChange('status', value)}
                placeholder="Select initial job status"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Job...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Job
                  </>
                )}
              </Button>
              
              <Link href="/dashboard/jobs">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}