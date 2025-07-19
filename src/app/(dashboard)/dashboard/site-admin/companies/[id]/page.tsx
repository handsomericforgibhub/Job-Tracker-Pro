'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { CompanyWithStats, SiteAdminUser, SiteAdminJob } from '@/lib/types'
import { 
  ArrowLeft,
  Building,
  Users,
  Briefcase,
  Calendar,
  Activity,
  Eye,
  Edit,
  Trash2,
  Settings,
  LogIn,
  AlertCircle,
  CheckCircle,
  Crown,
  UserCheck,
  FileText,
  Clock,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const { setCompanyContext, currentCompanyContext } = useCompanyContextStore()
  
  const companyId = params.id as string
  
  const [company, setCompany] = useState<CompanyWithStats | null>(null)
  const [users, setUsers] = useState<SiteAdminUser[]>([])
  const [jobs, setJobs] = useState<SiteAdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (user?.role === 'site_admin' && companyId) {
      loadCompanyDetails()
    }
  }, [user, companyId])

  const loadCompanyDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single()

      if (companyError) throw companyError

      // Load company statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_all_companies_for_site_admin')

      if (statsError) throw statsError

      const companyWithStats = statsData?.find((c: CompanyWithStats) => c.id === companyId)
      
      if (companyWithStats) {
        setCompany(companyWithStats)
      } else {
        setCompany({
          ...companyData,
          user_count: 0,
          job_count: 0,
          active_job_count: 0
        })
      }

      // Load company users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          company_id,
          created_at,
          updated_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      setUsers(usersData?.map(u => ({
        ...u,
        company_name: companyData.name
      })) || [])

      // Load company jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          description,
          status,
          start_date,
          end_date,
          budget,
          client_name,
          company_id,
          created_by,
          created_at,
          updated_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError

      setJobs(jobsData?.map(j => ({
        ...j,
        company_name: companyData.name
      })) || [])

    } catch (err) {
      console.error('Error loading company details:', err)
      setError(err instanceof Error ? err.message : 'Failed to load company details')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchToCompany = async () => {
    if (!company) return
    
    try {
      setSwitching(true)
      
      // Set the company context
      setCompanyContext(company)
      
      // Navigate to the main dashboard (now in company context)
      router.push('/dashboard')
      
    } catch (err) {
      console.error('Error switching to company:', err)
      setError('Failed to switch company context')
    } finally {
      setSwitching(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800'
      case 'foreman':
        return 'bg-blue-100 text-blue-800'
      case 'worker':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'planning':
        return 'bg-blue-100 text-blue-800'
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Redirect if not site admin
  if (!user || user.role !== 'site_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only site administrators can access this page.</span>
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
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-gray-200 rounded-lg h-32"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">{error || 'Company not found'}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center">
            <Link href="/dashboard/site-admin/companies" className="text-gray-500 hover:text-gray-700 mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Building className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-gray-600">Company Details and Management</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSwitchToCompany}
            disabled={switching}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50"
          >
            {switching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Switching...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Enter Company Context
              </>
            )}
          </button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      {/* Current Context Warning */}
      {currentCompanyContext && currentCompanyContext.id === company.id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-400 mr-2" />
            <span className="text-blue-800">
              You are currently viewing the platform in <strong>{currentCompanyContext.name}</strong> context
            </span>
          </div>
        </div>
      )}

      {/* Company Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{company.user_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Briefcase className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{company.job_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{company.active_job_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Created</p>
              <p className="text-lg font-bold text-gray-900">
                {new Date(company.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <p className="text-gray-900">{company.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company ID</label>
            <p className="text-gray-500 font-mono text-sm">{company.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
            <p className="text-gray-900">{new Date(company.created_at).toLocaleString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
            <p className="text-gray-900">{new Date(company.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Users ({users.length})</h2>
        </div>
        <div className="p-6">
          {users.length > 0 ? (
            <div className="space-y-4">
              {users.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {user.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">{user.full_name}</h3>
                        {user.role === 'owner' && <Crown className="h-4 w-4 text-purple-600" />}
                      </div>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {users.length > 5 && (
                <div className="text-center py-4">
                  <p className="text-gray-500">And {users.length - 5} more users...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No users found in this company</p>
            </div>
          )}
        </div>
      </div>

      {/* Jobs Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Jobs ({jobs.length})</h2>
        </div>
        <div className="p-6">
          {jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-600">
                        {job.client_name && `Client: ${job.client_name} • `}
                        {job.start_date && `Start: ${new Date(job.start_date).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(job.status)}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                    {job.budget && (
                      <span className="text-xs text-gray-500">
                        ${job.budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {jobs.length > 5 && (
                <div className="text-center py-4">
                  <p className="text-gray-500">And {jobs.length - 5} more jobs...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p>No jobs found in this company</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}