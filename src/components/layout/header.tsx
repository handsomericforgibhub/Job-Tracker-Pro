'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { LogOut, User, Bell } from 'lucide-react'

export default function Header() {
  const router = useRouter()
  const { user, company, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (!user) return null

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {company?.name || 'JobTracker Pro'}
          </h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {user.email}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}