'use client'

import { useState } from 'react'
import { Document, DocumentCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import DocumentViewer from './document-viewer'
import { 
  Search,
  Filter,
  Grid,
  List,
  Download,
  Eye,
  Share2,
  MoreHorizontal,
  FileText,
  Image as ImageIcon,
  FileVideo,
  File,
  Calendar,
  User,
  MapPin,
  Tag
} from 'lucide-react'

interface DocumentListProps {
  documents: Document[]
  categories: DocumentCategory[]
  onDocumentSelect?: (document: Document) => void
  onDocumentDownload?: (document: Document) => void
  onDocumentShare?: (document: Document) => void
  onDocumentDelete?: (document: Document) => void
  isLoading?: boolean
  className?: string
}

type ViewMode = 'grid' | 'list'
type SortField = 'created_at' | 'title' | 'file_size' | 'document_date'
type SortOrder = 'asc' | 'desc'

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

export default function DocumentList({
  documents,
  categories,
  onDocumentSelect,
  onDocumentDownload,
  onDocumentShare,
  onDocumentDelete,
  isLoading = false,
  className = ''
}: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
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

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'all' || doc.category_id === selectedCategory
      
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]
      
      // Handle different data types
      if (sortField === 'created_at' || sortField === 'document_date') {
        aValue = new Date(aValue || 0).getTime()
        bValue = new Date(bValue || 0).getTime()
      } else if (sortField === 'file_size') {
        aValue = a.file_size || 0
        bValue = b.file_size || 0
      } else {
        aValue = (aValue || '').toString().toLowerCase()
        bValue = (bValue || '').toString().toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const handleDocumentClick = (document: Document) => {
    setSelectedDocument(document)
    onDocumentSelect?.(document)
  }

  const handleDownload = async (doc: Document) => {
    try {
      // Create a temporary link element to trigger download
      const link = window.document.createElement('a')
      link.href = doc.url
      link.download = doc.original_filename
      link.target = '_blank'
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      
      // Log the download access
      await fetch(`/api/documents/${doc.id}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_type: 'download'
        })
      })
      
      onDocumentDownload?.(doc)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const DocumentCard = ({ document }: { document: Document }) => {
    const FileIcon = FILE_TYPE_ICONS[document.mime_type as keyof typeof FILE_TYPE_ICONS] || File
    const isImage = document.mime_type.startsWith('image/')

    return (
      <div 
        className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => handleDocumentClick(document)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {isImage && document.file_url ? (
              <img
                src={document.file_url}
                alt={document.title}
                className="w-12 h-12 object-cover rounded"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                <FileIcon className="h-6 w-6 text-gray-500" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">
                {document.title}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                {document.original_filename}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleDownload(document)
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleDocumentClick(document)
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {document.category && (
              <Badge className={getCategoryColor(document.category)} variant="secondary">
                {document.category.name}
              </Badge>
            )}
            <span className="text-xs text-gray-500">
              {formatFileSize(document.file_size)}
            </span>
          </div>
          
          <span className="text-xs text-gray-500">
            {formatDate(document.created_at)}
          </span>
        </div>
        
        {document.tags && document.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {document.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {document.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{document.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    )
  }

  const DocumentRow = ({ document }: { document: Document }) => {
    const FileIcon = FILE_TYPE_ICONS[document.mime_type as keyof typeof FILE_TYPE_ICONS] || File

    return (
      <tr 
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => handleDocumentClick(document)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-3">
            <FileIcon className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {document.title}
              </div>
              <div className="text-sm text-gray-500">
                {document.original_filename}
              </div>
            </div>
          </div>
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap">
          {document.category && (
            <Badge className={getCategoryColor(document.category)} variant="secondary">
              {document.category.name}
            </Badge>
          )}
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatFileSize(document.file_size)}
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {document.uploaded_by_user?.full_name}
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatDate(document.created_at)}
        </td>
        
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                handleDownload(document)
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDocumentShare?.(document)
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        
        <div className="flex border border-gray-300 rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document Display */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
          <p className="text-gray-600">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Upload your first document to get started'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocuments.map(document => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDocuments.map(document => (
                <DocumentRow key={document.id} document={document} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-auto">
            <DocumentViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
              onDownload={() => handleDownload(selectedDocument)}
              onShare={onDocumentShare}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export { DocumentList }