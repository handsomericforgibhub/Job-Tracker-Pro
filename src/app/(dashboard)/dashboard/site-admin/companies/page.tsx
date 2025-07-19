'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { CompanyWithStats } from '@/lib/types'
import { 
  ArrowLeft,
  Building,
  Users,
  Briefcase,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Plus,
  MoreVertical,
  AlertCircle,
  Calendar,
  Activity
} from 'lucide-react'
import Link from 'next/link'

export default function CompaniesManagement() {
  const { user } = useAuthStore()
  const [companies, setCompanies] = useState<CompanyWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'user_count' | 'job_count'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'site_admin') {
      loadCompanies()
    }
  }, [user])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .rpc('get_all_companies_for_site_admin')

      if (error) throw error

      setCompanies(data || [])
    } catch (err) {
      console.error('Error loading companies:', err)
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const filteredAndSortedCompanies = companies
    .filter(company => 
      company.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: any = a[sortBy]
      let bValue: any = b[sortBy]
      
      if (sortBy === 'created_at') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const getSortIcon = (field: typeof sortBy) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? '↑' : '↓'
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
              <div key={i} className="bg-gray-200 rounded-lg h-20"></div>
            ))}
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
            <Link href="/dashboard/site-admin" className="text-gray-500 hover:text-gray-700 mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Building className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
              <p className="text-gray-600">Manage all companies across the platform</p>
            </div>
          </div>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSort('name')}
              className={`px-3 py-2 text-sm border rounded-lg ${
                sortBy === 'name' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300'
              }`}
            >
              Name {getSortIcon('name')}
            </button>
            <button
              onClick={() => handleSort('created_at')}
              className={`px-3 py-2 text-sm border rounded-lg ${
                sortBy === 'created_at' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300'
              }`}
            >
              Created {getSortIcon('created_at')}
            </button>
            <button
              onClick={() => handleSort('user_count')}
              className={`px-3 py-2 text-sm border rounded-lg ${
                sortBy === 'user_count' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300'
              }`}
            >
              Users {getSortIcon('user_count')}
            </button>
            <button
              onClick={() => handleSort('job_count')}
              className={`px-3 py-2 text-sm border rounded-lg ${
                sortBy === 'job_count' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300'
              }`}
            >
              Jobs {getSortIcon('job_count')}
            </button>
          </div>
        </div>
      </div>

      {/* Companies List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Companies ({filteredAndSortedCompanies.length})
            </h2>
            <div className="text-sm text-gray-500">
              Total: {companies.length}
            </div>
          </div>
        </div>
        
        {filteredAndSortedCompanies.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredAndSortedCompanies.map((company) => (
              <div key={company.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <Building className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {company.name}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="flex items-center text-sm text-gray-500">
                          <Users className="h-4 w-4 mr-1" />
                          {company.user_count} users
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Briefcase className="h-4 w-4 mr-1" />
                          {company.job_count} jobs
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Activity className="h-4 w-4 mr-1" />
                          {company.active_job_count} active
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(company.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link href={`/dashboard/site-admin/companies/${company.id}`}>
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye className="h-4 w-4" />
                      </button>
                    </Link>
                    <button className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? 'Try adjusting your search criteria.' 
                : 'No companies have been created yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Building className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Companies</p>
              <p className="text-xl font-semibold text-gray-900">{companies.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-xl font-semibold text-gray-900">
                {companies.reduce((sum, c) => sum + c.user_count, 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Briefcase className="h-6 w-6 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Jobs</p>
              <p className="text-xl font-semibold text-gray-900">
                {companies.reduce((sum, c) => sum + c.job_count, 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Activity className="h-6 w-6 text-orange-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Active Jobs</p>
              <p className="text-xl font-semibold text-gray-900">
                {companies.reduce((sum, c) => sum + c.active_job_count, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}