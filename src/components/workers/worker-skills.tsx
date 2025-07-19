'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WorkerSkill } from '@/lib/types'
import { 
  Plus, 
  X, 
  Save, 
  Award, 
  Wrench, 
  Monitor, 
  Settings,
  Calendar,
  Shield,
  Trash2,
  Edit
} from 'lucide-react'

const skillCategoryConfig = {
  certification: {
    label: 'Certification',
    icon: Award,
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  specialty: {
    label: 'Specialty',
    icon: Wrench,
    color: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  equipment: {
    label: 'Equipment',
    icon: Settings,
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  software: {
    label: 'Software',
    icon: Monitor,
    color: 'bg-green-50 text-green-700 border-green-200'
  }
}

const proficiencyConfig = {
  beginner: {
    label: 'Beginner',
    color: 'bg-gray-50 text-gray-700 border-gray-200'
  },
  intermediate: {
    label: 'Intermediate',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  },
  advanced: {
    label: 'Advanced',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  expert: {
    label: 'Expert',
    color: 'bg-purple-50 text-purple-700 border-purple-200'
  }
}

interface WorkerSkillsProps {
  workerId: string
  canEdit: boolean
}

export default function WorkerSkills({ workerId, canEdit }: WorkerSkillsProps) {
  const { user } = useAuthStore()
  const [skills, setSkills] = useState<WorkerSkill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<WorkerSkill | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    skill_name: '',
    skill_category: 'specialty' as WorkerSkill['skill_category'],
    proficiency_level: 'intermediate' as WorkerSkill['proficiency_level'],
    certification_number: '',
    issued_date: '',
    expiry_date: '',
    issuing_authority: '',
    notes: ''
  })

  useEffect(() => {
    if (workerId) {
      fetchSkills()
    }
  }, [workerId])

  const fetchSkills = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching worker skills for:', workerId)

      const { data, error } = await supabase
        .from('worker_skills')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching worker skills:', error)
        setError('Failed to load skills')
        return
      }

      console.log('✅ Worker skills loaded:', data)
      setSkills(data || [])
    } catch (err) {
      console.error('❌ Exception fetching worker skills:', err)
      setError('Failed to load skills')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.skill_name.trim()) {
      setError('Skill name is required')
      return
    }

    setIsSubmitting(true)

    try {
      const skillData = {
        worker_id: workerId,
        skill_name: formData.skill_name.trim(),
        skill_category: formData.skill_category,
        proficiency_level: formData.proficiency_level,
        certification_number: formData.certification_number.trim() || null,
        issued_date: formData.issued_date || null,
        expiry_date: formData.expiry_date || null,
        issuing_authority: formData.issuing_authority.trim() || null,
        is_verified: editingSkill?.is_verified || false,
        notes: formData.notes.trim() || null
      }

      if (editingSkill) {
        // Update existing skill
        console.log('🔄 Updating skill...', editingSkill.id)

        const { error } = await supabase
          .from('worker_skills')
          .update(skillData)
          .eq('id', editingSkill.id)

        if (error) {
          console.error('❌ Error updating skill:', error)
          setError(`Failed to update skill: ${error.message}`)
          return
        }

        console.log('✅ Skill updated successfully')
      } else {
        // Add new skill
        console.log('🔄 Adding new skill...')

        const { error } = await supabase
          .from('worker_skills')
          .insert(skillData)

        if (error) {
          console.error('❌ Error adding skill:', error)
          setError(`Failed to add skill: ${error.message}`)
          return
        }

        console.log('✅ Skill added successfully')
      }
      
      // Reset form
      resetForm()
      
    } catch (err) {
      console.error('❌ Exception with skill:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      skill_name: '',
      skill_category: 'specialty',
      proficiency_level: 'intermediate',
      certification_number: '',
      issued_date: '',
      expiry_date: '',
      issuing_authority: '',
      notes: ''
    })
    setShowAddForm(false)
    setEditingSkill(null)
    fetchSkills()
  }

  const handleEditSkill = (skill: WorkerSkill) => {
    setFormData({
      skill_name: skill.skill_name,
      skill_category: skill.skill_category,
      proficiency_level: skill.proficiency_level,
      certification_number: skill.certification_number || '',
      issued_date: skill.issued_date || '',
      expiry_date: skill.expiry_date || '',
      issuing_authority: skill.issuing_authority || '',
      notes: skill.notes || ''
    })
    setEditingSkill(skill)
    setShowAddForm(true)
    setError('')
  }

  const handleDeleteSkill = async (skillId: string) => {
    const skill = skills.find(s => s.id === skillId)
    if (!confirm(`Are you sure you want to delete the skill "${skill?.skill_name}"?`)) {
      return
    }

    try {
      console.log('🔄 Deleting skill:', skillId)

      const { error } = await supabase
        .from('worker_skills')
        .delete()
        .eq('id', skillId)

      if (error) {
        console.error('❌ Error deleting skill:', error)
        return
      }

      console.log('✅ Skill deleted')
      fetchSkills()
    } catch (err) {
      console.error('❌ Exception deleting skill:', err)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skills & Certifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Skills & Certifications</CardTitle>
          {canEdit && !showAddForm && (
            <Button 
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Skill
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        {/* Add/Edit Skill Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">
                {editingSkill ? 'Edit Skill' : 'Add New Skill'}
              </h4>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={resetForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skill Name *
                  </label>
                  <Input
                    value={formData.skill_name}
                    onChange={(e) => handleInputChange('skill_name', e.target.value)}
                    placeholder="e.g., OSHA 30, Welding, Forklift Operation"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.skill_category}
                    onChange={(e) => handleInputChange('skill_category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="specialty">Specialty</option>
                    <option value="certification">Certification</option>
                    <option value="equipment">Equipment</option>
                    <option value="software">Software</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proficiency Level
                  </label>
                  <select
                    value={formData.proficiency_level}
                    onChange={(e) => handleInputChange('proficiency_level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certification Number
                  </label>
                  <Input
                    value={formData.certification_number}
                    onChange={(e) => handleInputChange('certification_number', e.target.value)}
                    placeholder="Certificate/License number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Date
                  </label>
                  <Input
                    type="date"
                    value={formData.issued_date}
                    onChange={(e) => handleInputChange('issued_date', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => handleInputChange('expiry_date', e.target.value)}
                    min={formData.issued_date || undefined}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issuing Authority
                  </label>
                  <Input
                    value={formData.issuing_authority}
                    onChange={(e) => handleInputChange('issuing_authority', e.target.value)}
                    placeholder="Organization that issued the certification"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about this skill..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingSkill ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingSkill ? 'Update Skill' : 'Add Skill'}
                    </>
                  )}
                </Button>
                
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Skills List */}
        {skills.length === 0 ? (
          <div className="text-center py-8">
            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Skills Added</h3>
            <p className="text-gray-600 mb-4">
              Add skills and certifications to track worker capabilities.
            </p>
            {canEdit && !showAddForm && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Skill
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map(skill => {
              const categoryInfo = skillCategoryConfig[skill.skill_category]
              const proficiencyInfo = proficiencyConfig[skill.proficiency_level]
              const CategoryIcon = categoryInfo.icon
              const expired = isExpired(skill.expiry_date)

              return (
                <div key={skill.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <CategoryIcon className="h-5 w-5 text-gray-600 mt-1" />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900">{skill.skill_name}</h4>
                          
                          <Badge variant="outline" className={categoryInfo.color}>
                            {categoryInfo.label}
                          </Badge>
                          
                          <Badge variant="outline" className={proficiencyInfo.color}>
                            {proficiencyInfo.label}
                          </Badge>
                          
                          {expired && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Expired
                            </Badge>
                          )}
                          
                          {skill.is_verified && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Shield className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                          {skill.certification_number && (
                            <p>Cert #: {skill.certification_number}</p>
                          )}
                          
                          {skill.issuing_authority && (
                            <p>Issued by: {skill.issuing_authority}</p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs">
                            {skill.issued_date && (
                              <span>Issued: {formatDate(skill.issued_date)}</span>
                            )}
                            {skill.expiry_date && (
                              <span className={expired ? 'text-red-600' : ''}>
                                Expires: {formatDate(skill.expiry_date)}
                              </span>
                            )}
                          </div>
                          
                          {skill.notes && (
                            <p className="italic text-gray-500 mt-2">{skill.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSkill(skill)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}