'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from '@/lib/types'
import { supabase } from '@/lib/supabase'

export default function CompleteProfilePage() {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<User['role']>('owner')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  
  const router = useRouter()
  const { createProfile } = useAuthStore()

  useEffect(() => {
    // Get current user email from session
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
      } else {
        router.push('/login')
      }
    }
    getCurrentUser()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }

    if (role === 'owner' && !companyName.trim()) {
      setError('Company name is required for owners')
      return
    }

    setIsLoading(true)

    try {
      console.log('🔄 Completing profile for existing user:', userEmail)
      await createProfile(fullName.trim(), role, companyName.trim() || undefined)
      router.push('/dashboard')
    } catch (err) {
      console.error('❌ Profile completion error:', err)
      const errorMessage = (err as any)?.message || 'Profile completion failed'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">JobTracker Pro</h1>
          <p className="mt-2 text-gray-600">Complete Your Profile</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Profile</CardTitle>
            <CardDescription>
              We need a few more details to set up your account
              {userEmail && (
                <span className="block mt-2 text-sm text-gray-600">
                  Account: {userEmail}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as User['role'])}
                  className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="owner">Company Owner</option>
                  <option value="foreman">Foreman</option>
                  <option value="worker">Worker</option>
                </select>
              </div>

              {role === 'owner' && (
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full"
                    placeholder="Enter your company name"
                  />
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? 'Completing profile...' : 'Complete Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}