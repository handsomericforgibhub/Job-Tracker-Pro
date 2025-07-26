'use client'

import { useRouter } from 'next/navigation'
import { Bell, User, LogOut, Building } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'

export default function Header() {
  const { user, company, signOut } = useAuthStore()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      // Still redirect even if sign out fails
      router.push('/login')
    }
  }

  if (!user) {
    return null
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">
            JobTracker Pro
          </h2>
          {company && (
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{company.name}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="p-2 text-gray-500 hover:text-gray-700">
            <Bell className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700">
                {user.full_name || user.email}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">{user.email}</span>
                <Badge variant="outline" className="text-xs">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}