'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { useSiteAdminContextStore } from '@/stores/site-admin-context-store'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  BarChart3,
  CreditCard,
  MessageSquare,
  Settings,
  Shield,
  ClipboardList,
  Clock,
  Building,
  ChevronRight,
  X,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['owner', 'foreman', 'worker', 'site_admin'],
  },
  {
    name: 'Jobs',
    href: '/dashboard/jobs',
    icon: Briefcase,
    roles: ['owner', 'foreman', 'worker'],
  },
  {
    name: 'My Work',
    href: '/dashboard/my-work',
    icon: ClipboardList,
    roles: ['worker', 'foreman'],
  },
  {
    name: 'Workers',
    href: '/dashboard/workers',
    icon: Users,
    roles: ['owner', 'foreman'],
  },
  {
    name: 'Documents',
    href: '/dashboard/documents',
    icon: FileText,
    roles: ['owner', 'foreman', 'worker'],
  },
  {
    name: 'Time Tracking',
    href: '/dashboard/time',
    icon: Clock,
    roles: ['owner', 'foreman', 'worker'],
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    roles: ['owner', 'foreman'],
  },
  {
    name: 'Accounting',
    href: '/dashboard/accounting',
    icon: CreditCard,
    roles: ['owner'],
  },
  {
    name: 'Collaboration',
    href: '/dashboard/collaboration',
    icon: MessageSquare,
    roles: ['owner', 'foreman', 'worker'],
  },
  {
    name: 'Subscription',
    href: '/dashboard/subscription',
    icon: Settings,
    roles: ['owner'],
  },
]

const adminNavigation = [
  {
    name: 'Platform Admin',
    href: '/dashboard/admin',
    icon: Shield,
    roles: ['owner', 'site_admin'],
  },
]

const siteAdminNavigation = [
  {
    name: 'Site Administration',
    href: '/dashboard/site-admin',
    icon: Shield,
    roles: ['site_admin'],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const { currentCompanyContext, clearCompanyContext } = useCompanyContextStore()
  const { clearSelection: clearSiteAdminContext } = useSiteAdminContextStore()

  if (!user) return null

  // Filter navigation based on role and context
  let navItems = navigation.filter(item => 
    item.roles.includes(user.role)
  )

  // For site admins, adjust navigation based on company context
  if (user.role === 'site_admin') {
    if (currentCompanyContext) {
      // When in company context, add company-specific tabs
      const companyContextNavigation = [
        {
          name: 'Jobs',
          href: '/dashboard/jobs',
          icon: Briefcase,
          roles: ['site_admin'],
        },
        {
          name: 'Workers',
          href: '/dashboard/workers',
          icon: Users,
          roles: ['site_admin'],
        },
        {
          name: 'Time Tracking',
          href: '/dashboard/time',
          icon: Clock,
          roles: ['site_admin'],
        },
        {
          name: 'Analytics',
          href: '/dashboard/analytics',
          icon: BarChart3,
          roles: ['site_admin'],
        },
      ]
      navItems = navItems.concat(companyContextNavigation)
    }
  }

  // Add admin navigation for owners and site admins
  let finalNavItems = navItems
  
  if (user.role === 'owner') {
    finalNavItems = [...navItems, ...adminNavigation]
  } else if (user.role === 'site_admin') {
    // Site admins get site admin navigation
    finalNavItems = [...navItems, ...siteAdminNavigation]
  }

  const handleClearContext = () => {
    // Clear both context stores to ensure proper synchronization
    clearCompanyContext()
    clearSiteAdminContext()
  }

  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white">
      <div className="flex items-center justify-center h-16 bg-gray-800">
        <h1 className="text-xl font-bold">JobTracker Pro</h1>
      </div>

      {/* Company Context Indicator */}
      {user.role === 'site_admin' && currentCompanyContext && (
        <div className="mx-4 mt-4 p-3 bg-blue-600 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Building className="h-4 w-4 mr-2" />
              <div>
                <p className="text-xs text-blue-100">Viewing Company:</p>
                <p className="text-sm font-medium text-white truncate">
                  {currentCompanyContext.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleClearContext}
              className="text-blue-100 hover:text-white"
              title="Exit company context"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2">
            <Link
              href="/dashboard/site-admin"
              className="text-xs text-blue-100 hover:text-white flex items-center"
            >
              <ChevronRight className="h-3 w-3 mr-1" />
              Back to Site Admin
            </Link>
          </div>
        </div>
      )}
      
      <nav className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 space-y-1">
          {finalNavItems.map((item) => {
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
          <p className="font-medium text-white">{user.email}</p>
          <p className="capitalize">{user.role}</p>
        </div>
      </div>
    </div>
  )
}