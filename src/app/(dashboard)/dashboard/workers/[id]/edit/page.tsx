'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AddressAutocomplete from '@/components/ui/address-autocomplete'
import { Worker } from '@/lib/types'
import { ArrowLeft, Save, User, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function EditWorkerPage() {
  const params = useParams()
  const router = useRouter()
  const { user, company } = useAuthStore()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  
  const workerId = params.id as string
  
  const [formData, setFormData] = useState({
    // User account info
    full_name: '',
    email: '',
    role: 'worker' as 'worker' | 'foreman' | 'owner',
    
    // Worker profile info
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
    hourly_rate: '',
    hire_date: '',
    employment_status: 'active' as 'active' | 'inactive' | 'terminated',
    notes: ''
  })

  useEffect(() => {
    if (user && company && workerId) {
      fetchWorker()
    }
  }, [user, company, workerId])

  const fetchWorker = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching worker for edit:', workerId)

      const { data, error } = await supabase
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

      if (error) {
        console.error('❌ Error fetching worker:', error)
        setError('Failed to load worker details')
        return
      }

      console.log('✅ Worker loaded for edit:', data)
      setWorker(data)
      
      // Populate form data
      setFormData({
        full_name: data.user?.full_name || '',
        email: data.user?.email || '',
        role: data.user?.role || 'worker',
        phone: data.phone || '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_phone: data.emergency_contact_phone || '',
        address: data.address || '',
        hourly_rate: data.hourly_rate ? data.hourly_rate.toString() : '',
        hire_date: data.hire_date || '',
        employment_status: data.employment_status,
        notes: data.notes || ''
      })
    } catch (err) {
      console.error('❌ Exception fetching worker:', err)
      setError('Failed to load worker details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user || !company || !worker) {
      setError('Missing required data')
      return
    }

    if (!formData.full_name.trim() || !formData.email.trim()) {
      setError('Full name and email are required')
      return
    }

    setIsSubmitting(true)

    try {
      console.log('🔄 Updating worker...')

      // Update user profile if user_id exists
      if (worker.user_id) {
        console.log('🔄 Updating user profile for user_id:', worker.user_id)
        
        // Verify we have a valid user_id
        if (!worker.user_id || typeof worker.user_id !== 'string') {
          console.error('❌ Invalid user_id:', worker.user_id)
          setError('Invalid user ID - cannot update profile')
          return
        }

        const updateData = {
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          updated_at: new Date().toISOString()
        }

        console.log('📝 User update data:', updateData)
        console.log('🎯 Targeting user ID:', worker.user_id)

        const { data: updateResult, error: userError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', worker.user_id)
          .select('id, full_name, email, role')

        if (userError) {
          console.error('❌ Error updating user profile:', userError)
          console.error('❌ User error details:', JSON.stringify(userError, null, 2))
          setError(`Failed to update user profile: ${userError.message}`)
          return
        }

        console.log('✅ User profile updated:', updateResult)
        console.log('✅ Updated record count:', updateResult?.length || 0)
        
        // Verify only one record was updated
        if (!updateResult || updateResult.length !== 1) {
          console.error('❌ Unexpected update result - expected 1 record, got:', updateResult?.length || 0)
          setError('User update affected unexpected number of records')
          return
        }
      } else {
        console.log('⚠️ No user_id found, skipping user profile update')
      }

      // Update worker profile
      const workerData = {
        phone: formData.phone.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        address: formData.address.trim() || null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        hire_date: formData.hire_date || null,
        employment_status: formData.employment_status,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { error: workerError } = await supabase
        .from('workers')
        .update(workerData)
        .eq('id', workerId)

      if (workerError) {
        console.error('❌ Error updating worker profile:', workerError)
        setError(`Failed to update worker profile: ${workerError.message}`)
        return
      }

      console.log('✅ Worker profile updated')
      
      // Navigate back to worker profile
      router.push(`/dashboard/workers/${workerId}`)
      
    } catch (err) {
      console.error('❌ Exception updating worker:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!worker) return

    const confirmMessage = `Are you sure you want to delete ${worker.user?.full_name || 'this worker'}? This action cannot be undone and will remove all job assignments and related data.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setIsDeleting(true)

    try {
      console.log('🔄 Deleting worker...')

      // Delete worker profile (this will cascade to job_assignments due to FK constraints)
      const { error: workerError } = await supabase
        .from('workers')
        .delete()
        .eq('id', workerId)

      if (workerError) {
        console.error('❌ Error deleting worker:', workerError)
        setError(`Failed to delete worker: ${workerError.message}`)
        return
      }

      // If user_id exists, optionally delete the user account too
      // Note: In production, you might want to deactivate instead of delete
      if (worker.user_id) {
        const { error: userError } = await supabase
          .from('users')
          .delete()
          .eq('id', worker.user_id)

        if (userError) {
          console.error('❌ Error deleting user account:', userError)
          // Don't fail the operation if user deletion fails
        } else {
          console.log('✅ User account deleted')
        }
      }

      console.log('✅ Worker deleted successfully')
      
      // Navigate back to workers list
      router.push('/dashboard/workers')
      
    } catch (err) {
      console.error('❌ Exception deleting worker:', err)
      setError('Failed to delete worker')
    } finally {
      setIsDeleting(false)
    }
  }

  const canManageWorkers = user && (user.role === 'owner' || user.role === 'foreman')

  if (!user || !canManageWorkers) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600 mb-4">You don't have permission to edit workers.</p>
        <Link href="/dashboard/workers">
          <Button>Back to Workers</Button>
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

  if (error && !worker) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Worker</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Link href="/dashboard/workers">
          <Button>Back to Workers</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/workers/${workerId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Worker</h1>
          <p className="text-gray-600">Update worker profile and employment details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Account Information
            </CardTitle>
            <CardDescription>
              Basic login credentials and role
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john.smith@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="worker">Worker</option>
                  <option value="foreman">Foreman</option>
                  {user.role === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>

              <div>
                <label htmlFor="employment_status" className="block text-sm font-medium text-gray-700 mb-2">
                  Employment Status *
                </label>
                <select
                  id="employment_status"
                  value={formData.employment_status}
                  onChange={(e) => handleInputChange('employment_status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Worker Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Worker Profile</CardTitle>
            <CardDescription>
              Employment and contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+61 4XX XXX XXX"
                />
              </div>

              <div>
                <label htmlFor="hourly_rate" className="block text-sm font-medium text-gray-700 mb-2">
                  Hourly Rate ($)
                </label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => handleInputChange('hourly_rate', e.target.value)}
                  placeholder="25.00"
                />
              </div>

              <div>
                <label htmlFor="hire_date" className="block text-sm font-medium text-gray-700 mb-2">
                  Hire Date
                </label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => handleInputChange('hire_date', e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <AddressAutocomplete
                  id="address"
                  value={formData.address}
                  onChange={(address) => handleInputChange('address', address)}
                  placeholder="Start typing address..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Name
                </label>
                <Input
                  id="emergency_contact_name"
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Contact Phone
                </label>
                <Input
                  id="emergency_contact_phone"
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                  placeholder="+61 4XX XXX XXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes about this worker..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-between">
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Update Worker
                </>
              )}
            </Button>
            
            <Link href={`/dashboard/workers/${workerId}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>

          {/* Delete Button */}
          {user.role === 'owner' && (
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
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
                  Delete Worker
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}