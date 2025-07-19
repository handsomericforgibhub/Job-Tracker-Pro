'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  Award,
  Upload,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { WorkerApplicationFormData } from '@/lib/types'

const commonSkills = [
  'Carpentry', 'Plumbing', 'Electrical', 'Painting', 'Roofing', 'Flooring',
  'Drywall', 'Concrete', 'Welding', 'Heavy Machinery', 'Safety Compliance',
  'Project Management', 'Blueprint Reading', 'Power Tools', 'Hand Tools'
]

const commonCertifications = [
  'OSHA 10', 'OSHA 30', 'First Aid/CPR', 'Forklift Operation', 'Scaffolding',
  'Confined Space', 'Fall Protection', 'Hazmat', 'Crane Operation'
]

const licenseTypes = [
  'Driver License', 'CDL', 'Working with Children Check', 'White Card',
  'Electrical License', 'Plumbing License', 'Gas Fitting License',
  'Forklift License', 'Crane License'
]

const howDidYouHearOptions = [
  'Job Search Website', 'Company Website', 'Social Media', 'Referral',
  'Walk-in', 'Newspaper', 'Other'
]

export default function WorkerApplicationPage() {
  const [formData, setFormData] = useState<Partial<WorkerApplicationFormData>>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    desired_hourly_rate: 25,
    work_experience: '',
    previous_employer: '',
    years_experience: 0,
    skills: [],
    certifications: [],
    licenses: [],
    cover_letter: '',
    references: [
      { name: '', phone: '', email: '', relationship: '' },
      { name: '', phone: '', email: '', relationship: '' }
    ],
    emergency_contact: { name: '', phone: '', relationship: '' },
    availability: {
      monday: { available: true, start: '08:00', end: '17:00' },
      tuesday: { available: true, start: '08:00', end: '17:00' },
      wednesday: { available: true, start: '08:00', end: '17:00' },
      thursday: { available: true, start: '08:00', end: '17:00' },
      friday: { available: true, start: '08:00', end: '17:00' },
      saturday: { available: false },
      sunday: { available: false }
    },
    source: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 5

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateNestedFormData = (field: string, subfield: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: { ...prev[field], [subfield]: value }
    }))
  }

  const addSkill = (skill: string) => {
    if (!formData.skills?.includes(skill)) {
      updateFormData('skills', [...(formData.skills || []), skill])
    }
  }

  const removeSkill = (skill: string) => {
    updateFormData('skills', formData.skills?.filter(s => s !== skill) || [])
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      // Convert availability object to JSON string for database storage
      const submissionData = {
        ...formData,
        availability: JSON.stringify(formData.availability),
        skills: JSON.stringify(formData.skills),
        certifications: JSON.stringify(formData.certifications),
        licenses: JSON.stringify(formData.licenses)
      }

      const response = await fetch('/api/applications/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      })

      if (response.ok) {
        setSubmitStatus('success')
        setCurrentStep(totalSteps + 1) // Show success page
      } else {
        setSubmitStatus('error')
      }
    } catch (error) {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.full_name && formData.email && formData.phone
      case 2:
        return formData.work_experience && formData.years_experience !== undefined
      case 3:
        return formData.skills && formData.skills.length > 0
      case 4:
        return formData.references && formData.references[0].name && formData.emergency_contact?.name
      case 5:
        return formData.source
      default:
        return false
    }
  }

  const nextStep = () => {
    if (currentStep < totalSteps && isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for your interest in joining our team. We'll review your application and get back to you within 2-3 business days.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Our team will review your application</li>
                  <li>• We may contact your references</li>
                  <li>• If selected, we'll schedule an interview</li>
                  <li>• Background check and onboarding (if hired)</li>
                </ul>
              </div>
              <Button onClick={() => window.location.href = '/'}>
                Return to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Building2 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Our Construction Team</h1>
          <p className="text-gray-600">
            Fill out this application to be considered for construction positions with our company
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm font-medium text-gray-600">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={`flex items-center ${i < totalSteps - 1 ? 'flex-1' : ''}`}>
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${currentStep > i + 1 ? 'bg-green-600 text-white' : 
                    currentStep === i + 1 ? 'bg-blue-600 text-white' : 
                    'bg-gray-300 text-gray-600'}
                `}>
                  {currentStep > i + 1 ? '✓' : i + 1}
                </div>
                {i < totalSteps - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${currentStep > i + 1 ? 'bg-green-600' : 'bg-gray-300'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Personal Info</span>
            <span>Experience</span>
            <span>Skills</span>
            <span>References</span>
            <span>Additional</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentStep === 1 && <><User className="h-5 w-5" /> Personal Information</>}
              {currentStep === 2 && <><Briefcase className="h-5 w-5" /> Work Experience</>}
              {currentStep === 3 && <><Award className="h-5 w-5" /> Skills & Certifications</>}
              {currentStep === 4 && <><Users className="h-5 w-5" /> References & Emergency Contact</>}
              {currentStep === 5 && <><Clock className="h-5 w-5" /> Availability & Additional Info</>}
            </CardTitle>
            <CardDescription>
              Step {currentStep} of {totalSteps}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name || ''}
                      onChange={(e) => updateFormData('full_name', e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => updateFormData('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address || ''}
                      onChange={(e) => updateFormData('address', e.target.value)}
                      placeholder="Your full address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth || ''}
                      onChange={(e) => updateFormData('date_of_birth', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="desired_hourly_rate">Desired Hourly Rate ($)</Label>
                    <Input
                      id="desired_hourly_rate"
                      type="number"
                      min="15"
                      max="100"
                      value={formData.desired_hourly_rate || ''}
                      onChange={(e) => updateFormData('desired_hourly_rate', parseFloat(e.target.value))}
                      placeholder="25"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Work Experience */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="years_experience">Years of Construction Experience *</Label>
                    <Input
                      id="years_experience"
                      type="number"
                      min="0"
                      max="50"
                      value={formData.years_experience || ''}
                      onChange={(e) => updateFormData('years_experience', parseInt(e.target.value))}
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="previous_employer">Most Recent Employer</Label>
                    <Input
                      id="previous_employer"
                      value={formData.previous_employer || ''}
                      onChange={(e) => updateFormData('previous_employer', e.target.value)}
                      placeholder="Company name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="work_experience">Work Experience & Responsibilities *</Label>
                  <Textarea
                    id="work_experience"
                    rows={6}
                    value={formData.work_experience || ''}
                    onChange={(e) => updateFormData('work_experience', e.target.value)}
                    placeholder="Describe your construction experience, types of projects you've worked on, specific responsibilities, achievements, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="cover_letter">Why do you want to work with us?</Label>
                  <Textarea
                    id="cover_letter"
                    rows={4}
                    value={formData.cover_letter || ''}
                    onChange={(e) => updateFormData('cover_letter', e.target.value)}
                    placeholder="Tell us why you're interested in joining our team..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Skills & Certifications */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <Label>Skills & Specialties *</Label>
                  <p className="text-sm text-gray-600 mb-3">Select all that apply to your experience</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {commonSkills.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => formData.skills?.includes(skill) ? removeSkill(skill) : addSkill(skill)}
                        className={`p-2 text-sm rounded border text-left transition-colors ${
                          formData.skills?.includes(skill)
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                  {formData.skills && formData.skills.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700">Selected skills:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {formData.skills.map(skill => (
                          <span key={skill} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label>Certifications</Label>
                  <p className="text-sm text-gray-600 mb-3">Check any certifications you have</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {commonCertifications.map(cert => (
                      <label key={cert} className="flex items-center space-x-2 text-sm">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={formData.certifications?.some(c => c.name === cert) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateFormData('certifications', [
                                ...(formData.certifications || []),
                                { name: cert, issuer: '', date: '' }
                              ])
                            } else {
                              updateFormData('certifications', 
                                formData.certifications?.filter(c => c.name !== cert) || []
                              )
                            }
                          }}
                        />
                        <span>{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Licenses</Label>
                  <p className="text-sm text-gray-600 mb-3">Select any professional licenses you hold</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {licenseTypes.map(license => (
                      <label key={license} className="flex items-center space-x-2 text-sm">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={formData.licenses?.some(l => l.type === license) || false}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateFormData('licenses', [
                                ...(formData.licenses || []),
                                { type: license, number: '', expiry: '' }
                              ])
                            } else {
                              updateFormData('licenses', 
                                formData.licenses?.filter(l => l.type !== license) || []
                              )
                            }
                          }}
                        />
                        <span>{license}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: References & Emergency Contact */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Professional References</h3>
                  {formData.references?.map((ref, index) => (
                    <div key={index} className="border rounded-lg p-4 mb-4">
                      <h4 className="font-medium mb-3">Reference {index + 1} {index === 0 && '*'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`ref${index}_name`}>Name</Label>
                          <Input
                            id={`ref${index}_name`}
                            value={ref.name}
                            onChange={(e) => {
                              const newRefs = [...(formData.references || [])]
                              newRefs[index] = { ...newRefs[index], name: e.target.value }
                              updateFormData('references', newRefs)
                            }}
                            placeholder="Full name"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ref${index}_relationship`}>Relationship</Label>
                          <Input
                            id={`ref${index}_relationship`}
                            value={ref.relationship}
                            onChange={(e) => {
                              const newRefs = [...(formData.references || [])]
                              newRefs[index] = { ...newRefs[index], relationship: e.target.value }
                              updateFormData('references', newRefs)
                            }}
                            placeholder="Former supervisor, colleague, etc."
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ref${index}_phone`}>Phone</Label>
                          <Input
                            id={`ref${index}_phone`}
                            value={ref.phone}
                            onChange={(e) => {
                              const newRefs = [...(formData.references || [])]
                              newRefs[index] = { ...newRefs[index], phone: e.target.value }
                              updateFormData('references', newRefs)
                            }}
                            placeholder="(555) 123-4567"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ref${index}_email`}>Email</Label>
                          <Input
                            id={`ref${index}_email`}
                            type="email"
                            value={ref.email}
                            onChange={(e) => {
                              const newRefs = [...(formData.references || [])]
                              newRefs[index] = { ...newRefs[index], email: e.target.value }
                              updateFormData('references', newRefs)
                            }}
                            placeholder="email@example.com"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Emergency Contact *</h3>
                  <div className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="emergency_name">Name</Label>
                        <Input
                          id="emergency_name"
                          value={formData.emergency_contact?.name || ''}
                          onChange={(e) => updateNestedFormData('emergency_contact', 'name', e.target.value)}
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergency_phone">Phone</Label>
                        <Input
                          id="emergency_phone"
                          value={formData.emergency_contact?.phone || ''}
                          onChange={(e) => updateNestedFormData('emergency_contact', 'phone', e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergency_relationship">Relationship</Label>
                        <Input
                          id="emergency_relationship"
                          value={formData.emergency_contact?.relationship || ''}
                          onChange={(e) => updateNestedFormData('emergency_contact', 'relationship', e.target.value)}
                          placeholder="Spouse, parent, sibling, etc."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Availability & Additional Info */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <Label>How did you hear about us? *</Label>
                  <select
                    value={formData.source || ''}
                    onChange={(e) => updateFormData('source', e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an option</option>
                    {howDidYouHearOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Weekly Availability</Label>
                  <p className="text-sm text-gray-600 mb-3">Select the days and times you're available to work</p>
                  <div className="space-y-3">
                    {Object.entries(formData.availability || {}).map(([day, schedule]) => (
                      <div key={day} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={schedule.available}
                            onChange={(e) => {
                              const newAvailability = { ...formData.availability }
                              newAvailability[day as keyof typeof newAvailability] = {
                                ...schedule,
                                available: e.target.checked
                              }
                              updateFormData('availability', newAvailability)
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="font-medium capitalize">{day}</span>
                        </div>
                        {schedule.available && (
                          <div className="flex items-center space-x-2">
                            <Input
                              type="time"
                              value={schedule.start || '08:00'}
                              onChange={(e) => {
                                const newAvailability = { ...formData.availability }
                                newAvailability[day as keyof typeof newAvailability] = {
                                  ...schedule,
                                  start: e.target.value
                                }
                                updateFormData('availability', newAvailability)
                              }}
                              className="w-24"
                            />
                            <span>to</span>
                            <Input
                              type="time"
                              value={schedule.end || '17:00'}
                              onChange={(e) => {
                                const newAvailability = { ...formData.availability }
                                newAvailability[day as keyof typeof newAvailability] = {
                                  ...schedule,
                                  end: e.target.value
                                }
                                updateFormData('availability', newAvailability)
                              }}
                              className="w-24"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Application Review</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Before submitting, please review your information for accuracy. Once submitted, you'll receive a confirmation and we'll review your application within 2-3 business days.
                  </p>
                  <div className="text-sm text-blue-800">
                    <p><strong>Name:</strong> {formData.full_name}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>Experience:</strong> {formData.years_experience} years</p>
                    <p><strong>Skills:</strong> {formData.skills?.length || 0} selected</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                Previous
              </Button>
              
              {currentStep < totalSteps ? (
                <Button
                  onClick={nextStep}
                  disabled={!isStepValid(currentStep)}
                >
                  Next Step
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid(currentStep) || isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              )}
            </div>

            {submitStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span>Error submitting application. Please try again.</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}