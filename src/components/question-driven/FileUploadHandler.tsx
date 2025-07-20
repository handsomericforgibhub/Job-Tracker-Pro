'use client'

import { useState, useCallback } from 'react'
import { FileUploadResult } from '@/lib/types/question-driven'
import { Card, CardContent } from '@/components/ui/card'
import { EXTERNAL_APIS } from '@/config/endpoints'
import { LIMITS, TIMEOUTS } from '@/config/timeouts'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  X, 
  File, 
  Image, 
  FileText, 
  Camera,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react'

interface FileUploadHandlerProps {
  acceptedTypes?: string[]
  maxFileSize?: number // in MB
  maxFiles?: number
  onFilesUploaded?: (results: FileUploadResult[]) => void
  onError?: (error: string) => void
  className?: string
}

export default function FileUploadHandler({
  acceptedTypes = ['image/*', 'application/pdf', '.doc', '.docx'],
  maxFileSize = LIMITS.MAX_FILE_SIZE_DOCUMENT,
  maxFiles = LIMITS.MAX_FILES_QUESTION,
  onFilesUploaded,
  onError,
  className = ''
}: FileUploadHandlerProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const [uploadResults, setUploadResults] = useState<FileUploadResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    
    // Validate file count
    if (selectedFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Validate file sizes and types
    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of selectedFiles) {
      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        errors.push(`${file.name} is too large (max ${maxFileSize}MB)`)
        continue
      }

      // Check file type
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase())
        }
        return file.type.match(type.replace('*', '.*'))
      })

      if (!isValidType) {
        errors.push(`${file.name} is not a supported file type`)
        continue
      }

      validFiles.push(file)
    }

    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    setFiles(prev => [...prev, ...validFiles])
    setError(null)
  }, [files, maxFiles, maxFileSize, acceptedTypes])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFiles = Array.from(event.dataTransfer.files)
    
    // Create a synthetic event for the file handler
    const syntheticEvent = {
      target: { files: droppedFiles }
    } as React.ChangeEvent<HTMLInputElement>
    
    handleFileSelect(syntheticEvent)
  }, [handleFileSelect])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setUploading(true)
    setError(null)
    setUploadResults([])

    const results: FileUploadResult[] = []

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        // Simulate upload progress
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }))

        // Create mock upload with progress simulation
        const uploadPromise = new Promise<FileUploadResult>((resolve) => {
          let progress = 0
          const interval = setInterval(() => {
            progress += Math.random() * 30
            if (progress >= 100) {
              clearInterval(interval)
              setUploadProgress(prev => ({ ...prev, [file.name]: 100 }))
              
              // Mock successful upload result
              resolve({
                success: true,
                file_url: EXTERNAL_APIS.STORAGE.getUploadUrl(file.name),
                file_name: file.name,
                file_size: file.size
              })
            } else {
              setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
            }
          }, TIMEOUTS.UPLOAD_PROGRESS_INTERVAL)
        })

        const result = await uploadPromise
        results.push(result)

      } catch (err) {
        const errorResult: FileUploadResult = {
          success: false,
          error: err instanceof Error ? err.message : 'Upload failed'
        }
        results.push(errorResult)
      }
    }

    setUploadResults(results)
    setUploading(false)

    // Notify parent component
    if (onFilesUploaded) {
      onFilesUploaded(results)
    }

    // Check for errors
    const failedUploads = results.filter(r => !r.success)
    if (failedUploads.length > 0) {
      const errorMessage = `${failedUploads.length} files failed to upload`
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4" />
    } else if (file.type.includes('pdf')) {
      return <FileText className="w-4 h-4" />
    } else {
      return <File className="w-4 h-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload area */}
      <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="text-center"
          >
            <input
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="space-y-2">
                <Upload className="w-8 h-8 mx-auto text-gray-400" />
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Click to upload</span> or drag and drop
                </div>
                <div className="text-xs text-gray-500">
                  {acceptedTypes.join(', ')} up to {maxFileSize}MB each
                </div>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Selected files */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Selected Files ({files.length})</h4>
                <Button
                  onClick={uploadFiles}
                  disabled={uploading}
                  size="sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Files
                    </>
                  )}
                </Button>
              </div>
              
              {files.map((file, index) => {
                const progress = uploadProgress[file.name] || 0
                const result = uploadResults.find(r => r.file_name === file.name)
                
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    {getFileIcon(file)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      
                      {uploading && progress > 0 && (
                        <Progress value={progress} className="h-2" />
                      )}
                      
                      {result && (
                        <div className="flex items-center gap-1 mt-1">
                          {result.success ? (
                            <>
                              <Check className="w-3 h-3 text-green-500" />
                              <span className="text-xs text-green-600">Uploaded</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-600">Failed</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!uploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Camera capture option (mobile) */}
      <Card className="md:hidden">
        <CardContent className="p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              // TODO: Implement camera capture
              console.log('Camera capture not yet implemented')
            }}
          >
            <Camera className="w-4 h-4 mr-2" />
            Take Photo
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}