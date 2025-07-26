'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter()
  const { user, company, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading) {
      // If no user is authenticated, redirect to login
      if (!user) {
        console.log('🔒 No user found, redirecting to login')
        router.push('/login')
        return
      }

      // If user doesn't have a company (except for site_admin), redirect to complete profile
      if (!company && user.role !== 'site_admin') {
        console.log('🏢 No company found for user, redirecting to complete profile')
        router.push('/complete-profile')
        return
      }

      // Check role permissions if allowedRoles is specified
      if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.log('🚫 User role not allowed:', user.role, 'Required:', allowedRoles)
        router.push('/dashboard') // Redirect to dashboard if role not allowed
        return
      }

      console.log('✅ Access granted to protected route')
    }
  }, [user, company, isLoading, allowedRoles, router])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Don't render children until authentication is confirmed
  if (!user) {
    return null
  }

  return <>{children}</>
}