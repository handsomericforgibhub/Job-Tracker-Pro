'use client'

import { useState, useEffect } from 'react'
import { Document } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { 
  Download, 
  Eye, 
  Share2, 
  MapPin, 
  Calendar, 
  User, 
  FileText,
  Image as ImageIcon,
  FileVideo,
  File,
  ExternalLink,
  X,
  Copy,
  Globe,
  Lock
} from 'lucide-react'

interface DocumentViewerProps {
  document: Document
  onClose?: () => void
  onDownload?: (document: Document) => void
  onShare?: (document: Document) => void
  showActions?: boolean
  showHeader?: boolean
  className?: string
}

const FILE_TYPE_ICONS = {
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'application/vnd.ms-excel': FileText,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileText,
  'image/jpeg': ImageIcon,
  'image/png': ImageIcon,
  'image/gif': ImageIcon,
  'image/webp': ImageIcon,
  'video/mp4': FileVideo,
  'video/quicktime': FileVideo,
  'text/plain': FileText,
  'text/csv': FileText
}

export function DocumentViewer({
  document,
  onClose,
  onDownload,
  onShare,
  showActions = true,
  showHeader = true,
  className = ''
}: DocumentViewerProps) {
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (document.is_public && document.share_token) {
      setShareUrl(`${window.location.origin}/share/documents/${document.share_token}`)
    }
  }, [document.is_public, document.share_token])

  const isImage = document.mime_type.startsWith('image/')
  const isVideo = document.mime_type.startsWith('video/')
  const isPDF = document.mime_type === 'application/pdf'
  const isText = document.mime_type.startsWith('text/')

  const FileIcon = FILE_TYPE_ICONS[document.mime_type as keyof typeof FILE_TYPE_ICONS] || File

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCategoryColor = (category?: any) => {
    if (!category) return 'bg-gray-100 text-gray-800'
    
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-800',
      green: 'bg-green-100 text-green-800',
      purple: 'bg-purple-100 text-purple-800',
      orange: 'bg-orange-100 text-orange-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
      indigo: 'bg-indigo-100 text-indigo-800',
      gray: 'bg-gray-100 text-gray-800',
      slate: 'bg-slate-100 text-slate-800'
    }
    
    return colorMap[category.color] || 'bg-gray-100 text-gray-800'
  }

  const handleDownload = () => {
    if (document.file_url) {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a')
      link.href = document.file_url
      link.download = document.original_filename
      link.click()
    }
    onDownload?.(document)
  }

  const openInNewTab = () => {
    if (document.file_url) {
      window.open(document.file_url, '_blank')
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({ is_public: !document.is_public })
        .eq('id', document.id)
        .select()
        .single()

      if (error) throw error

      if (data.is_public && data.share_token) {
        const url = `${window.location.origin}/share/documents/${data.share_token}`
        setShareUrl(url)
        toast.success('Document sharing enabled')
      } else {
        setShareUrl('')
        toast.success('Document sharing disabled')
      }

      // Update the document object
      document.is_public = data.is_public
      document.share_token = data.share_token
    } catch (error) {
      console.error('Error toggling share:', error)
      toast.error('Failed to update sharing settings')
    } finally {
      setIsSharing(false)
    }
  }

  const copyShareUrl = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast.success('Share link copied to clipboard')
      } catch (error) {
        toast.error('Failed to copy link')
      }
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-start justify-between p-6 border-b">
        <div className="flex items-start space-x-4 flex-1">
          <div className="bg-gray-100 p-3 rounded-lg">
            <FileIcon className="h-8 w-8 text-gray-600" />
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {document.title}
            </h2>
            
            {document.description && (
              <p className="text-gray-600 mb-3">{document.description}</p>
            )}
            
            <div className="flex flex-wrap gap-2 mb-3">
              {document.category && (
                <Badge className={getCategoryColor(document.category)}>
                  {document.category.name}
                </Badge>
              )}
              
              <Badge variant="outline">
                {document.file_extension.toUpperCase()}
              </Badge>
              
              <Badge variant="outline">
                {formatFileSize(document.file_size)}
              </Badge>
              
              {document.version_number > 1 && (
                <Badge variant="outline">
                  v{document.version_number}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {document.uploaded_by_user && (
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  {document.uploaded_by_user.full_name}
                </div>
              )}
              
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(document.created_at)}
              </div>
              
              {document.latitude && document.longitude && (
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  Location captured
                </div>
              )}
            </div>
          </div>
        </div>
        
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
        </div>
      )}

      {/* Content Preview */}
      <div className="p-6">
        {isImage && !imageError && (
          <div className="text-center">
            <img
              src={document.file_url}
              alt={document.title}
              className="max-w-full max-h-96 rounded-lg shadow-md mx-auto"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {isVideo && !videoError && (
          <div className="text-center">
            <video
              controls
              className="max-w-full max-h-96 rounded-lg shadow-md mx-auto"
              onError={() => setVideoError(true)}
            >
              <source src={document.file_url} type={document.mime_type} />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {isPDF && (
          <div className="text-center">
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">PDF Preview</p>
              <Button onClick={openInNewTab} variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        )}

        {(imageError || videoError || (!isImage && !isVideo && !isPDF)) && (
          <div className="text-center">
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8">
              <FileIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">{document.original_filename}</p>
              <p className="text-sm text-gray-500 mb-4">
                Preview not available for this file type
              </p>
              <Button onClick={openInNewTab} variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open File
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex space-x-3">
            <Button onClick={handleDownload} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <Button onClick={openInNewTab} variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            
            <Button 
              onClick={handleShare} 
              variant="outline"
              disabled={isSharing}
            >
              {document.is_public ? <Lock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
              {isSharing ? 'Processing...' : document.is_public ? 'Make Private' : 'Share Publicly'}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            {document.is_public && document.share_token && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareUrl}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            )}
            
            {document.is_public && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Globe className="h-3 w-3 mr-1" />
                Publicly Shared
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      {document.tags && document.tags.length > 0 && (
        <div className="px-6 pb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {document.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {(document.latitude && document.longitude) && (
        <div className="px-6 pb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Location</h3>
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            {document.location_name || `${document.latitude}, ${document.longitude}`}
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => {
                const url = `https://maps.google.com/?q=${document.latitude},${document.longitude}`
                window.open(url, '_blank')
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentViewer