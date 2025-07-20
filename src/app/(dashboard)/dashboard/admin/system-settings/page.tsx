'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useSiteAdminContextStore } from '@/stores/site-admin-context-store'
import { STAGES_ARRAY } from '@/config/stages'
import { THEME_COLORS, SYSTEM_COLORS } from '@/config/colors'
import { RESPONSE_TYPES, RESPONSE_TYPE_CONFIG } from '@/config/constants'
import { 
  ArrowLeft,
  Database,
  AlertCircle,
  Settings,
  Globe,
  Mail,
  Shield,
  Palette,
  Construction,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Workflow,
  HelpCircle,
  ArrowRight,
  Target,
  Calendar,
  Type,
  ToggleLeft,
  Upload,
  Hash,
  Copy
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { SelectWithValue } from '@/components/ui/select-with-value'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

interface Stage {
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
  questions: Question[]
  transitions_from: Transition[]
  transitions_to: Transition[]
}

interface Question {
  id: string
  stage_id: string
  question_text: string
  response_type: string
  response_options: any
  sequence_order: number
  is_required: boolean
  skip_conditions: any
  help_text: string
  mobile_optimized: boolean
}

interface Transition {
  id: string
  from_stage_id: string
  to_stage_id: string
  trigger_response: string
  conditions: any
  is_automatic: boolean
  requires_admin_override: boolean
}

interface QuestionForm {
  question_text: string
  response_type: string
  response_options: string[]
  is_required: boolean
  help_text: string
  mobile_optimized: boolean
  transitions?: Array<{
    response_value: string
    to_stage_id: string
    is_automatic: boolean
    requires_admin_override: boolean
    numeric_operator?: string
    numeric_value?: number
    numeric_value_max?: number
  }>
}

interface TransitionForm {
  from_stage_id: string
  to_stage_id: string
  question_id: string
  trigger_response: string
  is_automatic: boolean
  requires_admin_override: boolean
}

export default function SystemSettings() {
  // Helper function for status colors - must be defined before use
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured':
        return 'bg-green-100 text-green-800'
      case 'needs_setup':
        return 'bg-red-100 text-red-800'
      case 'available':
        return 'bg-blue-100 text-blue-800'
      case 'default':
        return 'bg-gray-100 text-gray-800'
      case 'planning':
        return 'bg-blue-100 text-blue-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const { user } = useAuthStore()
  const { 
    selectedCompanyId, 
    selectedCompany, 
    isPlatformWide, 
    getContextLabel, 
    getContextDescription 
  } = useSiteAdminContextStore()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [stages, setStages] = useState<Stage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const [showNewQuestionForm, setShowNewQuestionForm] = useState<string | null>(null)
  const [showNewTransitionForm, setShowNewTransitionForm] = useState<string | null>(null)
  const [showBuilderPresetModal, setShowBuilderPresetModal] = useState(false)

  // Form states
  const [stageForm, setStageForm] = useState({
    name: '',
    description: '',
    color: SYSTEM_COLORS.INFO,
    sequence_order: 1,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 1,
    max_duration_hours: 168,
    requires_approval: false
  })

  const [questionForm, setQuestionForm] = useState<QuestionForm>({
    question_text: '',
    response_type: 'yes_no',
    response_options: [],
    is_required: true,
    help_text: '',
    mobile_optimized: true,
    transitions: []
  })

  const [transitionForm, setTransitionForm] = useState<TransitionForm>({
    from_stage_id: '',
    to_stage_id: '',
    question_id: '',
    trigger_response: '',
    is_automatic: true,
    requires_admin_override: false
  })

  const [questionEditForm, setQuestionEditForm] = useState({
    question_text: '',
    help_text: '',
    response_type: 'yes_no',
    is_required: true,
    response_options: [] as string[],
    reminder_enabled: false,
    reminder_offset_hours: 24,
    transitions: [] as Array<{
      response_value: string
      to_stage_id: string
      is_automatic: boolean
      requires_admin_override: boolean
      numeric_operator?: string
      numeric_value?: number
      numeric_value_max?: number
    }>
  })

  // Icon mapping for response types
  const iconMap = {
    'ToggleLeft': ToggleLeft,
    'Type': Type,
    'Hash': Hash,
    'Calendar': Calendar,
    'Target': Target,
    'Upload': Upload
  }

  // Use central response type configuration
  const responseTypes = RESPONSE_TYPE_CONFIG.map(config => ({
    value: config.value,
    label: config.label,
    icon: iconMap[config.iconName as keyof typeof iconMap]
  }))

  const stageTypes = [
    { value: 'standard', label: 'Standard', description: 'Regular workflow stage' },
    { value: 'milestone', label: 'Milestone', description: 'Key project checkpoint' },
    { value: 'approval', label: 'Approval', description: 'Requires approval to proceed' }
  ]

  const numericOperators = [
    { value: 'eq', label: 'equals (=)', description: 'Exactly equal to' },
    { value: 'lt', label: 'less than (<)', description: 'Strictly less than' },
    { value: 'lte', label: 'less than or equal (≤)', description: 'Less than or equal to' },
    { value: 'gt', label: 'greater than (>)', description: 'Strictly greater than' },
    { value: 'gte', label: 'greater than or equal (≥)', description: 'Greater than or equal to' },
    { value: 'between', label: 'between (inclusive)', description: 'Between two values (inclusive)' },
    { value: 'between_exclusive', label: 'between (exclusive)', description: 'Between two values (exclusive)' }
  ]

  const statusOptions = [
    { value: 'planning', label: 'Planning', color: getStatusColor('planning') },
    { value: 'active', label: 'Active', color: getStatusColor('active') },
    { value: 'on_hold', label: 'On Hold', color: getStatusColor('on_hold') },
    { value: 'completed', label: 'Completed', color: getStatusColor('completed') },
    { value: 'cancelled', label: 'Cancelled', color: getStatusColor('cancelled') }
  ]

  // Convert STAGES_ARRAY to builder preset format
  const getBuilderPresetData = () => {
    // Define comprehensive questions for each stage using central configuration
    const stageQuestions = {
      1: [
        {
          question_text: "Have you qualified this lead as a viable opportunity?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Consider budget, timeline, and project scope",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 2, is_automatic: true, requires_admin_override: false }
          ]
        },
        {
          question_text: "What is the estimated project value?",
          response_type: RESPONSE_TYPES.NUMBER,
          is_required: false,
          help_text: "Enter rough estimate in dollars",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: []
        }
      ],
      2: [
        {
          question_text: "Have you scheduled a site meeting?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Schedule an on-site meeting to assess the project",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Have you conducted the meeting?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Complete the initial site assessment meeting",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: [
            { response_value: "yes", to_stage_order: 3, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      3: [
        {
          question_text: "Have you completed the site assessment?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Detailed on-site evaluation for accurate quoting",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Are all materials and labor costs calculated?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Ensure comprehensive cost breakdown",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: [
            { response_value: "yes", to_stage_order: 4, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      4: [
        {
          question_text: "Has the quote been submitted to the client?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Quote formally sent via email or hand-delivered",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 5, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      5: [
        {
          question_text: "Has the client accepted the quote?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Client formally agreed to proceed",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 6, is_automatic: true, requires_admin_override: false },
            { response_value: "no", to_stage_order: 3, is_automatic: false, requires_admin_override: false }
          ]
        }
      ],
      6: [
        {
          question_text: "Has the deposit been received?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Confirm deposit payment has been received",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 7, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      7: [
        {
          question_text: "Have all materials been ordered?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "All required materials ordered from suppliers",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Have subcontractors been booked?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "All required subcontractors scheduled",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: [
            { response_value: "yes", to_stage_order: 8, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      8: [
        {
          question_text: "Have materials been delivered to site?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "All materials delivered and secured on site",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Is the site access ready?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Clear access for equipment and workers",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: [
            { response_value: "yes", to_stage_order: 9, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      9: [
        {
          question_text: "Has construction commenced?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Main construction work has begun",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Are there any issues or delays?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: false,
          help_text: "Track any problems during construction",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: [
            { response_value: "no", to_stage_order: 10, is_automatic: false, requires_admin_override: false }
          ]
        }
      ],
      10: [
        {
          question_text: "Have inspections been completed?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Required quality and safety inspections",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 11, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      11: [
        {
          question_text: "Are final touches complete?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "All finishing work and cleanup completed",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 12, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      12: [
        {
          question_text: "Has the project been handed over?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "Final handover to client completed",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Are final payments complete?",
          response_type: RESPONSE_TYPES.YES_NO,
          is_required: true,
          help_text: "All invoicing and payments finalized",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: []
        }
      ]
    }

    // Convert STAGES_ARRAY to builder preset format with questions
    const stages = STAGES_ARRAY.map(stage => ({
      name: stage.name,
      description: stage.description,
      color: stage.color,
      maps_to_status: stage.maps_to_status,
      stage_type: stage.stage_type,
      min_duration_hours: stage.min_duration_hours,
      max_duration_hours: stage.max_duration_hours,
      requires_approval: stage.stage_type === 'approval',
      sequence_order: stage.sequence_order,
      questions: stageQuestions[stage.sequence_order] || []
    }))

    return {
      stages
    }
  }

  useEffect(() => {
    if ((user?.role === 'owner' || user?.role === 'site_admin') && activeTab === 'stages') {
      fetchStages()
    }
    // Platform settings can be loaded immediately as they're mostly UI-based for now
  }, [user, activeTab, selectedCompanyId])

  const fetchStages = async () => {
    try {
      setIsLoading(true)
      
      // Build API URL with company context
      const apiUrl = selectedCompanyId 
        ? `/api/admin/stages?company_id=${selectedCompanyId}`
        : '/api/admin/stages'
      
      const response = await fetch(apiUrl)
      const data = await response.json()
      
      if (response.ok) {
        setStages(data.data || [])
      } else {
        setError(data.error || 'Failed to fetch stages')
      }
    } catch (err) {
      setError('Network error while fetching stages')
    } finally {
      setIsLoading(false)
    }
  }

  const saveStages = async () => {
    try {
      setIsSaving(true)
      const response = await fetch('/api/admin/stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          stages,
          company_id: selectedCompanyId 
        })
      })
      
      if (response.ok) {
        setError('')
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to save stages')
      }
    } catch (err) {
      setError('Network error while saving stages')
    } finally {
      setIsSaving(false)
    }
  }

  const addStage = async () => {
    try {
      const response = await fetch('/api/admin/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stageForm,
          sequence_order: stages.length + 1,
          company_id: selectedCompanyId
        })
      })
      
      if (response.ok) {
        setStageForm({
          name: '',
          description: '',
          color: SYSTEM_COLORS.INFO,
          sequence_order: 1,
          maps_to_status: 'planning',
          stage_type: 'standard',
          min_duration_hours: 1,
          max_duration_hours: 168,
          requires_approval: false
        })
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add stage')
      }
    } catch (err) {
      setError('Network error while adding stage')
    }
  }

  const updateStage = (stageId: string, field: string, value: any) => {
    setStages(stages.map(stage => 
      stage.id === stageId 
        ? { ...stage, [field]: value }
        : stage
    ))
  }

  const deleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage? This will also delete all associated questions and transitions.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/stages/${stageId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete stage')
      }
    } catch (err) {
      setError('Network error while deleting stage')
    }
  }

  const addQuestion = async (stageId: string) => {
    try {
      const response = await fetch('/api/admin/stages/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...questionForm,
          stage_id: stageId,
          sequence_order: (stages.find(s => s.id === stageId)?.questions.length || 0) + 1,
          response_options: questionForm.response_type === 'multiple_choice' ? 
            questionForm.response_options : null,
          company_id: selectedCompanyId
        })
      })
      
      if (response.ok) {
        const newQuestion = await response.json()
        
        // Create transitions if any were defined
        if (questionForm.transitions && questionForm.transitions.length > 0) {
          for (const transition of questionForm.transitions) {
            await fetch('/api/admin/stages/transitions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from_stage_id: stageId,
                to_stage_id: transition.to_stage_id,
                question_id: newQuestion.data.id,
                trigger_response: transition.response_value,
                is_automatic: transition.is_automatic,
                requires_admin_override: transition.requires_admin_override,
                conditions: { 
                  question_id: newQuestion.data.id,
                  numeric_operator: transition.numeric_operator,
                  numeric_value: transition.numeric_value,
                  numeric_value_max: transition.numeric_value_max
                }
              })
            })
          }
        }
        
        setQuestionForm({
          question_text: '',
          response_type: 'yes_no',
          response_options: [],
          is_required: true,
          help_text: '',
          mobile_optimized: true,
          transitions: []
        })
        setShowNewQuestionForm(null)
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add question')
      }
    } catch (err) {
      setError('Network error while adding question')
    }
  }

  const updateQuestion = async (questionId: string, updates: Partial<Question>) => {
    try {
      const response = await fetch(`/api/admin/stages/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (response.ok) {
        setEditingQuestion(null)
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update question')
      }
    } catch (err) {
      setError('Network error while updating question')
    }
  }

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/stages/questions/${questionId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete question')
      }
    } catch (err) {
      setError('Network error while deleting question')
    }
  }

  const loadBuilderPreset = async (strategy: 'delete' | 'smart' | 'archive' | 'rename' = 'delete') => {
    setIsSaving(true)
    setError('')
    
    try {
      // 1. Try deletion, then smart-clear, then archiving, then simple renaming
      let clearEndpoint = '/api/admin/stages/clear-all'
      if (strategy === 'smart') clearEndpoint = '/api/admin/stages/smart-clear'
      if (strategy === 'archive') clearEndpoint = '/api/admin/stages/archive-all'
      if (strategy === 'rename') clearEndpoint = '/api/admin/stages/simple-clear'
      
      const clearResponse = await fetch(clearEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: selectedCompanyId })
      })

      if (!clearResponse.ok) {
        const errorData = await clearResponse.json()
        console.error(`Bulk ${strategy} failed:`, errorData)
        
        // Try progressively more comprehensive approaches
        if (strategy === 'delete' && (errorData.step === 'audit_logs' || errorData.step === 'stages')) {
          console.log('Basic deletion failed due to constraints, trying smart cleanup approach...')
          return await loadBuilderPreset('smart') // Retry with smart approach
        } else if (strategy === 'smart' && errorData.step === 'final_deletion') {
          console.log('Smart deletion failed, trying archive approach...')
          return await loadBuilderPreset('archive') // Retry with archive approach
        } else if (strategy === 'archive' && errorData.step === 'archive') {
          console.log('Archive failed due to schema issues, trying simple rename approach...')
          return await loadBuilderPreset('rename') // Retry with simple rename approach
        }
        
        // Use user-friendly error message if provided, otherwise create detailed technical message
        let errorMessage
        if (errorData.userMessage) {
          errorMessage = errorData.userMessage
        } else {
          errorMessage = `Failed to clear existing stages and dependencies`
          if (errorData.step) {
            switch (errorData.step) {
              case 'audit_logs':
                errorMessage = 'Cannot delete stages that are still referenced in system audit logs. Please contact an administrator.'
                break
              case 'transitions':
                errorMessage = 'Unable to remove stage workflow connections. This may be due to data integrity issues.'
                break
              case 'questions':
                errorMessage = 'Unable to remove stage questions. This may be due to existing user responses.'
                break
              case 'stages':
                errorMessage = 'Unable to delete stages. They may still be referenced by active jobs or system logs.'
                break
              default:
                errorMessage += ` - Error in step: ${errorData.step}`
            }
          }
        }
        
        // Add technical details for debugging (but don't overwhelm the user)
        if (errorData.details && process.env.NODE_ENV === 'development') {
          errorMessage += `\n\nTechnical details (dev mode): ${JSON.stringify(errorData.details)}`
        }
        
        throw new Error(errorMessage)
      }

      // Show success message based on strategy used
      const clearData = await clearResponse.json()
      console.log(`${strategy} completed:`, clearData)
      if (strategy === 'smart' && clearData.deletedStages) {
        console.log(`Smart deleted stages: ${clearData.deletedStages.join(', ')}`)
        console.log(`Cleaned tables: ${clearData.cleanedTables?.join(', ')}`)
      } else if (strategy === 'archive' && clearData.archivedStages) {
        console.log(`Archived stages: ${clearData.archivedStages.join(', ')}`)
      } else if (strategy === 'rename' && clearData.renamedStages) {
        console.log(`Renamed stages: ${clearData.renamedStages.join(', ')}`)
      }

      // 3. Get builder preset data using central stage configuration
      const builderPresetData = getBuilderPresetData()
      
      // 4. Create stages and track their IDs for transitions
      const stageIdMap: { [order: number]: string } = {}
      
      for (const stageData of builderPresetData.stages) {
        // Create stage
        const stageResponse = await fetch('/api/admin/stages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: stageData.name,
            description: stageData.description,
            color: stageData.color,
            company_id: selectedCompanyId,
            sequence_order: stageData.sequence_order,
            maps_to_status: stageData.maps_to_status,
            stage_type: stageData.stage_type,
            min_duration_hours: stageData.min_duration_hours,
            max_duration_hours: stageData.max_duration_hours,
            requires_approval: stageData.requires_approval
          })
        })

        if (!stageResponse.ok) {
          const errorData = await stageResponse.json()
          throw new Error(`Failed to create stage: ${stageData.name} - ${errorData.error}`)
        }

        const newStage = await stageResponse.json()
        stageIdMap[stageData.sequence_order] = newStage.data.id

        // 4. Create questions for this stage
        for (const questionData of stageData.questions) {
          const questionResponse = await fetch('/api/admin/stages/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage_id: newStage.data.id,
              question_text: questionData.question_text,
              response_type: questionData.response_type,
              company_id: selectedCompanyId,
              sequence_order: questionData.sequence_order,
              is_required: questionData.is_required,
              help_text: questionData.help_text,
              mobile_optimized: questionData.mobile_optimized
            })
          })

          if (!questionResponse.ok) {
            const errorData = await questionResponse.json()
            throw new Error(`Failed to create question: ${questionData.question_text} - ${errorData.error}`)
          }

          const newQuestion = await questionResponse.json()

          // 5. Create transitions for this question
          for (const transitionData of questionData.transitions) {
            const toStageId = stageIdMap[transitionData.to_stage_order]
            
            // Skip self-transitions (stage transitioning to itself)
            if (toStageId && toStageId !== newStage.data.id) {
              const transitionResponse = await fetch('/api/admin/stages/transitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from_stage_id: newStage.data.id,
                  to_stage_id: toStageId,
                  question_id: newQuestion.data.id,
                  trigger_response: transitionData.response_value,
                  is_automatic: transitionData.is_automatic,
                  requires_admin_override: transitionData.requires_admin_override,
                  conditions: { question_id: newQuestion.data.id }
                })
              })

              if (!transitionResponse.ok) {
                const errorData = await transitionResponse.json()
                throw new Error(`Failed to create transition for question: ${questionData.question_text} - ${errorData.error}`)
              }
            } else if (toStageId === newStage.data.id) {
              console.log(`Skipped self-transition for stage ${stageData.name} on question: ${questionData.question_text}`)
            }
          }
        }
      }

      // 6. Refresh the stages data
      await fetchStages()
      setShowBuilderPresetModal(false)
      setIsSaving(false)
      
    } catch (err: any) {
      console.error('Error loading builder preset:', err)
      setError(err.message || 'Network error while loading builder preset')
      setIsSaving(false)
    }
  }

  const openQuestionEditor = (questionId: string) => {
    const question = stages
      .flatMap(s => s.questions || [])
      .find(q => q.id === questionId)
    
    if (question) {
      setQuestionEditForm({
        question_text: question.question_text,
        help_text: question.help_text || '',
        response_type: question.response_type,
        is_required: question.is_required,
        response_options: question.response_options || [],
        reminder_enabled: question.reminder_enabled || false,
        reminder_offset_hours: question.default_reminder_offset_hours || 24,
        transitions: []
      })
      setEditingQuestion(questionId)
    }
  }

  const saveQuestionChanges = async () => {
    if (!editingQuestion) return

    try {
      const updates = {
        question_text: questionEditForm.question_text,
        help_text: questionEditForm.help_text,
        response_type: questionEditForm.response_type,
        is_required: questionEditForm.is_required,
        response_options: questionEditForm.response_type === 'multiple_choice' ? 
          questionEditForm.response_options : null,
        reminder_enabled: questionEditForm.response_type === 'date' ? 
          questionEditForm.reminder_enabled : false,
        default_reminder_offset_hours: questionEditForm.response_type === 'date' ? 
          questionEditForm.reminder_offset_hours : null
      }

      const response = await fetch(`/api/admin/stages/questions/${editingQuestion}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (response.ok) {
        // Save transitions
        for (const transition of questionEditForm.transitions) {
          await fetch('/api/admin/stages/transitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from_stage_id: stages.find(s => s.questions?.some(q => q.id === editingQuestion))?.id,
              to_stage_id: transition.to_stage_id,
              question_id: editingQuestion,
              trigger_response: transition.response_value,
              is_automatic: transition.is_automatic,
              requires_admin_override: transition.requires_admin_override,
              conditions: { question_id: editingQuestion }
            })
          })
        }

        setEditingQuestion(null)
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update question')
      }
    } catch (err) {
      setError('Network error while updating question')
    }
  }

  const addResponseOption = () => {
    setQuestionEditForm({
      ...questionEditForm,
      response_options: [...questionEditForm.response_options, '']
    })
  }

  const updateResponseOption = (index: number, value: string) => {
    const newOptions = [...questionEditForm.response_options]
    newOptions[index] = value
    setQuestionEditForm({
      ...questionEditForm,
      response_options: newOptions
    })
  }

  const removeResponseOption = (index: number) => {
    setQuestionEditForm({
      ...questionEditForm,
      response_options: questionEditForm.response_options.filter((_, i) => i !== index)
    })
  }

  const addTransitionRule = () => {
    setQuestionEditForm({
      ...questionEditForm,
      transitions: [...questionEditForm.transitions, {
        response_value: '',
        to_stage_id: '',
        is_automatic: true,
        requires_admin_override: false,
        numeric_operator: 'eq',
        numeric_value: undefined,
        numeric_value_max: undefined
      }]
    })
  }

  const updateTransitionRule = (index: number, field: string, value: any) => {
    const newTransitions = [...questionEditForm.transitions]
    newTransitions[index] = { ...newTransitions[index], [field]: value }
    setQuestionEditForm({
      ...questionEditForm,
      transitions: newTransitions
    })
  }

  const removeTransitionRule = (index: number) => {
    setQuestionEditForm({
      ...questionEditForm,
      transitions: questionEditForm.transitions.filter((_, i) => i !== index)
    })
  }

  // Question form transition management
  const addQuestionFormTransitionRule = () => {
    setQuestionForm({
      ...questionForm,
      transitions: [...(questionForm.transitions || []), {
        response_value: '',
        to_stage_id: '',
        is_automatic: true,
        requires_admin_override: false,
        numeric_operator: 'eq',
        numeric_value: undefined,
        numeric_value_max: undefined
      }]
    })
  }

  const updateQuestionFormTransitionRule = (index: number, field: string, value: any) => {
    const newTransitions = [...(questionForm.transitions || [])]
    newTransitions[index] = { ...newTransitions[index], [field]: value }
    setQuestionForm({
      ...questionForm,
      transitions: newTransitions
    })
  }

  const removeQuestionFormTransitionRule = (index: number) => {
    setQuestionForm({
      ...questionForm,
      transitions: (questionForm.transitions || []).filter((_, i) => i !== index)
    })
  }

  const addTransition = async () => {
    try {
      const response = await fetch('/api/admin/stages/transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transitionForm,
          conditions: { question_id: transitionForm.question_id }
        })
      })
      
      if (response.ok) {
        setTransitionForm({
          from_stage_id: '',
          to_stage_id: '',
          question_id: '',
          trigger_response: '',
          is_automatic: true,
          requires_admin_override: false
        })
        setShowNewTransitionForm(null)
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add transition')
      }
    } catch (err) {
      setError('Network error while adding transition')
    }
  }

  const deleteTransition = async (transitionId: string) => {
    if (!confirm('Are you sure you want to delete this transition?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/stages/transitions/${transitionId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete transition')
      }
    } catch (err) {
      setError('Network error while deleting transition')
    }
  }

  const moveStage = (stageId: string, direction: 'up' | 'down') => {
    const stageIndex = stages.findIndex(s => s.id === stageId)
    if (stageIndex === -1) return

    const newIndex = direction === 'up' ? stageIndex - 1 : stageIndex + 1
    if (newIndex < 0 || newIndex >= stages.length) return

    const newStages = [...stages]
    const [movedStage] = newStages.splice(stageIndex, 1)
    newStages.splice(newIndex, 0, movedStage)

    // Update sequence orders
    newStages.forEach((stage, index) => {
      stage.sequence_order = index + 1
    })

    setStages(newStages)
  }

  const duplicateStage = (stage: Stage) => {
    const newStage = {
      ...stageForm,
      name: `${stage.name} (Copy)`,
      description: stage.description,
      color: stage.color,
      maps_to_status: stage.maps_to_status,
      stage_type: stage.stage_type,
      min_duration_hours: stage.min_duration_hours,
      max_duration_hours: stage.max_duration_hours,
      requires_approval: stage.requires_approval,
      sequence_order: stages.length + 1
    }
    setStageForm(newStage)
  }

  // Redirect if not owner or site admin
  if (!user || (user.role !== 'owner' && user.role !== 'site_admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only owners and site administrators can access system settings.</span>
          </div>
        </div>
      </div>
    )
  }

  const renderQuestionForm = (stageId: string) => (
    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
      <div className="flex items-center justify-between">
        <h5 className="font-medium text-blue-900">Add New Question</h5>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNewQuestionForm(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Question Text</Label>
          <Textarea
            value={questionForm.question_text}
            onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
            placeholder="e.g., Have you completed the site assessment?"
          />
        </div>

        <div>
          <Label>Response Type</Label>
          <SelectWithValue
            value={questionForm.response_type}
            onValueChange={(value) => setQuestionForm({ ...questionForm, response_type: value })}
            placeholder="Select response type..."
            options={responseTypes.map(type => ({
              value: type.value,
              label: type.label
            }))}
          />
        </div>

        <div>
          <Label>Help Text</Label>
          <Input
            value={questionForm.help_text}
            onChange={(e) => setQuestionForm({ ...questionForm, help_text: e.target.value })}
            placeholder="Additional guidance for users"
          />
        </div>

        {questionForm.response_type === 'multiple_choice' && (
          <div className="md:col-span-2">
            <Label>Response Options (one per line)</Label>
            <Textarea
              value={questionForm.response_options.join('\n')}
              onChange={(e) => setQuestionForm({ 
                ...questionForm, 
                response_options: e.target.value.split('\n').filter(o => o.trim()) 
              })}
              placeholder="Option 1&#10;Option 2&#10;Option 3"
            />
          </div>
        )}

        <Switch
          checked={questionForm.is_required}
          onCheckedChange={(checked) => setQuestionForm({ ...questionForm, is_required: checked })}
          label="Required"
          showLabels={true}
          onLabel="Required"
          offLabel="Optional"
        />

        <Switch
          checked={questionForm.mobile_optimized}
          onCheckedChange={(checked) => setQuestionForm({ ...questionForm, mobile_optimized: checked })}
          label="Mobile Optimized"
          showLabels={true}
          onLabel="Enabled"
          offLabel="Disabled"
        />
      </div>

      {/* Automatic Transitions Section */}
      <div className="space-y-4 mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-md font-medium text-blue-900">Automatic Transitions</h4>
            <p className="text-sm text-blue-700">Define which stage to move to based on user responses</p>
          </div>
          <Button variant="outline" size="sm" onClick={addQuestionFormTransitionRule} className="border-blue-300 text-blue-700 hover:bg-blue-100">
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-3">
          {(questionForm.transitions || []).map((transition, index) => (
            <div key={index} className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
              <div className="space-y-3">
                {/* Rule Header */}
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-800">Rule #{index + 1}</h5>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestionFormTransitionRule(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Condition and Target */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">When response is:</Label>
                    
                    {questionForm.response_type === 'yes_no' ? (
                      <SelectWithValue
                        value={transition.response_value}
                        onValueChange={(value) => updateQuestionFormTransitionRule(index, 'response_value', value)}
                        placeholder="Select Yes/No..."
                        triggerClassName="bg-gray-50 border-gray-300"
                        options={[
                          { value: "yes", label: "Yes" },
                          { value: "no", label: "No" }
                        ]}
                      />
                    ) : questionForm.response_type === 'multiple_choice' ? (
                      <SelectWithValue
                        value={transition.response_value}
                        onValueChange={(value) => updateQuestionFormTransitionRule(index, 'response_value', value)}
                        placeholder="Select option..."
                        triggerClassName="bg-gray-50 border-gray-300"
                        options={questionForm.response_options.map(option => ({
                          value: option,
                          label: option
                        }))}
                      />
                    ) : questionForm.response_type === 'number' ? (
                      <div className="space-y-2">
                        <SelectWithValue
                          value={transition.numeric_operator || 'eq'}
                          onValueChange={(value) => updateQuestionFormTransitionRule(index, 'numeric_operator', value)}
                          placeholder="Select condition..."
                          triggerClassName="bg-gray-50 border-gray-300"
                          options={numericOperators.map(op => ({
                            value: op.value,
                            label: op.label
                          }))}
                        />
                        
                        {(transition.numeric_operator === 'between' || transition.numeric_operator === 'between_exclusive') ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={transition.numeric_value || ''}
                              onChange={(e) => updateQuestionFormTransitionRule(index, 'numeric_value', parseFloat(e.target.value))}
                              placeholder="Min value"
                              className="bg-gray-50 border-gray-300"
                            />
                            <span className="text-sm text-gray-500">and</span>
                            <Input
                              type="number"
                              value={transition.numeric_value_max || ''}
                              onChange={(e) => updateQuestionFormTransitionRule(index, 'numeric_value_max', parseFloat(e.target.value))}
                              placeholder="Max value"
                              className="bg-gray-50 border-gray-300"
                            />
                          </div>
                        ) : (
                          <Input
                            type="number"
                            value={transition.numeric_value || ''}
                            onChange={(e) => updateQuestionFormTransitionRule(index, 'numeric_value', parseFloat(e.target.value))}
                            placeholder="Enter number"
                            className="bg-gray-50 border-gray-300"
                          />
                        )}
                      </div>
                    ) : (
                      <Input
                        value={transition.response_value}
                        onChange={(e) => updateQuestionFormTransitionRule(index, 'response_value', e.target.value)}
                        placeholder="Response value"
                        className="bg-gray-50 border-gray-300"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Then move to stage:</Label>
                    <SelectWithValue
                      value={transition.to_stage_id}
                      onValueChange={(value) => updateQuestionFormTransitionRule(index, 'to_stage_id', value)}
                      placeholder="Select stage..."
                      triggerClassName="bg-gray-50 border-gray-300"
                      options={stages.map(stage => ({
                        value: stage.id,
                        label: stage.name
                      }))}
                    />
                  </div>
                </div>

                {/* Settings */}
                <div className="flex items-center gap-6 pt-2 border-t border-gray-200">
                  <Switch
                    checked={transition.is_automatic}
                    onCheckedChange={(checked) => updateQuestionFormTransitionRule(index, 'is_automatic', checked)}
                    label="Automatic"
                    showLabels={true}
                    onLabel="Auto"
                    offLabel="Manual"
                  />
                  <Switch
                    checked={transition.requires_admin_override}
                    onCheckedChange={(checked) => updateQuestionFormTransitionRule(index, 'requires_admin_override', checked)}
                    label="Admin Approval"
                    showLabels={true}
                    onLabel="Required"
                    offLabel="Optional"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {(questionForm.transitions || []).length === 0 && (
          <div className="text-center py-6 bg-white rounded-lg border border-blue-200">
            <ArrowRight className="h-6 w-6 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-blue-600">No transition rules configured</p>
            <p className="text-xs text-blue-500">Add rules to automatically move jobs based on responses</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => addQuestion(stageId)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
        <Button variant="outline" onClick={() => setShowNewQuestionForm(null)}>
          Cancel
        </Button>
      </div>
    </div>
  )

  const renderTransitionForm = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId)
    const availableQuestions = stage?.questions || []

    return (
      <div className="space-y-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
        <div className="flex items-center justify-between">
          <h5 className="font-medium text-green-900">Add New Transition</h5>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewTransitionForm(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>From Stage</Label>
            <SelectWithValue
              value={transitionForm.from_stage_id}
              onValueChange={(value) => setTransitionForm({ ...transitionForm, from_stage_id: value })}
              placeholder="Select source stage"
              options={stages.map(stage => ({
                value: stage.id,
                label: stage.name
              }))}
            />
          </div>

          <div>
            <Label>To Stage</Label>
            <SelectWithValue
              value={transitionForm.to_stage_id}
              onValueChange={(value) => setTransitionForm({ ...transitionForm, to_stage_id: value })}
              placeholder="Select target stage"
              options={stages.map(stage => ({
                value: stage.id,
                label: stage.name
              }))}
            />
          </div>

          <div>
            <Label>Question</Label>
            <SelectWithValue
              value={transitionForm.question_id}
              onValueChange={(value) => setTransitionForm({ ...transitionForm, question_id: value })}
              placeholder="Select question"
              options={availableQuestions.map(question => ({
                value: question.id,
                label: question.question_text
              }))}
            />
          </div>

          <div>
            <Label>Trigger Response</Label>
            <Input
              value={transitionForm.trigger_response}
              onChange={(e) => setTransitionForm({ ...transitionForm, trigger_response: e.target.value })}
              placeholder="e.g., Yes, No, or specific value"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={transitionForm.is_automatic}
              onCheckedChange={(checked) => setTransitionForm({ ...transitionForm, is_automatic: checked })}
            />
            <Label>Automatic Transition</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={transitionForm.requires_admin_override}
              onCheckedChange={(checked) => setTransitionForm({ ...transitionForm, requires_admin_override: checked })}
            />
            <Label>Requires Admin Override</Label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={addTransition} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Transition
          </Button>
          <Button variant="outline" onClick={() => setShowNewTransitionForm(null)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const renderPlatformSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isPlatformWide ? 'Global Platform Settings' : `${selectedCompany?.name || 'Company'} Settings`}
          </h2>
          <p className="text-gray-600">
            {isPlatformWide 
              ? 'Configure platform-wide settings that affect all companies' 
              : `Configure settings specific to ${selectedCompany?.name || 'this company'}`
            }
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isPlatformWide ? "default" : "secondary"}>
            {getContextLabel()}
          </Badge>
        </div>
      </div>

      {/* Platform Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              {isPlatformWide ? 'Global' : 'Company-specific'} configuration options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              Platform settings configuration coming soon...
            </div>
            {!isPlatformWide && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Company Context:</strong> Settings here will only affect {selectedCompany?.name || 'this company'}.
                  To configure global settings, switch to "Platform Wide" view.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {isPlatformWide ? 'Platform Configuration' : 'Company Configuration'}
            </CardTitle>
            <CardDescription>
              Advanced {isPlatformWide ? 'platform' : 'company'} configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              Advanced configuration options coming soon...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderStageManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Stage Management</h2>
          <p className="text-gray-600">Configure your job progression stages, questions, and transitions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowBuilderPresetModal(true)}
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Construction className="h-4 w-4 mr-2" />
            Load Builder Preset
          </Button>
          <Button onClick={saveStages} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Add New Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Stage Name</Label>
              <Input
                value={stageForm.name}
                onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                placeholder="e.g., Lead Qualification"
              />
            </div>
            <div>
              <Label>Stage Type</Label>
              <SelectWithValue
                value={stageForm.stage_type}
                onValueChange={(value) => setStageForm({ ...stageForm, stage_type: value })}
                placeholder="Select stage type..."
                options={stageTypes.map(type => ({
                  value: type.value,
                  label: type.label
                }))}
              />
            </div>
            <div>
              <Label>Maps to Status</Label>
              <SelectWithValue
                value={stageForm.maps_to_status}
                onValueChange={(value) => setStageForm({ ...stageForm, maps_to_status: value })}
                placeholder="Select status..."
                options={statusOptions.map(status => ({
                  value: status.value,
                  label: status.label
                }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Description</Label>
              <Textarea
                value={stageForm.description}
                onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                placeholder="Brief description of this stage"
              />
            </div>
            <div className="space-y-4">
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stageForm.color}
                    onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded"
                  />
                  <Input
                    value={stageForm.color}
                    onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })}
                    placeholder={SYSTEM_COLORS.INFO}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={stageForm.requires_approval}
                  onCheckedChange={(checked) => setStageForm({ ...stageForm, requires_approval: checked })}
                />
                <Label>Requires Approval</Label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Min Duration (hours)</Label>
              <Input
                type="number"
                value={stageForm.min_duration_hours}
                onChange={(e) => setStageForm({ ...stageForm, min_duration_hours: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Max Duration (hours)</Label>
              <Input
                type="number"
                value={stageForm.max_duration_hours}
                onChange={(e) => setStageForm({ ...stageForm, max_duration_hours: parseInt(e.target.value) || 168 })}
              />
            </div>
          </div>
          <Button onClick={addStage} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Stage
          </Button>
        </CardContent>
      </Card>

      {/* Existing Stages */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : stages.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Workflow className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Stages Configured</h3>
              <p className="text-gray-600">Add your first stage to get started with job progression.</p>
            </CardContent>
          </Card>
        ) : (
          stages.map((stage, index) => (
            <Card key={stage.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                    >
                      {expandedStage === stage.id ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </Button>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-sm text-gray-500">#{index + 1}</span>
                      {editingStage === stage.id ? (
                        <Input
                          value={stage.name}
                          onChange={(e) => updateStage(stage.id, 'name', e.target.value)}
                          className="font-medium"
                        />
                      ) : (
                        <h3 className="text-lg font-medium text-gray-900">{stage.name}</h3>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{stage.maps_to_status}</Badge>
                    <Badge variant="secondary">{stage.stage_type}</Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStage(stage.id, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronDown className="h-4 w-4 rotate-180" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStage(stage.id, 'down')}
                        disabled={index === stages.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateStage(stage)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingStage(editingStage === stage.id ? null : stage.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteStage(stage.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {editingStage === stage.id && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={stage.description}
                        onChange={(e) => updateStage(stage.id, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => updateStage(stage.id, 'color', e.target.value)}
                        className="w-full h-10 border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <Label>Stage Type</Label>
                      <SelectWithValue
                        value={stage.stage_type}
                        onValueChange={(value) => updateStage(stage.id, 'stage_type', value)}
                        placeholder="Select stage type..."
                        options={stageTypes.map(type => ({
                          value: type.value,
                          label: type.label
                        }))}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={stage.requires_approval}
                        onCheckedChange={(checked) => updateStage(stage.id, 'requires_approval', checked)}
                      />
                      <Label>Requires Approval</Label>
                    </div>
                  </div>
                )}
              </CardHeader>
              
              {expandedStage === stage.id && (
                <CardContent className="space-y-6">
                  <Tabs defaultValue="questions" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="questions" className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Questions ({stage.questions?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="transitions" className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        Transitions ({stage.transitions_from?.length || 0})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="questions" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-medium text-gray-900">Stage Questions</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowNewQuestionForm(stage.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Question
                        </Button>
                      </div>

                      {showNewQuestionForm === stage.id && renderQuestionForm(stage.id)}
                      
                      {stage.questions?.length > 0 ? (
                        <div className="space-y-3">
                          {stage.questions.map((question, qIndex) => (
                            <div key={question.id} className="p-4 bg-gray-50 rounded-lg border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-medium text-gray-500">Q{qIndex + 1}</span>
                                    <Badge variant="outline">{question.response_type}</Badge>
                                    {question.is_required && (
                                      <Badge variant="secondary" className="text-xs">Required</Badge>
                                    )}
                                  </div>
                                  <p className="font-medium mb-1">{question.question_text}</p>
                                  {question.help_text && (
                                    <p className="text-sm text-gray-600 mb-2">{question.help_text}</p>
                                  )}
                                  {question.response_options && (
                                    <div className="flex flex-wrap gap-1">
                                      {question.response_options.map((option: string, idx: number) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {option}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openQuestionEditor(question.id)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteQuestion(question.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <HelpCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No questions configured for this stage</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="transitions" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-medium text-gray-900">Stage Transitions</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowNewTransitionForm(stage.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Transition
                        </Button>
                      </div>

                      {showNewTransitionForm === stage.id && renderTransitionForm(stage.id)}
                      
                      {stage.transitions_from?.length > 0 ? (
                        <div className="space-y-3">
                          {stage.transitions_from.map((transition) => {
                            const toStage = stages.find(s => s.id === transition.to_stage_id)
                            const question = stage.questions?.find(q => q.id === transition.conditions?.question_id)
                            return (
                              <div key={transition.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className="text-sm font-medium">When:</span>
                                    <Badge variant="outline" className="bg-white">
                                      {question?.question_text || 'Unknown Question'}
                                    </Badge>
                                    <span className="text-sm">= "{transition.trigger_response}"</span>
                                    <ArrowRight className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm">Go to:</span>
                                    <Badge variant="default" className="bg-blue-600">
                                      {toStage?.name}
                                    </Badge>
                                    {transition.is_automatic && (
                                      <Badge variant="secondary" className="text-xs">Auto</Badge>
                                    )}
                                    {transition.requires_admin_override && (
                                      <Badge variant="destructive" className="text-xs">Admin Override</Badge>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteTransition(transition.id)}
                                    className="text-red-600 hover:text-red-700 ml-4"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <ArrowRight className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No transitions configured from this stage</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )

  const settingsCategories = [
    {
      title: 'Job Stage Management',
      icon: Workflow,
      description: 'Configure job progression stages, questions, and transitions',
      status: 'available',
      value: `${stages.length} stages configured`,
      action: () => setActiveTab('stages')
    },
    {
      title: 'Platform Configuration',
      icon: Globe,
      description: isPlatformWide 
        ? 'Global platform settings that affect all companies' 
        : `Company-specific settings for ${selectedCompany?.name || 'this company'}`,
      status: 'configured',
      value: isPlatformWide 
        ? 'Global platform settings configured' 
        : 'Company-specific settings configured',
      action: () => setActiveTab('platform')
    },
    {
      title: 'Email & Notifications',
      icon: Mail,
      description: 'Configure email templates and notification settings',
      status: 'needs_setup',
      value: 'Using defaults'
    },
    {
      title: 'Security & Access',
      icon: Shield,
      description: 'Platform security and access control settings',
      status: 'configured',
      value: 'Password policy active'
    },
    {
      title: 'Appearance & Branding',
      icon: Palette,
      description: 'Platform visual customization',
      status: 'available',
      value: 'Theme customization available'
    }
  ]


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/dashboard/admin" className="text-gray-500 hover:text-gray-700 mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Database className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isPlatformWide ? 'System Settings' : `${selectedCompany?.name || 'Company'} Settings`}
              </h1>
              <p className="text-gray-600">
                {isPlatformWide 
                  ? 'Configure platform-wide settings and job progression' 
                  : `Configure settings and job progression for ${selectedCompany?.name || 'this company'}`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isPlatformWide ? "default" : "secondary"}>
              {getContextLabel()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('stages')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stages'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Stage Management
          </button>
          <button
            onClick={() => setActiveTab('platform')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'platform'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Platform Settings
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {settingsCategories.map((category) => (
            <Card key={category.title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={category.action}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <category.icon className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(category.status)}`}>
                    {category.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{category.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activeTab === 'stages' ? (
        renderStageManagement()
      ) : activeTab === 'platform' ? (
        renderPlatformSettings()
      ) : null}

      {/* Question Editor Modal */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Configure question details, response options, and automatic transitions based on answers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Question Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="question-text">Question Text *</Label>
                <Input
                  id="question-text"
                  value={questionEditForm.question_text}
                  onChange={(e) => setQuestionEditForm({ ...questionEditForm, question_text: e.target.value })}
                  placeholder="Enter your question"
                />
              </div>

              <div>
                <Label htmlFor="help-text">Help Text</Label>
                <Textarea
                  id="help-text"
                  value={questionEditForm.help_text}
                  onChange={(e) => setQuestionEditForm({ ...questionEditForm, help_text: e.target.value })}
                  placeholder="Optional help text to guide users"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Response Type</Label>
                  <SelectWithValue
                    value={questionEditForm.response_type}
                    onValueChange={(value) => setQuestionEditForm({ ...questionEditForm, response_type: value })}
                    placeholder="Select response type..."
                    options={responseTypes.map(type => ({
                      value: type.value,
                      label: type.label
                    }))}
                  />
                </div>

                <div className="pt-6">
                  <Switch
                    checked={questionEditForm.is_required}
                    onCheckedChange={(checked) => setQuestionEditForm({ ...questionEditForm, is_required: checked })}
                    label="Required"
                    showLabels={true}
                    onLabel="Required"
                    offLabel="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Response Options for Multiple Choice */}
            {questionEditForm.response_type === 'multiple_choice' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Response Options</Label>
                  <Button variant="outline" size="sm" onClick={addResponseOption}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2">
                  {questionEditForm.response_options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateResponseOption(index, e.target.value)}
                        placeholder="Option text"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeResponseOption(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date Question Reminders */}
            {questionEditForm.response_type === 'date' && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Switch
                  checked={questionEditForm.reminder_enabled}
                  onCheckedChange={(checked) => setQuestionEditForm({ ...questionEditForm, reminder_enabled: checked })}
                  label="Enable reminder for this date"
                  showLabels={true}
                  onLabel="Enabled"
                  offLabel="Disabled"
                />
                
                {questionEditForm.reminder_enabled && (
                  <div>
                    <Label>Remind me how many hours before the date?</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={questionEditForm.reminder_offset_hours}
                        onChange={(e) => setQuestionEditForm({ 
                          ...questionEditForm, 
                          reminder_offset_hours: parseInt(e.target.value) || 24 
                        })}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-600">hours before</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Response-Based Transitions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatic Transitions</Label>
                  <p className="text-sm text-gray-600">Define which stage to move to based on user responses</p>
                </div>
                <Button variant="outline" size="sm" onClick={addTransitionRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
              </div>

              <div className="space-y-3">
                {questionEditForm.transitions.map((transition, index) => (
                  <div key={index} className="p-6 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
                    <div className="space-y-4">
                      {/* Rule Header */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-800">Rule #{index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTransitionRule(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Condition Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">When response is:</Label>
                          
                          {questionEditForm.response_type === 'yes_no' ? (
                            <SelectWithValue
                              value={transition.response_value}
                              onValueChange={(value) => updateTransitionRule(index, 'response_value', value)}
                              placeholder="Select Yes/No..."
                              triggerClassName="bg-gray-50 border-gray-300"
                              options={[
                                { value: "yes", label: "Yes" },
                                { value: "no", label: "No" }
                              ]}
                            />
                          ) : questionEditForm.response_type === 'multiple_choice' ? (
                            <SelectWithValue
                              value={transition.response_value}
                              onValueChange={(value) => updateTransitionRule(index, 'response_value', value)}
                              placeholder="Select option..."
                              triggerClassName="bg-gray-50 border-gray-300"
                              options={questionEditForm.response_options.map(option => ({
                                value: option,
                                label: option
                              }))}
                            />
                          ) : questionEditForm.response_type === 'number' ? (
                            <div className="space-y-2">
                              <SelectWithValue
                                value={transition.numeric_operator || 'eq'}
                                onValueChange={(value) => updateTransitionRule(index, 'numeric_operator', value)}
                                placeholder="Select condition..."
                                triggerClassName="bg-gray-50 border-gray-300"
                                options={numericOperators.map(op => ({
                                  value: op.value,
                                  label: op.label
                                }))}
                              />
                              
                              {(transition.numeric_operator === 'between' || transition.numeric_operator === 'between_exclusive') ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={transition.numeric_value || ''}
                                    onChange={(e) => updateTransitionRule(index, 'numeric_value', parseFloat(e.target.value))}
                                    placeholder="Min value"
                                    className="bg-gray-50 border-gray-300"
                                  />
                                  <span className="text-sm text-gray-500">and</span>
                                  <Input
                                    type="number"
                                    value={transition.numeric_value_max || ''}
                                    onChange={(e) => updateTransitionRule(index, 'numeric_value_max', parseFloat(e.target.value))}
                                    placeholder="Max value"
                                    className="bg-gray-50 border-gray-300"
                                  />
                                </div>
                              ) : (
                                <Input
                                  type="number"
                                  value={transition.numeric_value || ''}
                                  onChange={(e) => updateTransitionRule(index, 'numeric_value', parseFloat(e.target.value))}
                                  placeholder="Enter number"
                                  className="bg-gray-50 border-gray-300"
                                />
                              )}
                            </div>
                          ) : (
                            <Input
                              value={transition.response_value}
                              onChange={(e) => updateTransitionRule(index, 'response_value', e.target.value)}
                              placeholder="Response value"
                              className="bg-gray-50 border-gray-300"
                            />
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label className="text-sm font-medium text-gray-700">Then move to stage:</Label>
                          <SelectWithValue
                            value={transition.to_stage_id}
                            onValueChange={(value) => updateTransitionRule(index, 'to_stage_id', value)}
                            placeholder="Select stage..."
                            triggerClassName="bg-gray-50 border-gray-300"
                            options={stages.map(stage => ({
                              value: stage.id,
                              label: stage.name
                            }))}
                          />
                        </div>
                      </div>

                      {/* Settings Section */}
                      <div className="flex items-center gap-6 pt-3 border-t border-gray-200">
                        <Switch
                          checked={transition.is_automatic}
                          onCheckedChange={(checked) => updateTransitionRule(index, 'is_automatic', checked)}
                          label="Automatic transition"
                          showLabels={true}
                          onLabel="Auto"
                          offLabel="Manual"
                        />
                        <Switch
                          checked={transition.requires_admin_override}
                          onCheckedChange={(checked) => updateTransitionRule(index, 'requires_admin_override', checked)}
                          label="Admin approval"
                          showLabels={true}
                          onLabel="Required"
                          offLabel="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {questionEditForm.transitions.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <ArrowRight className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No transition rules configured</p>
                  <p className="text-xs text-gray-400">Add rules to automatically move jobs to different stages based on responses</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuestion(null)}>
              Cancel
            </Button>
            <Button onClick={saveQuestionChanges} className="bg-blue-600 hover:bg-blue-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Builder Preset Confirmation Modal */}
      <Dialog open={showBuilderPresetModal} onOpenChange={setShowBuilderPresetModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-blue-600" />
              Load Builder Preset
            </DialogTitle>
            <DialogDescription>
              This will replace all current stages, questions, and transitions with a pre-configured 12-stage builder workflow.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">Warning</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This action will permanently delete all existing stages and their associated questions and transitions. This cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">The preset includes:</h4>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• 12 comprehensive stages for residential builders</li>
                <li>• Pre-configured questions for each stage</li>
                <li>• Automatic transition rules based on responses</li>
                <li>• Best practice workflow for construction projects</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuilderPresetModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={loadBuilderPreset} 
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Construction className="h-4 w-4 mr-2" />
              {isSaving ? 'Loading...' : 'Load Builder Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}