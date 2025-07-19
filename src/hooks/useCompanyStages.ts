import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useCompanyContextStore } from '@/stores/company-context-store'

export interface CompanyStage {
  id: string
  name: string
  description: string
  color: string
  sequence_order: number
  maps_to_status: string
  stage_type: string
  min_duration_hours: number
  max_duration_hours: number
  requires_approval: boolean
  company_id: string | null
  questions?: StageQuestion[]
  transitions_from?: StageTransition[]
  transitions_to?: StageTransition[]
}

export interface StageQuestion {
  id: string
  stage_id: string
  question_text: string
  response_type: string
  sequence_order: number
  help_text: string
  skip_conditions: any
}

export interface StageTransition {
  id: string
  from_stage_id: string
  to_stage_id: string
  trigger_response: string
  conditions: any
  is_automatic: boolean
}

export interface StageProgression {
  [stageName: string]: string
}

export interface StageNameToIdMapping {
  [stageName: string]: string
}

export function useCompanyStages() {
  const { user, company } = useAuthStore()
  const { currentCompanyContext } = useCompanyContextStore()
  const [stages, setStages] = useState<CompanyStage[]>([])
  const [stageProgression, setStageProgression] = useState<StageProgression>({})
  const [stageNameToId, setStageNameToId] = useState<StageNameToIdMapping>({})
  const [questionsByStage, setQuestionsByStage] = useState<Record<string, StageQuestion[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get the effective company - for site admins use context, for others use their company
  const effectiveCompany = user?.role === 'site_admin' ? currentCompanyContext : company

  const fetchStages = async () => {
    if (!effectiveCompany) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/admin/stages')
      const data = await response.json()

      if (response.ok) {
        const stageList = data.data || []
        setStages(stageList)

        // Build stage progression mapping
        const progression: StageProgression = {}
        const nameToId: StageNameToIdMapping = {}
        const questionsByStageMap: Record<string, StageQuestion[]> = {}

        // Sort stages by sequence order
        const sortedStages = [...stageList].sort((a, b) => a.sequence_order - b.sequence_order)

        // Create mappings
        sortedStages.forEach((stage, index) => {
          nameToId[stage.name] = stage.id
          
          // Set up progression to next stage
          if (index < sortedStages.length - 1) {
            progression[stage.name] = sortedStages[index + 1].name
          }

          // Map questions by stage name
          if (stage.questions) {
            questionsByStageMap[stage.name] = stage.questions.sort((a, b) => a.sequence_order - b.sequence_order)
          }
        })

        setStageProgression(progression)
        setStageNameToId(nameToId)
        setQuestionsByStage(questionsByStageMap)

      } else {
        setError(data.error || 'Failed to fetch stages')
      }
    } catch (err) {
      setError('Network error while fetching stages')
      console.error('Error fetching company stages:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user && effectiveCompany) {
      fetchStages()
    }
  }, [user, effectiveCompany])

  const getStageById = (stageId: string): CompanyStage | undefined => {
    return stages.find(stage => stage.id === stageId)
  }

  const getStageByName = (stageName: string): CompanyStage | undefined => {
    return stages.find(stage => stage.name === stageName)
  }

  const getNextStage = (currentStageName: string): CompanyStage | undefined => {
    const nextStageName = stageProgression[currentStageName]
    return nextStageName ? getStageByName(nextStageName) : undefined
  }

  const getQuestionsForStage = (stageName: string): StageQuestion[] => {
    return questionsByStage[stageName] || []
  }

  const isFirstStage = (stageName: string): boolean => {
    const stage = getStageByName(stageName)
    return stage?.sequence_order === 1
  }

  const isLastStage = (stageName: string): boolean => {
    const stage = getStageByName(stageName)
    if (!stage) return false
    return stage.sequence_order === Math.max(...stages.map(s => s.sequence_order))
  }

  const getStageTransitions = (stageId: string): StageTransition[] => {
    const stage = getStageById(stageId)
    return stage?.transitions_from || []
  }

  const copyGlobalStages = async (): Promise<boolean> => {
    if (!effectiveCompany || !user) return false

    try {
      const response = await fetch('/api/admin/stages/copy-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: effectiveCompany.id })
      })

      if (response.ok) {
        await fetchStages() // Refresh stages after copying
        return true
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to copy global stages')
        return false
      }
    } catch (err) {
      setError('Network error while copying stages')
      return false
    }
  }

  return {
    stages,
    stageProgression,
    stageNameToId,
    questionsByStage,
    isLoading,
    error,
    fetchStages,
    getStageById,
    getStageByName,
    getNextStage,
    getQuestionsForStage,
    getStageTransitions,
    isFirstStage,
    isLastStage,
    copyGlobalStages,
    hasCustomStages: stages.length > 0 && stages[0]?.company_id !== null
  }
}