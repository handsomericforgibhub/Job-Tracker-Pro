'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import AddressAutocomplete from '@/components/ui/address-autocomplete'
import { ArrowLeft, Save, User } from 'lucide-react'
import Link from 'next/link'

export default function NewWorkerPage() {
  const router = useRouter()
  const { user, company } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    // User account info
    email: '',
    full_name: '',
    password: '',
    role: 'worker' as 'worker' | 'foreman',
    
    // Worker profile info
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
    hourly_rate: '',
    hire_date: new Date().toISOString().split('T')[0], // Today's date
    employment_status: 'active' as 'active' | 'inactive',
    notes: ''
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!user || !company) {
      setError('User authentication error')
      return
    }

    if (!formData.email.trim() || !formData.full_name.trim() || !formData.password.trim()) {
      setError('Email, full name, and password are required')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setIsSubmitting(true)

    try {
      console.log('🔄 Creating new worker account...')

      // Step 1: Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name.trim(),
            role: formData.role,
            company_id: company.id
          }
        }
      })

      if (authError) {
        console.error('❌ Error creating user account:', authError)
        setError(`Failed to create user account: ${authError.message}`)
        return
      }

      if (!authData.user) {
        setError('Failed to create user account')
        return
      }

      console.log('✅ User account created:', authData.user.id)

      // Step 2: Wait a moment for user profile trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 3: Create worker profile
      const workerData = {
        user_id: authData.user.id,
        phone: formData.phone.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone.trim() || null,
        address: formData.address.trim() || null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        hire_date: formData.hire_date || null,
        employment_status: formData.employment_status,
        notes: formData.notes.trim() || null,
        company_id: company.id
      }

      const { data: workerRecord, error: workerError } = await supabase
        .from('workers')
        .insert(workerData)
        .select()
        .single()

      if (workerError) {
        console.error('❌ Error creating worker profile:', workerError)
        setError(`Failed to create worker profile: ${workerError.message}`)
        return
      }

      console.log('✅ Worker profile created:', workerRecord.id)
      
      // Navigate to workers list
      router.push('/dashboard/workers')
      
    } catch (err) {
      console.error('❌ Exception creating worker:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canManageWorkers = user && (user.role === 'owner' || user.role === 'foreman')

  if (!user || !canManageWorkers) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600 mb-4">You don't have permission to add workers.</p>
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
        <Link href="/dashboard/workers">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workers
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Worker</h1>
          <p className="text-gray-600">Create a new team member account and profile</p>
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
              Basic login credentials and role for the new worker
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
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
              Additional information about the worker's employment and contact details
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
            <CardDescription>
              Contact information for emergencies
            </CardDescription>
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

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="employment_status" className="block text-sm font-medium text-gray-700 mb-2">
                Employment Status
              </label>
              <select
                id="employment_status"
                value={formData.employment_status}
                onChange={(e) => handleInputChange('employment_status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

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
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Worker...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Worker
              </>
            )}
          </Button>
          
          <Link href="/dashboard/workers">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}