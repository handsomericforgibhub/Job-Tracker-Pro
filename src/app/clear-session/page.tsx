'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ClearSessionPage() {
  const router = useRouter()

  useEffect(() => {
    const clearEverything = async () => {
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear all browser storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear any cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });

      console.log('✅ All session data cleared')
      
      // Redirect to register after a short delay
      setTimeout(() => {
        router.push('/register')
      }, 1000)
    }

    clearEverything()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Clearing session data...</p>
        <p className="text-sm text-gray-500 mt-2">Redirecting to registration...</p>
      </div>
    </div>
  )
}