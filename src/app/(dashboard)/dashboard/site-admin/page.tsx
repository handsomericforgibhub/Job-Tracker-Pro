'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { CompanyWithStats, PlatformStats } from '@/lib/types'
import { 
  Shield, 
  Building, 
  Users, 
  Briefcase, 
  Activity, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  UserPlus,
  Settings,
  Database,
  Globe,
  BarChart3,
  Eye,
  Edit,
  MoreVertical
} from 'lucide-react'
import Link from 'next/link'
import CompanyContextSelector from '@/components/features/site-admin/company-context-selector'
import { useSiteAdminContextStore } from '@/stores/site-admin-context-store'

export default function SiteAdminDashboard() {
  const { user } = useAuthStore()
  const { selectedCompanyId, selectedCompany, isPlatformWide, getContextLabel } = useSiteAdminContextStore()
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [stats, setStats] = useState<PlatformStats>({
    total_companies: 0,
    total_users: 0,
    total_jobs: 0,
    active_jobs: 0,
    total_workers: 0,
    recent_signups: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'site_admin') {
      loadSiteAdminData()
    }
  }, [user])

  const loadSiteAdminData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load platform statistics
      const { data: platformStats, error: statsError } = await supabase
        .rpc('get_platform_statistics')
        .single()

      if (statsError) throw statsError

      setStats(platformStats || {
        total_companies: 0,
        total_users: 0,
        total_jobs: 0,
        active_jobs: 0,
        total_workers: 0,
        recent_signups: 0
      })

      // Load companies with statistics
      const { data: companiesData, error: companiesError } = await supabase
        .rpc('get_all_companies_for_site_admin')

      if (companiesError) throw companiesError

      setCompanies(companiesData || [])

    } catch (err) {
      console.error('Error loading site admin data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Redirect if not site admin
  if (!user || user.role !== 'site_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only site administrators can access this dashboard.</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Error loading site admin data: {error}</span>
          </div>
        </div>
      </div>
    )
  }

  const getContextualDescription = (baseDescription: string, companySpecific: string) => {
    return isPlatformWide() ? baseDescription : companySpecific
  }

  const getContextualCount = (platformCount: number, companySpecific?: number) => {
    return isPlatformWide() ? platformCount : companySpecific
  }

  const adminSections = [
    {
      title: 'Company Management',
      description: getContextualDescription(
        'Manage all companies and their settings',
        'Manage this company\'s details'
      ),
      icon: Building,
      href: '/dashboard/site-admin/companies',
      color: 'bg-blue-500',
      count: isPlatformWide() ? stats.total_companies : null,
      contextTag: isPlatformWide() ? 'Platform Wide' : 'Company Specific'
    },
    {
      title: 'User Management',
      description: getContextualDescription(
        'Manage users across all companies',
        'Manage users for this company'
      ),
      icon: Users,
      href: '/dashboard/site-admin/users',
      color: 'bg-green-500',
      count: isPlatformWide() ? stats.total_users : selectedCompany?.user_count,
      contextTag: isPlatformWide() ? 'Platform Wide' : 'Company Specific'
    },
    {
      title: 'Job Management',
      description: getContextualDescription(
        'View and manage jobs across all companies',
        'View and manage jobs for this company'
      ),
      icon: Briefcase,
      href: '/dashboard/site-admin/jobs',
      color: 'bg-purple-500',
      count: isPlatformWide() ? stats.total_jobs : selectedCompany?.job_count,
      contextTag: isPlatformWide() ? 'Platform Wide' : 'Company Specific'
    },
    {
      title: 'Platform Settings',
      description: getContextualDescription(
        'Configure platform-wide settings',
        'Configure settings for this company'
      ),
      icon: Settings,
      href: '/dashboard/admin/system-settings',
      color: 'bg-orange-500',
      count: null,
      contextTag: isPlatformWide() ? 'Platform Wide' : 'Company Specific'
    },
    {
      title: 'Analytics & Reports',
      description: getContextualDescription(
        'Platform usage and performance analytics',
        'Company-specific usage and performance'
      ),
      icon: BarChart3,
      href: '/dashboard/site-admin/analytics',
      color: 'bg-indigo-500',
      count: null,
      contextTag: isPlatformWide() ? 'Platform Wide' : 'Company Specific'
    },
    {
      title: 'System Health',
      description: getContextualDescription(
        'Monitor system performance and health',
        'Monitor this company\'s system data'
      ),
      icon: Database,
      href: '/dashboard/site-admin/health',
      color: 'bg-red-500',
      count: null,
      contextTag: isPlatformWide() ? 'Platform Wide' : 'Company Specific'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Site Administration</h1>
              <p className="text-gray-600">
                {isPlatformWide() 
                  ? 'Cross-company platform management and oversight'
                  : `Managing ${selectedCompany?.name || 'selected company'}`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
              <Globe className="h-4 w-4 mr-1" />
              Site Admin
            </div>
          </div>
        </div>
      </div>

      {/* Company Context Selector */}
      <CompanyContextSelector />

      {/* System Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
          <span className="text-green-800 font-medium">System Status: All Systems Operational</span>
        </div>
      </div>

      {/* Platform Statistics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {isPlatformWide() ? 'Platform Overview' : `${selectedCompany?.name} Overview`}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Companies</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_companies}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
                <p className="text-xs text-gray-500">Workers: {stats.total_workers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Briefcase className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_jobs}</p>
                <p className="text-xs text-gray-500">Active: {stats.active_jobs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_jobs}</p>
                <p className="text-xs text-gray-500">
                  {stats.total_jobs > 0 ? Math.round((stats.active_jobs / stats.total_jobs) * 100) : 0}% of total
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <UserPlus className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Signups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.recent_signups}</p>
                <p className="text-xs text-gray-500">Last 7 days</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Platform Health</p>
                <p className="text-2xl font-bold text-green-600">100%</p>
                <p className="text-xs text-gray-500">All systems operational</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Sections */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Administration Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-lg shadow p-6 transition-all hover:shadow-lg hover:scale-105 cursor-pointer"
            >
              <Link href={section.href}>
                <div className="flex items-start">
                  <div className={`${section.color} rounded-lg p-3 mr-4`}>
                    <section.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {section.title}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isPlatformWide() 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {section.contextTag}
                        </span>
                      </div>
                      {section.count !== null && section.count !== undefined && (
                        <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {section.count}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-2">
                      {section.description}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Companies */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isPlatformWide() ? 'Companies' : `${selectedCompany?.name} Details`}
            </h2>
            <Link href="/dashboard/site-admin/companies">
              <button className="text-blue-600 hover:text-blue-800 text-sm">
                View All →
              </button>
            </Link>
          </div>
        </div>
        <div className="p-6">
          {companies.length > 0 ? (
            <div className="space-y-4">
              {companies.slice(0, 5).map((company) => (
                <div key={company.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <Building className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{company.name}</h3>
                      <p className="text-xs text-gray-500">
                        {company.user_count} users • {company.job_count} jobs • {company.active_job_count} active
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link href={`/dashboard/site-admin/companies/${company.id}`}>
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <Eye className="h-4 w-4" />
                      </button>
                    </Link>
                    <button className="p-2 text-gray-400 hover:bg-gray-50 rounded">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No companies found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}