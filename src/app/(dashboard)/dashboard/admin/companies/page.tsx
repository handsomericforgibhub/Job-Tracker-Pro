'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Building, 
  Users, 
  Search,
  Plus,
  ArrowLeft,
  MapPin,
  Calendar,
  Settings,
  TrendingUp,
  Eye,
  Edit
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Company {
  id: string
  name: string
  status: 'active' | 'inactive' | 'trial'
  users_count: number
  jobs_count: number
  created_at: string
  location: string
  subscription_plan: string
}

export default function AdminCompaniesPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Simulate loading companies data
    setTimeout(() => {
      const mockCompanies: Company[] = [
        {
          id: '1',
          name: 'ABC Construction',
          status: 'active',
          users_count: 25,
          jobs_count: 12,
          created_at: '2024-01-15',
          location: 'New York, NY',
          subscription_plan: 'Pro'
        },
        {
          id: '2', 
          name: 'BuildRight LLC',
          status: 'active',
          users_count: 18,
          jobs_count: 8,
          created_at: '2024-02-20',
          location: 'Los Angeles, CA',
          subscription_plan: 'Basic'
        },
        {
          id: '3',
          name: 'Premier Contractors',
          status: 'trial',
          users_count: 5,
          jobs_count: 2,
          created_at: '2024-07-10',
          location: 'Chicago, IL',
          subscription_plan: 'Trial'
        },
        {
          id: '4',
          name: 'Elite Builders',
          status: 'inactive',
          users_count: 0,
          jobs_count: 0,
          created_at: '2024-03-05',
          location: 'Houston, TX',
          subscription_plan: 'Basic'
        }
      ]
      setCompanies(mockCompanies)
      setIsLoading(false)
    }, 1000)
  }, [])

  // Check if user has admin access
  if (!user || user.role !== 'site_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'trial':
        return 'bg-yellow-100 text-yellow-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'Pro':
        return 'bg-purple-100 text-purple-800'
      case 'Basic':
        return 'bg-blue-100 text-blue-800'
      case 'Trial':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Companies</h1>
            <p className="text-gray-600">
              Platform administration • Company management
            </p>
          </div>
        </div>
        <Button className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.filter(c => c.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((companies.filter(c => c.status === 'active').length / companies.length) * 100)}% active rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + c.users_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all companies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Companies</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.filter(c => c.status === 'trial').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>
            Manage all companies on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Companies List */}
          <div className="space-y-4">
            {isLoading ? (
              // Loading skeleton
              [...Array(4)].map((_, index) => (
                <div key={index} className="p-6 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-gray-200 rounded animate-pulse"></div>
                      <div>
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    </div>
                    <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ))
            ) : filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <div key={company.id} className="p-6 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold">{company.name}</h3>
                          <Badge className={getStatusColor(company.status)}>
                            {company.status}
                          </Badge>
                          <Badge className={getPlanColor(company.subscription_plan)}>
                            {company.subscription_plan}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {company.location}
                          </div>
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {company.users_count} users
                          </div>
                          <div className="flex items-center">
                            <Building className="h-4 w-4 mr-1" />
                            {company.jobs_count} jobs
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(company.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // TODO: Implement company view
                          alert(`Viewing ${company.name}...`)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // TODO: Implement company edit
                          alert(`Editing ${company.name}...`)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No companies found</p>
                <p className="text-sm">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}