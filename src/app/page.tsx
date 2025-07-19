'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()
  const [timeoutReached, setTimeoutReached] = useState(false)

  useEffect(() => {
    // Timeout fallback - redirect to login after 5 seconds if auth is stuck
    const timeout = setTimeout(() => {
      console.log('Auth timeout reached, redirecting to login')
      setTimeoutReached(true)
      router.push('/login')
    }, 5000)

    if (!isLoading) {
      clearTimeout(timeout)
      if (user) {
        console.log('User found, redirecting to dashboard')
        router.push('/dashboard')
      } else {
        console.log('No user, redirecting to login')
        router.push('/login')
      }
    }

    return () => clearTimeout(timeout)
  }, [user, isLoading, router])

  if (timeoutReached) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Redirecting to login...</p>
          <a href="/login" className="text-blue-600 hover:underline">
            Click here if not redirected automatically
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">
          Loading... {isLoading ? 'Checking authentication' : 'Redirecting'}
        </p>
      </div>
    </div>
  )
}
