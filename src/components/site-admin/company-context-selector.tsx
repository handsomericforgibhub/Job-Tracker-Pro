'use client'

import React, { useEffect, useState } from 'react'
import { useSiteAdminContextStore } from '@/stores/site-admin-context-store'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { SelectWithValue } from '@/components/ui/select-with-value'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Building, 
  Globe, 
  AlertCircle, 
  Loader2,
  Users,
  Briefcase
} from 'lucide-react'

interface Company {
  id: string
  name: string
  created_at: string
  user_count?: number
  job_count?: number
  active_job_count?: number
}

export default function CompanyContextSelector() {
  const { user } = useAuthStore()
  const {
    selectedCompanyId,
    availableCompanies,
    isLoading,
    error,
    setSelectedCompany,
    setAvailableCompanies,
    setLoading,
    setError,
    getContextLabel,
    getContextDescription,
    isPlatformWide
  } = useSiteAdminContextStore()

  const [localLoading, setLocalLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (user?.role === 'site_admin') {
      loadCompanies()
    }
  }, [user])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      setLocalLoading(true)
      setError(null)

      const { data: companiesData, error: companiesError } = await supabase
        .rpc('get_all_companies_for_site_admin')

      if (companiesError) throw companiesError

      const companies: Company[] = companiesData || []
      setAvailableCompanies(companies)

    } catch (err) {
      console.error('Error loading companies:', err)
      setError(err instanceof Error ? err.message : 'Failed to load companies')
    } finally {
      setLoading(false)
      setLocalLoading(false)
    }
  }

  const handleCompanyChange = (value: string) => {
    if (value === 'platform-wide') {
      setSelectedCompany(null)
    } else {
      setSelectedCompany(value)
    }
  }

  // Don't render for non-site-admins
  if (!user || user.role !== 'site_admin') {
    return null
  }

  if (localLoading && availableCompanies.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-gray-600">Loading companies...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="bg-red-50 border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Error loading companies: {error}
        </AlertDescription>
      </Alert>
    )
  }

  const selectedCompany = availableCompanies.find(c => c.id === selectedCompanyId)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            {isPlatformWide() ? (
              <Globe className="h-5 w-5 text-purple-600 mr-2" />
            ) : (
              <Building className="h-5 w-5 text-blue-600 mr-2" />
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-900">Management Context</h3>
              <p className="text-xs text-gray-500">{getContextDescription()}</p>
            </div>
          </div>

          {selectedCompany && (
            <div className="flex items-center space-x-2 ml-4">
              <div className="flex items-center text-xs text-gray-500">
                <Users className="h-3 w-3 mr-1" />
                {selectedCompany.user_count || 0} users
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <Briefcase className="h-3 w-3 mr-1" />
                {selectedCompany.job_count || 0} jobs
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Badge 
              variant={isPlatformWide() ? "default" : "secondary"}
              className={isPlatformWide() ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}
            >
              {isPlatformWide() ? (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  Platform Wide
                </>
              ) : (
                <>
                  <Building className="h-3 w-3 mr-1" />
                  Company Specific
                </>
              )}
            </Badge>
          </div>

          <SelectWithValue
            value={selectedCompanyId || 'platform-wide'}
            onValueChange={handleCompanyChange}
            placeholder="Select context..."
            disabled={isLoading}
            triggerClassName="w-64"
            options={[
              { value: 'platform-wide', label: 'Platform Wide' },
              ...availableCompanies.map(company => ({
                value: company.id,
                label: company.name
              }))
            ]}
          />
        </div>
      </div>

      {/* Context Info */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div>
            <strong>Current Context:</strong> {getContextLabel()}
          </div>
          <div>
            {isPlatformWide() ? (
              "Changes affect all companies"
            ) : (
              `Changes affect ${selectedCompany?.name} only`
            )}
          </div>
        </div>
      </div>
    </div>
  )
}