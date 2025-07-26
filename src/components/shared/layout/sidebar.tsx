'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  BarChart3,
  Clock,
  Settings,
  Shield,
  Building,
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()
  const { user, company } = useAuthStore()

  if (!user) {
    return null
  }

  // Define navigation items based on user role
  const getNavigationItems = () => {
    const baseNavigation = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: ['site_admin', 'company_admin', 'foreman', 'worker'],
      },
      {
        name: 'Jobs',
        href: '/dashboard/jobs',
        icon: Briefcase,
        roles: ['site_admin', 'company_admin', 'foreman', 'worker'],
      },
      {
        name: 'Workers',
        href: '/dashboard/workers',
        icon: Users,
        roles: ['site_admin', 'company_admin', 'foreman'],
      },
      {
        name: 'Documents',
        href: '/dashboard/documents',
        icon: FileText,
        roles: ['site_admin', 'company_admin', 'foreman', 'worker'],
      },
      {
        name: 'Time Tracking',
        href: '/dashboard/time',
        icon: Clock,
        roles: ['site_admin', 'company_admin', 'foreman', 'worker'],
      },
      {
        name: 'Analytics',
        href: '/dashboard/analytics',
        icon: BarChart3,
        roles: ['site_admin', 'company_admin', 'foreman'],
      },
      {
        name: 'My Work',
        href: '/dashboard/my-work',
        icon: Briefcase,
        roles: ['worker'],
      },
    ]

    // Add admin-specific navigation
    if (user.role === 'company_admin') {
      baseNavigation.push({
        name: 'Admin',
        href: '/dashboard/admin',
        icon: Settings,
        roles: ['company_admin'],
      })
    }

    if (user.role === 'site_admin') {
      baseNavigation.push({
        name: 'Site Admin',
        href: '/dashboard/site-admin',
        icon: Shield,
        roles: ['site_admin'],
      })
    }

    // Filter navigation based on user role
    return baseNavigation.filter(item => item.roles.includes(user.role))
  }

  const navigation = getNavigationItems()

  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <h1 className="text-xl font-bold">JobTracker Pro</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>
      
      <div className="px-4 py-6 border-t border-gray-700">
        <div className="text-sm text-gray-400">
          <p className="font-medium text-white">{user.full_name || user.email}</p>
          <p className="capitalize">{user.role.replace('_', ' ')}</p>
          {company && (
            <div className="flex items-center mt-1 text-xs">
              <Building className="h-3 w-3 mr-1" />
              <span>{company.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}