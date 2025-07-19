'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { 
  ArrowLeft,
  Database,
  AlertCircle,
  Settings,
  Globe,
  Mail,
  FileText,
  Shield,
  Clock,
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
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  questions: Question[]
  transitions_from: Transition[]
  transitions_to: Transition[]
}

interface Question {
  id: string
  stage_id: string
  question_text: string
  response_type: string
  sequence_order: number
  help_text: string
  skip_conditions: any
}

interface Transition {
  id: string
  from_stage_id: string
  to_stage_id: string
  trigger_response: string
  conditions: any
  is_automatic: boolean
}

export default function SystemSettings() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [stages, setStages] = useState<Stage[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)

  // Form states
  const [stageForm, setStageForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    sequence_order: 1,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 1,
    max_duration_hours: 168
  })

  const [questionForm, setQuestionForm] = useState({
    stage_id: '',
    question_text: '',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: '',
    skip_conditions: {}
  })

  useEffect(() => {
    if ((user?.role === 'owner' || user?.role === 'site_admin') && activeTab === 'stages') {
      fetchStages()
    }
  }, [user, activeTab])

  const fetchStages = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/stages')
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
        body: JSON.stringify({ stages })
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
          sequence_order: stages.length + 1
        })
      })
      
      if (response.ok) {
        setStageForm({
          name: '',
          description: '',
          color: '#3B82F6',
          sequence_order: 1,
          maps_to_status: 'planning',
          stage_type: 'standard',
          min_duration_hours: 1,
          max_duration_hours: 168
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

  const addQuestion = async (stageId: string) => {
    try {
      const response = await fetch('/api/admin/stages/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...questionForm,
          stage_id: stageId,
          sequence_order: (stages.find(s => s.id === stageId)?.questions.length || 0) + 1
        })
      })
      
      if (response.ok) {
        setQuestionForm({
          stage_id: '',
          question_text: '',
          response_type: 'yes_no',
          sequence_order: 1,
          help_text: '',
          skip_conditions: {}
        })
        await fetchStages()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add question')
      }
    } catch (err) {
      setError('Network error while adding question')
    }
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

  const renderStageManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Stage Management</h2>
          <p className="text-gray-600">Configure your job progression stages, questions, and transitions</p>
        </div>
        <Button onClick={saveStages} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save All Changes'}
        </Button>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
              <Input
                value={stageForm.name}
                onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                placeholder="e.g., Lead Qualification"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
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
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maps to Status</label>
              <select
                value={stageForm.maps_to_status}
                onChange={(e) => setStageForm({ ...stageForm, maps_to_status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input
              value={stageForm.description}
              onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
              placeholder="Brief description of this stage"
            />
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
            <Card key={stage.id}>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingStage(editingStage === stage.id ? null : stage.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {editingStage === stage.id && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <Input
                        value={stage.description}
                        onChange={(e) => updateStage(stage.id, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                      <input
                        type="color"
                        value={stage.color}
                        onChange={(e) => updateStage(stage.id, 'color', e.target.value)}
                        className="w-full h-10 border border-gray-300 rounded"
                      />
                    </div>
                  </div>
                )}
              </CardHeader>
              
              {expandedStage === stage.id && (
                <CardContent className="space-y-6">
                  {/* Questions Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium text-gray-900 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Questions ({stage.questions?.length || 0})
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addQuestion(stage.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Question
                      </Button>
                    </div>
                    
                    {stage.questions?.length > 0 ? (
                      <div className="space-y-2">
                        {stage.questions.map((question, qIndex) => (
                          <div key={question.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-500">Q{qIndex + 1}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{question.question_text}</p>
                              <p className="text-xs text-gray-600">{question.response_type}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        No questions configured for this stage
                      </p>
                    )}
                  </div>

                  {/* Transitions Section */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      Stage Transitions
                    </h4>
                    
                    {stage.transitions_from?.length > 0 ? (
                      <div className="space-y-2">
                        {stage.transitions_from.map((transition) => {
                          const toStage = stages.find(s => s.id === transition.to_stage_id)
                          return (
                            <div key={transition.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                              <span className="text-sm font-medium">If answer:</span>
                              <Badge variant="outline">{transition.trigger_response}</Badge>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">Go to: {toStage?.name}</span>
                              {transition.is_automatic && (
                                <Badge variant="secondary" className="text-xs">Auto</Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                        No transitions configured from this stage
                      </p>
                    )}
                  </div>
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
      description: 'System-wide settings that affect all companies',
      status: 'configured',
      value: 'Basic settings configured'
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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center">
          <Link href="/dashboard/admin" className="text-gray-500 hover:text-gray-700 mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Database className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-600">Configure platform-wide settings and job progression</p>
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
      ) : (
        renderStageManagement()
      )}
    </div>
  )
}