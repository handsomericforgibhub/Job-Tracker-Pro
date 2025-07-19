'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/types'

interface ForemanSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function ForemanSelect({ 
  value, 
  onChange, 
  placeholder = "Select a foreman (optional)",
  className = "",
  disabled = false
}: ForemanSelectProps) {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const [foremen, setForemen] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  const fetchForemen = useCallback(async () => {
    setIsLoading(true)
    setError('')
    
    try {
      console.log('🔄 Fetching foremen for company:', effectiveCompany?.id)
      
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('company_id', effectiveCompany?.id)
        .eq('role', 'foreman')
        .order('full_name')

      if (error) {
        console.error('❌ Error fetching foremen:', error)
        setError('Failed to load foremen')
        return
      }

      console.log('✅ Foremen loaded:', data?.length || 0)
      setForemen(data || [])
    } catch (err) {
      console.error('❌ Exception fetching foremen:', err)
      setError('Failed to load foremen')
    } finally {
      setIsLoading(false)
    }
  }, [effectiveCompany?.id])

  useEffect(() => {
    if (effectiveCompany) {
      fetchForemen()
    }
  }, [effectiveCompany, currentCompanyContext, fetchForemen])

  if (error) {
    return (
      <div className={`border border-red-300 rounded-md bg-red-50 p-2 text-red-700 text-sm ${className}`}>
        {error}
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
        disabled || isLoading ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
      } ${className}`}
    >
      <option value="">
        {isLoading ? 'Loading foremen...' : placeholder}
      </option>
      {foremen.map((foreman) => (
        <option key={foreman.id} value={foreman.id}>
          {foreman.full_name} ({foreman.email})
        </option>
      ))}
    </select>
  )
}