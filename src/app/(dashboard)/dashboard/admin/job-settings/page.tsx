'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { TIMEOUTS } from '@/config/timeouts'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Settings
} from 'lucide-react'
import Link from 'next/link'

interface JobStage {
  key: string
  label: string
  color: string
  description: string
  is_initial: boolean
  is_final: boolean
  allowed_transitions: string[]
}

interface JobStageSettings {
  stages: JobStage[]
}

export default function JobSettings() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<JobStageSettings>({ stages: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingStage, setEditingStage] = useState<JobStage | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const defaultStageColors = [
    '#6B7280', // Gray
    '#3B82F6', // Blue  
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
  ]

  useEffect(() => {
    if (user?.role === 'owner') {
      loadJobSettings()
    }
  }, [user])

  const loadJobSettings = async () => {
    try {
      setLoading(true)
      
      // First try to get company-specific settings
      let { data: companySettings } = await supabase
        .from('company_settings')
        .select('setting_value')
        .eq('company_id', user?.company_id)
        .eq('setting_key', 'job_stages')
        .eq('is_active', true)
        .single()

      if (companySettings?.setting_value) {
        setSettings({ stages: companySettings.setting_value as JobStage[] })
      } else {
        // Fallback to platform default settings
        let { data: platformSettings } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'default_job_stages')
          .eq('is_active', true)
          .single()

        if (platformSettings?.setting_value) {
          setSettings({ stages: platformSettings.setting_value as JobStage[] })
        }
      }
    } catch (error) {
      console.error('Error loading job settings:', error)
      showMessage('error', 'Failed to load job settings')
    } finally {
      setLoading(false)
    }
  }

  const saveJobSettings = async () => {
    if (!user?.company_id) return

    try {
      setSaving(true)

      // Validate stages
      if (settings.stages.length === 0) {
        showMessage('error', 'At least one job stage is required')
        return
      }

      const initialStages = settings.stages.filter(s => s.is_initial)
      if (initialStages.length !== 1) {
        showMessage('error', 'Exactly one initial stage is required')
        return
      }

      const finalStages = settings.stages.filter(s => s.is_final)
      if (finalStages.length === 0) {
        showMessage('error', 'At least one final stage is required')
        return
      }

      // Check for duplicate keys
      const keys = settings.stages.map(s => s.key)
      if (new Set(keys).size !== keys.length) {
        showMessage('error', 'Stage keys must be unique')
        return
      }

      // Upsert company settings
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: user.company_id,
          setting_key: 'job_stages',
          setting_value: settings.stages,
          setting_type: 'job_stages',
          description: 'Custom job stages for this company',
          is_active: true,
          updated_by: user.id
        }, {
          onConflict: 'company_id,setting_key'
        })

      if (error) throw error

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'setting_update',
        p_target_type: 'company_settings',
        p_target_id: user.company_id,
        p_new_values: { job_stages: settings.stages },
        p_description: 'Updated job stages configuration',
        p_company_id: user.company_id
      })

      showMessage('success', 'Job settings saved successfully')
    } catch (error) {
      console.error('Error saving job settings:', error)
      showMessage('error', 'Failed to save job settings')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), TIMEOUTS.NOTIFICATION_AUTO_HIDE)
  }

  const addStage = (newStage: JobStage) => {
    setSettings(prev => ({
      stages: [...prev.stages, newStage]
    }))
    setShowAddForm(false)
  }

  const updateStage = (updatedStage: JobStage) => {
    setSettings(prev => ({
      stages: prev.stages.map(stage => 
        stage.key === updatedStage.key ? updatedStage : stage
      )
    }))
    setEditingStage(null)
  }

  const deleteStage = (stageKey: string) => {
    if (settings.stages.length <= 1) {
      showMessage('error', 'Cannot delete the last remaining stage')
      return
    }

    setSettings(prev => ({
      stages: prev.stages.filter(stage => stage.key !== stageKey)
    }))
  }

  const moveStage = (stageKey: string, direction: 'up' | 'down') => {
    const currentIndex = settings.stages.findIndex(s => s.key === stageKey)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= settings.stages.length) return

    const newStages = [...settings.stages]
    const [movedStage] = newStages.splice(currentIndex, 1)
    newStages.splice(newIndex, 0, movedStage)

    setSettings({ stages: newStages })
  }

  // Redirect if not owner
  if (!user || user.role !== 'owner') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only owners can manage job settings.</span>
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
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 rounded-lg h-24"></div>
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
            <Briefcase className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Job Settings</h1>
              <p className="text-gray-600">Configure job stages and workflow transitions</p>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stage
          </button>
          <button
            onClick={saveJobSettings}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            )}
            <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </span>
          </div>
        </div>
      )}

      {/* Job Stages List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Current Job Stages</h2>
          <p className="text-gray-600 text-sm mt-1">
            Define the stages that jobs can progress through. Drag to reorder, or use the arrow buttons.
          </p>
        </div>
        <div className="p-6">
          {settings.stages.length > 0 ? (
            <div className="space-y-4">
              {settings.stages.map((stage, index) => (
                <StageCard
                  key={stage.key}
                  stage={stage}
                  index={index}
                  totalStages={settings.stages.length}
                  onEdit={() => setEditingStage(stage)}
                  onDelete={() => deleteStage(stage.key)}
                  onMove={moveStage}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No job stages configured. Add your first stage to get started.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Stage Modal */}
      {(showAddForm || editingStage) && (
        <StageModal
          stage={editingStage}
          existingKeys={settings.stages.map(s => s.key).filter(k => k !== editingStage?.key)}
          onSave={editingStage ? updateStage : addStage}
          onCancel={() => {
            setShowAddForm(false)
            setEditingStage(null)
          }}
          defaultColors={defaultStageColors}
        />
      )}
    </div>
  )
}

