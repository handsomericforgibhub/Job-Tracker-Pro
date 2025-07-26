import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  JOB_STATUSES, 
  JOB_STATUS_LABELS, 
  JOB_STATUS_DESCRIPTIONS,
  getAllowedJobStatusTransitions
} from '@/config/constants'
import { getStatusColor } from '@/config/colors'
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

      // Try to get company-specific job stages with safe query
      const { data: companySettings, error: companyError } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', effectiveCompany.id)
        .eq('setting_key', 'job_stages')
        .eq('is_active', true)
        .maybeSingle()

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

      // Try platform default job stages with safe query
      const { data: platformSettings, error: platformError } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'default_job_stages')
        .eq('is_active', true)
        .maybeSingle()

      console.log('Platform settings result:', { platformSettings, platformError })
      
      if (platformError) {
        console.warn('Error fetching platform settings, using hardcoded fallback:', platformError)
        // Use centralized configuration fallback stages
        setStages([
          {
            key: JOB_STATUSES.PLANNING,
            label: JOB_STATUS_LABELS[JOB_STATUSES.PLANNING],
            color: getStatusColor(JOB_STATUSES.PLANNING),
            description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.PLANNING],
            is_initial: true,
            is_final: false,
            allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.PLANNING)
          },
          {
            key: JOB_STATUSES.ACTIVE,
            label: JOB_STATUS_LABELS[JOB_STATUSES.ACTIVE],
            color: getStatusColor(JOB_STATUSES.ACTIVE),
            description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.ACTIVE],
            is_initial: false,
            is_final: false,
            allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.ACTIVE)
          },
          {
            key: JOB_STATUSES.ON_HOLD,
            label: JOB_STATUS_LABELS[JOB_STATUSES.ON_HOLD],
            color: getStatusColor(JOB_STATUSES.ON_HOLD),
            description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.ON_HOLD],
            is_initial: false,
            is_final: false,
            allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.ON_HOLD)
          },
          {
            key: JOB_STATUSES.COMPLETED,
            label: JOB_STATUS_LABELS[JOB_STATUSES.COMPLETED],
            color: getStatusColor(JOB_STATUSES.COMPLETED),
            description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.COMPLETED],
            is_initial: false,
            is_final: true,
            allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.COMPLETED)
          },
          {
            key: JOB_STATUSES.CANCELLED,
            label: JOB_STATUS_LABELS[JOB_STATUSES.CANCELLED],
            color: getStatusColor(JOB_STATUSES.CANCELLED),
            description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.CANCELLED],
            is_initial: false,
            is_final: true,
            allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.CANCELLED)
          }
        ])
        return
      }

      console.log('✅ Using platform default job stages')
      setStages((platformSettings?.setting_value as JobStage[]) || [])

    } catch (err) {
      console.error('Error fetching job stages:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch job stages')
      
      // Fallback to centralized configuration if all else fails
      setStages([
        {
          key: JOB_STATUSES.PLANNING,
          label: JOB_STATUS_LABELS[JOB_STATUSES.PLANNING],
          color: getStatusColor(JOB_STATUSES.PLANNING),
          description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.PLANNING],
          is_initial: true,
          is_final: false,
          allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.PLANNING)
        },
        {
          key: JOB_STATUSES.ACTIVE,
          label: JOB_STATUS_LABELS[JOB_STATUSES.ACTIVE],
          color: getStatusColor(JOB_STATUSES.ACTIVE),
          description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.ACTIVE],
          is_initial: false,
          is_final: false,
          allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.ACTIVE)
        },
        {
          key: JOB_STATUSES.ON_HOLD,
          label: JOB_STATUS_LABELS[JOB_STATUSES.ON_HOLD],
          color: getStatusColor(JOB_STATUSES.ON_HOLD),
          description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.ON_HOLD],
          is_initial: false,
          is_final: false,
          allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.ON_HOLD)
        },
        {
          key: JOB_STATUSES.COMPLETED,
          label: JOB_STATUS_LABELS[JOB_STATUSES.COMPLETED],
          color: getStatusColor(JOB_STATUSES.COMPLETED),
          description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.COMPLETED],
          is_initial: false,
          is_final: true,
          allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.COMPLETED)
        },
        {
          key: JOB_STATUSES.CANCELLED,
          label: JOB_STATUS_LABELS[JOB_STATUSES.CANCELLED],
          color: getStatusColor(JOB_STATUSES.CANCELLED),
          description: JOB_STATUS_DESCRIPTIONS[JOB_STATUSES.CANCELLED],
          is_initial: false,
          is_final: true,
          allowed_transitions: getAllowedJobStatusTransitions(JOB_STATUSES.CANCELLED)
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