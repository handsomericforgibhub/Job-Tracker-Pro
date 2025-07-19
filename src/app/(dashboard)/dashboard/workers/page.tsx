'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Worker } from '@/lib/types'
import { 
  Plus, 
  Search, 
  Users, 
  Phone, 
  Mail, 
  DollarSign,
  Calendar,
  UserCheck,
  UserX,
  AlertCircle,
  Settings
} from 'lucide-react'
import Link from 'next/link'

const employmentStatusConfig = {
  active: {
    label: 'Active',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: UserCheck
  },
  inactive: {
    label: 'Inactive', 
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: UserX
  },
  terminated: {
    label: 'Terminated',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: UserX
  }
}

const roleConfig = {
  owner: {
    label: 'Owner',
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  foreman: {
    label: 'Foreman',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  worker: {
    label: 'Worker',
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function WorkersPage() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'terminated'>('all')

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  useEffect(() => {
    if (user && effectiveCompany) {
      fetchWorkers()
    } else if (user?.role === 'site_admin' && !currentCompanyContext) {
      setIsLoading(false)
    }
  }, [user, effectiveCompany, currentCompanyContext])

  const fetchWorkers = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching workers for company:', effectiveCompany?.id)

      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          user:users!workers_user_id_fkey(
            full_name,
            email,
            role
          )
        `)
        .eq('company_id', effectiveCompany?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching workers:', error)
        setError('Failed to load workers')
        return
      }

      console.log('✅ Workers loaded:', data)
      setWorkers(data || [])
    } catch (err) {
      console.error('❌ Exception fetching workers:', err)
      setError('Failed to load workers')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = worker.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         worker.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || worker.employment_status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not set'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const canManageWorkers = user && (user.role === 'owner' || user.role === 'foreman' || (user.role === 'site_admin' && currentCompanyContext))

  if (!user) return null

  // Show site admin message if no company context
  if (user.role === 'site_admin' && !currentCompanyContext) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workers</h1>
            <p className="text-gray-600">Manage your team members and their assignments</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-blue-900 mb-2">No Company Context Selected</h3>
          <p className="text-blue-700 mb-4">
            As a site administrator, you need to select a company context to view workers.
          </p>
          <Link href="/dashboard/site-admin/companies">
            <Button>
              Select Company
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workers</h1>
          <p className="text-gray-600">
            Manage your team members and their assignments
            {user.role === 'site_admin' && currentCompanyContext && (
              <span className="text-blue-600"> • {currentCompanyContext.name}</span>
            )}
          </p>
        </div>
        
        {canManageWorkers && (
          <Link href="/dashboard/workers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Worker
            </Button>
          </Link>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search workers by name, email, or employee ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workers Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Workers</p>
                <p className="text-2xl font-bold text-gray-900">{workers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {workers.filter(w => w.employment_status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <UserX className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-900">
                  {workers.filter(w => w.employment_status === 'inactive').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {workers.length > 0 
                    ? formatCurrency(
                        workers
                          .filter(w => w.hourly_rate)
                          .reduce((sum, w) => sum + (w.hourly_rate || 0), 0) / 
                        workers.filter(w => w.hourly_rate).length || 0
                      )
                    : '$0'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Workers List */}
      {filteredWorkers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {workers.length === 0 ? 'No Workers Yet' : 'No Workers Found'}
            </h3>
            <p className="text-gray-600 mb-4">
              {workers.length === 0 
                ? 'Add your first team member to get started with worker management.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {canManageWorkers && workers.length === 0 && (
              <Link href="/dashboard/workers/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Worker
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkers.map(worker => {
            const statusInfo = employmentStatusConfig[worker.employment_status]
            const roleInfo = roleConfig[worker.user?.role || 'worker']
            const StatusIcon = statusInfo.icon

            return (
              <Card key={worker.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {worker.user?.full_name || 'Unknown Name'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {worker.employee_id && (
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                            ID: {worker.employee_id}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={statusInfo.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                      <Badge variant="outline" className={roleInfo.color}>
                        {roleInfo.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {worker.user?.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="truncate">{worker.user.email}</span>
                    </div>
                  )}
                  
                  {worker.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{worker.phone}</span>
                    </div>
                  )}
                  
                  {worker.hourly_rate && (
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{formatCurrency(worker.hourly_rate)}/hour</span>
                    </div>
                  )}
                  
                  {worker.hire_date && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Hired {formatDate(worker.hire_date)}</span>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Link href={`/dashboard/workers/${worker.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Profile
                      </Button>
                    </Link>
                    
                    {canManageWorkers && (
                      <Link href={`/dashboard/workers/${worker.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}