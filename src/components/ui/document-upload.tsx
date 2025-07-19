'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DocumentCategory } from '@/lib/types'
import { 
  Upload, 
  X, 
  FileText, 
  Image, 
  FileVideo, 
  File, 
  Check,
  AlertCircle,
  Camera,
  MapPin,
  Tag,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

interface DocumentUploadProps {
  jobId?: string
  taskId?: string
  categoryId?: string
  onUploadSuccess?: () => void
  onCancel?: () => void
  maxFiles?: number
  accept?: string
  className?: string
  showCamera?: boolean
}

interface UploadFile {
  file: File
  id: string
  title: string
  description: string
  categoryId: string
  tags: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  timestamp: number
  address?: string
}

const ALLOWED_FILE_TYPES = {
  'application/pdf': { icon: FileText, name: 'PDF' },
  'application/msword': { icon: FileText, name: 'Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, name: 'Word' },
  'application/vnd.ms-excel': { icon: FileText, name: 'Excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileText, name: 'Excel' },
  'image/jpeg': { icon: Image, name: 'JPEG' },
  'image/png': { icon: Image, name: 'PNG' },
  'image/gif': { icon: Image, name: 'GIF' },
  'image/webp': { icon: Image, name: 'WebP' },
  'image/heic': { icon: Image, name: 'HEIC' },
  'video/mp4': { icon: FileVideo, name: 'MP4' },
  'video/quicktime': { icon: FileVideo, name: 'MOV' },
  'text/plain': { icon: FileText, name: 'Text' },
  'text/csv': { icon: FileText, name: 'CSV' }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_PHOTO_SIZE = 20 * 1024 * 1024 // 20MB

export function DocumentUpload({
  jobId,
  taskId,
  categoryId: defaultCategoryId,
  onUploadSuccess,
  onCancel,
  maxFiles = 10,
  accept,
  className,
  showCamera = true
}: DocumentUploadProps) {
  const { user, company } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadFile[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  useEffect(() => {
    fetchCategories()
    getCurrentLocation()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .eq('company_id', company?.id)
        .order('sort_order')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported')
      return
    }

    setIsGettingLocation(true)
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        })
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      }

      // Try to get address from coordinates
      try {
        const response = await fetch(
          `https://api.openstreetmap.org/reverse?format=json&lat=${locationData.latitude}&lon=${locationData.longitude}&zoom=18&addressdetails=1`
        )
        const data = await response.json()
        if (data.display_name) {
          locationData.address = data.display_name
        }
      } catch (addressError) {
        console.warn('Could not fetch address:', addressError)
      }

      setLocation(locationData)
    } catch (error) {
      console.warn('Could not get location:', error)
    } finally {
      setIsGettingLocation(false)
    }
  }

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const validateFile = (file: File): string | null => {
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      return `File type ${file.type} is not supported`
    }

    const isImage = file.type.startsWith('image/')
    const maxSize = isImage ? MAX_PHOTO_SIZE : MAX_FILE_SIZE
    
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      return `File size must be less than ${maxSizeMB}MB`
    }

    return null
  }

  const handleFileSelect = useCallback((selectedFiles: FileList) => {
    const newFiles: UploadFile[] = []
    
    Array.from(selectedFiles).forEach(file => {
      if (files.length + newFiles.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`)
        return
      }

      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }

      newFiles.push({
        file,
        id: generateId(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        description: '',
        categoryId: defaultCategoryId || '',
        tags: '',
        progress: 0,
        status: 'pending'
      })
    })

    setFiles(prev => [...prev, ...newFiles])
  }, [files.length, maxFiles, defaultCategoryId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles)
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const uploadFile = async (uploadFile: UploadFile): Promise<boolean> => {
    try {
      updateFile(uploadFile.id, { status: 'uploading', progress: 0 })

      // Generate file path
      const fileExtension = uploadFile.file.name.split('.').pop()?.toLowerCase() || ''
      const timestamp = Date.now()
      const storagePath = `${company?.id}/${jobId || 'general'}/${timestamp}_${uploadFile.file.name}`
      
      // Determine storage bucket based on file type
      const isImage = uploadFile.file.type.startsWith('image/')
      const storageBucket = isImage ? 'photos' : 'documents'

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, uploadFile.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from(storageBucket)
        .getPublicUrl(uploadData.path)

      // Create document record
      const documentData = {
        name: uploadFile.title || uploadFile.file.name,
        title: uploadFile.title || uploadFile.file.name,
        type: isImage ? 'photo' : 'other',
        url: urlData.publicUrl,
        description: uploadFile.description || null,
        original_filename: uploadFile.file.name,
        file_extension: fileExtension,
        file_size: uploadFile.file.size,
        mime_type: uploadFile.file.type,
        storage_path: uploadData.path,
        storage_bucket: storageBucket,
        category_id: uploadFile.categoryId || null,
        job_id: jobId || null,
        task_id: taskId || null,
        tags: uploadFile.tags ? uploadFile.tags.split(',').map(tag => tag.trim()) : null,
        latitude: location && isImage ? location.latitude : null,
        longitude: location && isImage ? location.longitude : null,
        location_name: location && isImage ? location.address : null,
        uploaded_by: user?.id,
        company_id: company?.id
      }

      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert(documentData)
        .select(`
          *,
          category:document_categories(name, icon, color),
          uploader:users(full_name),
          job:jobs(title),
          task:tasks(title, description)
        `)
        .single()

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage
          .from(storageBucket)
          .remove([uploadData.path])
        
        throw new Error(dbError.message)
      }

      updateFile(uploadFile.id, { status: 'success', progress: 100 })
      return true

    } catch (error) {
      console.error('Upload error:', error)
      updateFile(uploadFile.id, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Upload failed'
      })
      return false
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    let successCount = 0

    try {
      for (const file of files) {
        if (file.status === 'pending') {
          const success = await uploadFile(file)
          if (success) successCount++
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded successfully`)
        if (onUploadSuccess) {
          onUploadSuccess()
        }
      }

      if (successCount === files.length) {
        setFiles([])
      }

    } catch (error) {
      console.error('Upload process error:', error)
      toast.error('Upload process failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click()
    }
  }

  const getFileIcon = (mimeType: string) => {
    const typeInfo = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES]
    return typeInfo ? typeInfo.icon : File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Location Status */}
      {location && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <MapPin className="h-4 w-4" />
              <span>Location captured for photos</span>
              <Badge variant="secondary" className="text-xs">
                {location.accuracy ? `±${Math.round(location.accuracy)}m` : 'GPS'}
              </Badge>
            </div>
            {location.address && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {location.address}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="space-y-4">
          <div className="flex justify-center space-x-4">
            <Upload className="h-12 w-12 text-gray-400" />
            {showCamera && (
              <Camera className="h-12 w-12 text-blue-500" />
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Support for documents, images, and videos up to {Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB
            </p>
          </div>

          <div className="flex justify-center space-x-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Browse Files
            </Button>
            
            {showCamera && (
              <Button
                variant="outline"
                onClick={handleCameraCapture}
                disabled={isUploading}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept || Object.keys(ALLOWED_FILE_TYPES).join(',')}
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Files to Upload ({files.length})</h3>
          
          <div className="space-y-4">
            {files.map((file) => {
              const IconComponent = getFileIcon(file.file.type)
              
              return (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <IconComponent className="h-8 w-8 text-gray-500" />
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{file.file.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.file.size)} • {ALLOWED_FILE_TYPES[file.file.type as keyof typeof ALLOWED_FILE_TYPES]?.name}
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(file.id)}
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`title-${file.id}`}>Title</Label>
                            <Input
                              id={`title-${file.id}`}
                              value={file.title}
                              onChange={(e) => updateFile(file.id, { title: e.target.value })}
                              placeholder="Document title"
                              disabled={isUploading}
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor={`category-${file.id}`}>Category</Label>
                            <select
                              id={`category-${file.id}`}
                              value={file.categoryId || ''}
                              onChange={(e) => {
                                console.log('Category changed:', e.target.value, 'for file:', file.id, 'current:', file.categoryId)
                                updateFile(file.id, { categoryId: e.target.value })
                              }}
                              disabled={isUploading}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select category</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`description-${file.id}`}>Description</Label>
                          <Textarea
                            id={`description-${file.id}`}
                            value={file.description}
                            onChange={(e) => updateFile(file.id, { description: e.target.value })}
                            placeholder="Optional description"
                            rows={2}
                            disabled={isUploading}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`tags-${file.id}`}>Tags</Label>
                          <Input
                            id={`tags-${file.id}`}
                            value={file.tags}
                            onChange={(e) => updateFile(file.id, { tags: e.target.value })}
                            placeholder="Comma-separated tags"
                            disabled={isUploading}
                          />
                        </div>

                        {/* Progress and Status */}
                        {file.status !== 'pending' && (
                          <div className="space-y-2">
                            {file.status === 'uploading' && (
                              <Progress value={file.progress} className="w-full" />
                            )}
                            
                            <div className="flex items-center space-x-2">
                              {file.status === 'success' && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                              {file.status === 'error' && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`text-sm ${
                                file.status === 'success' ? 'text-green-600' :
                                file.status === 'error' ? 'text-red-600' :
                                'text-gray-600'
                              }`}>
                                {file.status === 'uploading' && 'Uploading...'}
                                {file.status === 'success' && 'Upload complete'}
                                {file.status === 'error' && (file.error || 'Upload failed')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Upload Actions */}
      {files.length > 0 && (
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {files.filter(f => f.status === 'pending').length} files ready to upload
          </div>
          
          <div className="flex space-x-3">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isUploading}>
                Cancel
              </Button>
            )}
            
            <Button 
              onClick={handleUpload}
              disabled={isUploading || files.filter(f => f.status === 'pending').length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}