// Stage Card Component
function StageCard({ 
  stage, 
  index, 
  totalStages, 
  onEdit, 
  onDelete, 
  onMove 
}: {
  stage: JobStage
  index: number
  totalStages: number
  onEdit: () => void
  onDelete: () => void
  onMove: (key: string, direction: 'up' | 'down') => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: stage.color }}
          ></div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-900">{stage.label}</h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {stage.key}
              </span>
              {stage.is_initial && (
                <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                  Initial
                </span>
              )}
              {stage.is_final && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                  Final
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm mt-1">{stage.description}</p>
            {stage.allowed_transitions.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Transitions to: {stage.allowed_transitions.join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onMove(stage.key, 'up')}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMove(stage.key, 'down')}
            disabled={index === totalStages - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Stage Modal Component
function StageModal({
  stage,
  existingKeys,
  onSave,
  onCancel,
  defaultColors
}: {
  stage: JobStage | null
  existingKeys: string[]
  onSave: (stage: JobStage) => void
  onCancel: () => void
  defaultColors: string[]
}) {
  const [formData, setFormData] = useState<JobStage>(
    stage || {
      key: '',
      label: '',
      color: defaultColors[0],
      description: '',
      is_initial: false,
      is_final: false,
      allowed_transitions: []
    }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.key.trim()) {
      newErrors.key = 'Key is required'
    } else if (!/^[a-z_]+$/.test(formData.key)) {
      newErrors.key = 'Key must contain only lowercase letters and underscores'
    } else if (existingKeys.includes(formData.key)) {
      newErrors.key = 'Key already exists'
    }

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {stage ? 'Edit Stage' : 'Add New Stage'}
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key (Internal ID)
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.key ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., planning, active"
                disabled={!!stage} // Don't allow editing key for existing stages
              />
              {errors.key && <p className="text-red-600 text-xs mt-1">{errors.key}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Label
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.label ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Planning, Active"
              />
              {errors.label && <p className="text-red-600 text-xs mt-1">{errors.label}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                rows={2}
                placeholder="Brief description of this stage"
              />
              {errors.description && <p className="text-red-600 text-xs mt-1">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <div className="flex space-x-2">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_initial}
                  onChange={(e) => setFormData({ ...formData, is_initial: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Initial stage (new jobs start here)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_final}
                  onChange={(e) => setFormData({ ...formData, is_final: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Final stage (jobs cannot progress further)</span>
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                {stage ? 'Update Stage' : 'Add Stage'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}