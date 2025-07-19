'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/types'
import { 
  Settings, 
  Users, 
  Briefcase, 
  Activity, 
  Shield, 
  Database,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalUsers: number
  totalCompanies: number
  totalJobs: number
  activeJobs: number
  pendingApplications: number
  systemHealth: 'healthy' | 'warning' | 'error'
}

interface AdminActivity {
  id: string
  action_type: string
  description: string
  admin_user: {
    full_name: string
    email: string
  }
  created_at: string
}

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCompanies: 0,
    totalJobs: 0,
    activeJobs: 0,
    pendingApplications: 0,
    systemHealth: 'healthy'
  })
  const [recentActivity, setRecentActivity] = useState<AdminActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.role === 'owner') {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load platform statistics
      const [usersResult, companiesResult, jobsResult, applicationsResult] = await Promise.allSettled([
        supabase.from('users').select('id').eq('company_id', user?.company_id),
        supabase.from('companies').select('id'),
        supabase.from('jobs').select('id, status').eq('company_id', user?.company_id),
        supabase.from('worker_applications').select('id').eq('status', 'pending')
      ])

      // Process results
      const users = usersResult.status === 'fulfilled' ? usersResult.value.data || [] : []
      const companies = companiesResult.status === 'fulfilled' ? companiesResult.value.data || [] : []
      const jobs = jobsResult.status === 'fulfilled' ? jobsResult.value.data || [] : []
      const applications = applicationsResult.status === 'fulfilled' ? applicationsResult.value.data || [] : []

      const activeJobs = jobs.filter(job => job.status === 'active').length

      setStats({
        totalUsers: users.length,
        totalCompanies: companies.length,
        totalJobs: jobs.length,
        activeJobs,
        pendingApplications: applications.length,
        systemHealth: 'healthy' // TODO: Implement actual health check
      })

      // Load recent admin activity (mock data for now until audit log is populated)
      setRecentActivity([
        {
          id: '1',
          action_type: 'setting_update',
          description: 'Updated job stages configuration',
          admin_user: { full_name: user?.full_name || 'Admin User', email: user?.email || '' },
          created_at: new Date().toISOString()
        }
      ])

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Redirect if not owner
  if (!user || user.role !== 'owner') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only owners can access the admin dashboard.</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const adminSections = [
    {
      title: 'Job Settings',
      description: 'Configure job stages, workflows, and status options',
      icon: Briefcase,
      href: '/dashboard/admin/job-settings',
      color: 'bg-blue-500',
      available: true
    },
    {
      title: 'User Management',
      description: 'Manage user roles, permissions, and access controls',
      icon: Users,
      href: '/dashboard/admin/user-management',
      color: 'bg-green-500',
      available: false // TODO: Implement
    },
    {
      title: 'Company Settings',
      description: 'Company-specific configuration and customization',
      icon: Settings,
      href: '/dashboard/admin/company-settings',
      color: 'bg-purple-500',
      available: false // TODO: Implement
    },
    {
      title: 'System Settings',
      description: 'Platform-wide configuration and feature toggles',
      icon: Database,
      href: '/dashboard/admin/system-settings',
      color: 'bg-orange-500',
      available: false // TODO: Implement
    },
    {
      title: 'Audit Log',
      description: 'View admin actions and system changes',
      icon: FileText,
      href: '/dashboard/admin/audit-log',
      color: 'bg-red-500',
      available: false // TODO: Implement
    },
    {
      title: 'Analytics',
      description: 'Platform usage statistics and performance metrics',
      icon: TrendingUp,
      href: '/dashboard/admin/analytics',
      color: 'bg-indigo-500',
      available: false // TODO: Implement
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="h-8 w-8 text-blue-600 mr-3" />
          Platform Administration
        </h1>
        <p className="text-gray-600 mt-1">
          Manage platform configuration, users, and system settings
        </p>
      </div>

      {/* System Status Alert */}
      <div className={`rounded-lg p-4 ${
        stats.systemHealth === 'healthy' ? 'bg-green-50 border border-green-200' :
        stats.systemHealth === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
        'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center">
          {stats.systemHealth === 'healthy' ? (
            <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
          ) : stats.systemHealth === 'warning' ? (
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          )}
          <span className={`font-medium ${
            stats.systemHealth === 'healthy' ? 'text-green-800' :
            stats.systemHealth === 'warning' ? 'text-yellow-800' :
            'text-red-800'
          }`}>
            System Status: {stats.systemHealth === 'healthy' ? 'All Systems Operational' : 
                           stats.systemHealth === 'warning' ? 'Minor Issues Detected' : 
                           'Critical Issues Detected'}
          </span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Briefcase className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeJobs}</p>
              <p className="text-xs text-gray-500">of {stats.totalJobs} total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Companies</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Apps</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingApplications}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Sections Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Administration Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => (
            <div
              key={section.title}
              className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-lg ${
                section.available ? 'hover:scale-105 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {section.available ? (
                <Link href={section.href}>
                  <div className="flex items-start">
                    <div className={`${section.color} rounded-lg p-3 mr-4`}>
                      <section.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {section.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-start">
                  <div className={`${section.color} rounded-lg p-3 mr-4`}>
                    <section.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {section.title}
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded ml-2">
                        Coming Soon
                      </span>
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {section.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Admin Activity</h2>
        </div>
        <div className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start">
                  <Activity className="h-5 w-5 text-gray-400 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.admin_user.full_name}</span>
                      {' '}{activity.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No recent admin activity to display
            </p>
          )}
        </div>
      </div>
    </div>
  )
}