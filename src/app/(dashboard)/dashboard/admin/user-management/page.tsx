'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft,
  Users,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Shield,
  AlertCircle,
  UserPlus
} from 'lucide-react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'foreman' | 'worker'
  company_id: string
  created_at: string
  updated_at: string
  company?: {
    name: string
  }
}

export default function UserManagement() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'owner') {
      loadUsers()
    }
  }, [user])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load users from the same company
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          company_id,
          created_at,
          updated_at,
          companies:company_id (
            name
          )
        `)
        .eq('company_id', user?.company_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setUsers(data || [])
    } catch (err) {
      console.error('Error loading users:', err)
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

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

  // Redirect if not owner
  if (!user || user.role !== 'owner') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only owners can manage users.</span>
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
              <div key={i} className="bg-gray-200 rounded-lg h-16"></div>
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
            <Link href="/dashboard/admin" className="text-gray-500 hover:text-gray-700 mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
            </div>
          </div>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owners</option>
                <option value="foreman">Foremen</option>
                <option value="worker">Workers</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Users ({filteredUsers.length})
          </h2>
        </div>
        
        {filteredUsers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredUsers.map((userItem) => (
              <div key={userItem.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {userItem.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {userItem.full_name}
                        </h3>
                        {userItem.id === user?.id && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{userItem.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(userItem.role)}`}>
                      {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                    </span>
                    
                    <span className="text-xs text-gray-500">
                      Joined {new Date(userItem.created_at).toLocaleDateString()}
                    </span>
                    
                    <div className="relative">
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {/* TODO: Add dropdown menu with actions */}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-600">
              {searchTerm || roleFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'No users have been added to your company yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Shield className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Feature In Development
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Full user management capabilities are coming soon! This will include:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Create and invite new users</li>
                <li>Edit user profiles and roles</li>
                <li>Deactivate or remove users</li>
                <li>Reset user passwords</li>
                <li>Manage detailed permissions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}