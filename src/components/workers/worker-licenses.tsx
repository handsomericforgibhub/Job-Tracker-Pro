'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { LIMITS } from '@/config/timeouts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WorkerLicense } from '@/lib/types'
import { 
  Plus, 
  X, 
  Save, 
  FileText, 
  Upload, 
  Download, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Eye,
  Edit
} from 'lucide-react'

const licenseStatusConfig = {
  active: {
    label: 'Active',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: AlertTriangle
  },
  suspended: {
    label: 'Suspended',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    icon: AlertTriangle
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: X
  }
}

const commonLicenseTypes = [
  'Driver License',
  'Working with Children Check',
  'White Card (Construction)',
  'Forklift License',
  'Crane Operator License',
  'Electrical License',
  'Plumbing License',
  'First Aid Certificate',
  'OSHA 10 Hour',
  'OSHA 30 Hour',
  'Safety Induction',
  'High Risk Work License',
  'Scaffolding License'
]

interface WorkerLicensesProps {
  workerId: string
  canEdit: boolean
}

export default function WorkerLicenses({ workerId, canEdit }: WorkerLicensesProps) {
  const { user } = useAuthStore()
  const [licenses, setLicenses] = useState<WorkerLicense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLicense, setEditingLicense] = useState<WorkerLicense | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    license_type: '',
    license_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    status: 'active' as WorkerLicense['status'],
    notes: ''
  })
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (workerId) {
      fetchLicenses()
    }
  }, [workerId])

  const fetchLicenses = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Fetching worker licenses for:', workerId)

      const { data, error } = await supabase
        .from('worker_licenses')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching worker licenses:', error)
        setError('Failed to load licenses')
        return
      }

      console.log('✅ Worker licenses loaded:', data)
      setLicenses(data || [])
    } catch (err) {
      console.error('❌ Exception fetching worker licenses:', err)
      setError('Failed to load licenses')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (max from config)
      if (file.size > LIMITS.MAX_FILE_SIZE_LICENSE * 1024 * 1024) {
        setError(`File size must be less than ${LIMITS.MAX_FILE_SIZE_LICENSE}MB`)
        return
      }
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        setError('File must be JPG, PNG, or PDF')
        return
      }
      
      setSelectedFile(file)
      setError('')
    }
  }

  const uploadFile = async (file: File, licenseId: string): Promise<string | null> => {
    try {
      setUploadingFile(licenseId)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${workerId}/${licenseId}.${fileExt}`
      
      console.log('🔄 Uploading file:', fileName, 'Size:', file.size, 'Type:', file.type)
      
      const { data, error } = await supabase.storage
        .from('worker-licenses')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: true 
        })

      if (error) {
        console.error('❌ Error uploading file:', error)
        if (error.message.includes('bucket')) {
          setError('Storage bucket not found. Please run the storage setup script.')
        } else if (error.message.includes('size')) {
          setError(`File too large. Maximum size is ${LIMITS.MAX_FILE_SIZE_LICENSE}MB.`)
        } else if (error.message.includes('type')) {
          setError('File type not allowed. Use PDF, JPG, or PNG.')
        } else {
          setError(`Upload failed: ${error.message}`)
        }
        return null
      }

      console.log('✅ File uploaded:', data.path)
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('worker-licenses')
        .getPublicUrl(data.path)

      console.log('✅ Public URL generated:', urlData.publicUrl)
      return urlData.publicUrl
    } catch (err) {
      console.error('❌ Exception uploading file:', err)
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      return null
    } finally {
      setUploadingFile(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.license_type.trim()) {
      setError('License type is required')
      return
    }

    setIsSubmitting(true)

    try {
      const licenseData = {
        worker_id: workerId,
        license_type: formData.license_type.trim(),
        license_number: formData.license_number.trim() || null,
        issue_date: formData.issue_date || null,
        expiry_date: formData.expiry_date || null,
        issuing_authority: formData.issuing_authority.trim() || null,
        status: formData.status,
        notes: formData.notes.trim() || null,
        document_filename: selectedFile?.name || (editingLicense?.document_filename || null),
        document_size: selectedFile?.size || (editingLicense?.document_size || null)
      }

      let licenseRecord

      if (editingLicense) {
        // Update existing license
        console.log('🔄 Updating license...', editingLicense.id)

        const { data, error } = await supabase
          .from('worker_licenses')
          .update(licenseData)
          .eq('id', editingLicense.id)
          .select()
          .single()

        if (error) {
          console.error('❌ Error updating license:', error)
          setError(`Failed to update license: ${error.message}`)
          return
        }

        licenseRecord = data
        console.log('✅ License updated successfully')
      } else {
        // Add new license
        console.log('🔄 Adding new license...')

        const { data, error } = await supabase
          .from('worker_licenses')
          .insert(licenseData)
          .select()
          .single()

        if (error) {
          console.error('❌ Error adding license:', error)
          setError(`Failed to add license: ${error.message}`)
          return
        }

        licenseRecord = data
        console.log('✅ License added successfully')
      }

      // Upload file if selected
      let documentUrl = null
      if (selectedFile && licenseRecord) {
        documentUrl = await uploadFile(selectedFile, licenseRecord.id)
        
        if (documentUrl) {
          // Update license record with document URL
          await supabase
            .from('worker_licenses')
            .update({ document_url: documentUrl })
            .eq('id', licenseRecord.id)
        }
      }
      
      // Reset form
      resetForm()
      
    } catch (err) {
      console.error('❌ Exception adding license:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      license_type: '',
      license_number: '',
      issue_date: '',
      expiry_date: '',
      issuing_authority: '',
      status: 'active',
      notes: ''
    })
    setSelectedFile(null)
    setShowAddForm(false)
    setEditingLicense(null)
    fetchLicenses()
  }

  const handleEditLicense = (license: WorkerLicense) => {
    setFormData({
      license_type: license.license_type,
      license_number: license.license_number || '',
      issue_date: license.issue_date || '',
      expiry_date: license.expiry_date || '',
      issuing_authority: license.issuing_authority || '',
      status: license.status,
      notes: license.notes || ''
    })
    setEditingLicense(license)
    setSelectedFile(null) // Reset file selection
    setShowAddForm(true)
    setError('')
  }

  const handleDeleteLicense = async (licenseId: string) => {
    const license = licenses.find(l => l.id === licenseId)
    if (!confirm(`Are you sure you want to delete the "${license?.license_type}" license?`)) {
      return
    }

    try {
      console.log('🔄 Deleting license:', licenseId)

      // Delete file from storage if exists
      if (license?.document_url) {
        const fileName = `${workerId}/${licenseId}`
        await supabase.storage
          .from('worker-licenses')
          .remove([fileName])
      }

      const { error } = await supabase
        .from('worker_licenses')
        .delete()
        .eq('id', licenseId)

      if (error) {
        console.error('❌ Error deleting license:', error)
        return
      }

      console.log('✅ License deleted')
      fetchLicenses()
    } catch (err) {
      console.error('❌ Exception deleting license:', err)
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Licenses & Documents</CardTitle>
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
          <CardTitle>Licenses & Documents</CardTitle>
          {canEdit && !showAddForm && (
            <Button 
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add License
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

        {/* Add/Edit License Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-4 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">
                {editingLicense ? 'Edit License' : 'Add New License'}
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
                    License Type *
                  </label>
                  <select
                    value={formData.license_type}
                    onChange={(e) => handleInputChange('license_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select license type...</option>
                    {commonLicenseTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  
                  {formData.license_type === 'Other' && (
                    <Input
                      placeholder="Enter custom license type"
                      value={formData.license_type === 'Other' ? '' : formData.license_type}
                      onChange={(e) => handleInputChange('license_type', e.target.value)}
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Number
                  </label>
                  <Input
                    value={formData.license_number}
                    onChange={(e) => handleInputChange('license_number', e.target.value)}
                    placeholder="License/Certificate number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issue Date
                  </label>
                  <Input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => handleInputChange('issue_date', e.target.value)}
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
                    min={formData.issue_date || undefined}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Issuing Authority
                  </label>
                  <Input
                    value={formData.issuing_authority}
                    onChange={(e) => handleInputChange('issuing_authority', e.target.value)}
                    placeholder="Organization that issued the license"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Upload
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="license-file"
                    />
                    <label htmlFor="license-file" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        Click to upload license document
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PDF, JPG, PNG (max 5MB)
                      </p>
                    </label>
                    
                    {selectedFile && (
                      <div className="mt-3 text-sm text-green-600">
                        ✓ {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about this license..."
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
                      {editingLicense ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {editingLicense ? 'Update License' : 'Add License'}
                    </>
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddForm(false)
                    setSelectedFile(null)
                    setError('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Licenses List */}
        {licenses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Licenses Added</h3>
            <p className="text-gray-600 mb-4">
              Add licenses and certifications with supporting documents.
            </p>
            {canEdit && !showAddForm && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First License
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {licenses.map(license => {
              const statusInfo = licenseStatusConfig[license.status]
              const StatusIcon = statusInfo.icon
              const expired = isExpired(license.expiry_date)
              const actualStatus = expired && license.status === 'active' ? 'expired' : license.status

              return (
                <div key={license.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{license.license_type}</h4>
                        
                        <Badge variant="outline" className={
                          expired && license.status === 'active' 
                            ? licenseStatusConfig.expired.color 
                            : statusInfo.color
                        }>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {expired && license.status === 'active' ? 'Expired' : statusInfo.label}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        {license.license_number && (
                          <p>License #: {license.license_number}</p>
                        )}
                        
                        {license.issuing_authority && (
                          <p>Issued by: {license.issuing_authority}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs">
                          {license.issue_date && (
                            <span>Issued: {formatDate(license.issue_date)}</span>
                          )}
                          {license.expiry_date && (
                            <span className={expired ? 'text-red-600 font-medium' : ''}>
                              Expires: {formatDate(license.expiry_date)}
                            </span>
                          )}
                        </div>
                        
                        {license.document_url && (
                          <div className="flex items-center space-x-2 mt-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <a 
                              href={license.document_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              View Document
                            </a>
                            {license.document_size && (
                              <span className="text-xs text-gray-500">
                                ({formatFileSize(license.document_size)})
                              </span>
                            )}
                          </div>
                        )}
                        
                        {license.notes && (
                          <p className="italic text-gray-500 mt-2">{license.notes}</p>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLicense(license)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteLicense(license.id)}
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