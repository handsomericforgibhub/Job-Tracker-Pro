import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'

export interface JobStage {
  key: string
  label: string
  color: string
  description: string
  is_initial: boolean
  is_final: boolean
  allowed_transitions: string[]
}

interface UseJobStagesReturn {
  stages: JobStage[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  getInitialStage: () => JobStage | undefined
  getFinalStages: () => JobStage[]
  getStageByKey: (key: string) => JobStage | undefined
  getAvailableTransitions: (currentStageKey: string) => JobStage[]
}

export function useJobStages(): UseJobStagesReturn {
  const [stages, setStages] = useState<JobStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  
  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  const fetchJobStages = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching job stages for company:', effectiveCompany?.id)

      if (!effectiveCompany?.id) {
        throw new Error('Company not found')
      }

      // First try to get company-specific job stages
      let companySettings = null
      let companyError = null
      
      try {
        const result = await supabase
          .from('company_settings')
          .select('setting_value')
          .eq('company_id', effectiveCompany.id)
          .eq('setting_key', 'job_stages')
          .eq('is_active', true)
          .single()
          
        companySettings = result.data
        companyError = result.error
      } catch (err) {
        console.warn('Company settings table may not exist, using fallback:', err)
        companyError = err
      }

      if (companyError && companyError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.warn('Error fetching company settings, falling back to platform defaults:', companyError)
        // Don't throw, just continue to fallback
      }
      
      console.log('Company settings result:', { companySettings, companyError })

      if (companySettings?.setting_value) {
        console.log('✅ Using company-specific job stages')
        setStages(companySettings.setting_value as JobStage[])
        return
      }

      // Fallback to platform default job stages
      let platformSettings = null
      let platformError = null
      
      try {
        const result = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'default_job_stages')
          .eq('is_active', true)
          .single()
          
        platformSettings = result.data
        platformError = result.error
      } catch (err) {
        console.warn('Platform settings table may not exist, using hardcoded fallback:', err)
        platformError = err
      }

      console.log('Platform settings result:', { platformSettings, platformError })
      
      if (platformError) {
        console.warn('Error fetching platform settings, using hardcoded fallback:', platformError)
        // Use hardcoded fallback stages
        setStages([
          {
            key: 'planning',
            label: 'Planning',
            color: '#6B7280',
            description: 'Job is in planning phase',
            is_initial: true,
            is_final: false,
            allowed_transitions: ['active', 'cancelled']
          },
          {
            key: 'active',
            label: 'Active',
            color: '#3B82F6',
            description: 'Job is actively in progress',
            is_initial: false,
            is_final: false,
            allowed_transitions: ['on_hold', 'completed', 'cancelled']
          },
          {
            key: 'on_hold',
            label: 'On Hold',
            color: '#F59E0B',
            description: 'Job is temporarily paused',
            is_initial: false,
            is_final: false,
            allowed_transitions: ['active', 'cancelled']
          },
          {
            key: 'completed',
            label: 'Completed',
            color: '#10B981',
            description: 'Job has been completed successfully',
            is_initial: false,
            is_final: true,
            allowed_transitions: []
          },
          {
            key: 'cancelled',
            label: 'Cancelled',
            color: '#EF4444',
            description: 'Job has been cancelled',
            is_initial: false,
            is_final: true,
            allowed_transitions: []
          }
        ])
        return
      }

      console.log('✅ Using platform default job stages')
      setStages((platformSettings?.setting_value as JobStage[]) || [])

    } catch (err) {
      console.error('Error fetching job stages:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch job stages')
      
      // Fallback to hardcoded stages if all else fails
      setStages([
        {
          key: 'planning',
          label: 'Planning',
          color: '#6B7280',
          description: 'Job is in planning phase',
          is_initial: true,
          is_final: false,
          allowed_transitions: ['active', 'cancelled']
        },
        {
          key: 'active',
          label: 'Active',
          color: '#3B82F6',
          description: 'Job is actively in progress',
          is_initial: false,
          is_final: false,
          allowed_transitions: ['on_hold', 'completed', 'cancelled']
        },
        {
          key: 'on_hold',
          label: 'On Hold',
          color: '#F59E0B',
          description: 'Job is temporarily paused',
          is_initial: false,
          is_final: false,
          allowed_transitions: ['active', 'cancelled']
        },
        {
          key: 'completed',
          label: 'Completed',
          color: '#10B981',
          description: 'Job has been completed successfully',
          is_initial: false,
          is_final: true,
          allowed_transitions: []
        },
        {
          key: 'cancelled',
          label: 'Cancelled',
          color: '#EF4444',
          description: 'Job has been cancelled',
          is_initial: false,
          is_final: true,
          allowed_transitions: []
        }
      ])
      console.log('✅ Using emergency hardcoded fallback stages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (effectiveCompany?.id) {
      fetchJobStages()
    }
  }, [effectiveCompany?.id, currentCompanyContext])

  const getInitialStage = (): JobStage | undefined => {
    return stages.find(stage => stage.is_initial)
  }

  const getFinalStages = (): JobStage[] => {
    return stages.filter(stage => stage.is_final)
  }

  const getStageByKey = (key: string): JobStage | undefined => {
    return stages.find(stage => stage.key === key)
  }

  const getAvailableTransitions = (currentStageKey: string): JobStage[] => {
    const currentStage = getStageByKey(currentStageKey)
    if (!currentStage) return []

    return currentStage.allowed_transitions
      .map(transitionKey => getStageByKey(transitionKey))
      .filter((stage): stage is JobStage => stage !== undefined)
  }

  return {
    stages,
    loading,
    error,
    refetch: fetchJobStages,
    getInitialStage,
    getFinalStages,
    getStageByKey,
    getAvailableTransitions
  }
}