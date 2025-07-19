'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';
import { Document, DocumentCategory } from '@/lib/types';
import { DocumentUpload } from '@/components/ui/document-upload';
import { DocumentViewer } from '@/components/ui/document-viewer';
import { DocumentList } from '@/components/ui/document-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Search, Filter, Grid, List, FileText, Camera, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentsPage() {
  const { user, company } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch documents and categories
  useEffect(() => {
    if (company?.id) {
      fetchDocuments();
      fetchCategories();
    }
  }, [company?.id]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          category:document_categories(name, icon, color),
          uploader:users(full_name),
          job:jobs(title, address)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .eq('company_id', company?.id)
        .order('sort_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesCategory = selectedCategory === 'all' || doc.category_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const handleUploadSuccess = () => {
    fetchDocuments();
    setIsUploadOpen(false);
    toast.success('Document uploaded successfully');
  };

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document);
  };

  const recentDocuments = documents.slice(0, 5);
  const photoDocuments = documents.filter(doc => doc.mime_type?.startsWith('image/'));
  const totalSize = documents.reduce((acc, doc) => acc + (doc.file_size || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            Manage your project documents, photos, and files
          </p>
        </div>
        <Button 
          onClick={() => setIsUploadOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Documents
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Documents</p>
                <p className="text-2xl font-bold">{documents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Camera className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Photos</p>
                <p className="text-2xl font-bold">{photoDocuments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold">
                  {documents.filter(doc => 
                    new Date(doc.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Storage Used</p>
                <p className="text-2xl font-bold">
                  {(totalSize / (1024 * 1024)).toFixed(1)}MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search documents, filenames, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex border rounded-md">
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
        </CardContent>
      </Card>

      {/* Results Summary */}
      {searchQuery || selectedCategory !== 'all' ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Showing {filteredDocuments.length} of {documents.length} documents
          </span>
          {selectedCategory !== 'all' && (
            <Badge variant="secondary">
              {categories.find(c => c.id === selectedCategory)?.name}
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary">
              Search: "{searchQuery}"
            </Badge>
          )}
        </div>
      ) : null}

      {/* Documents Grid/List */}
      <DocumentList
        documents={filteredDocuments}
        viewMode={viewMode}
        onDocumentSelect={handleDocumentSelect}
        onDocumentUpdate={fetchDocuments}
      />

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Upload Documents</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsUploadOpen(false)}
              >
                ×
              </Button>
            </div>
            <DocumentUpload
              onUploadSuccess={handleUploadSuccess}
              onCancel={() => setIsUploadOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <DocumentViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}