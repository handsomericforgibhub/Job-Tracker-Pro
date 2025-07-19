'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';
import { Document } from '@/lib/types';
import { DocumentViewer } from '@/components/ui/document-viewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Share2, Edit, Trash2, MapPin, Calendar, User, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function DocumentDetailPage() {
  const { user, company } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params.id && company?.id) {
      fetchDocument();
    }
  }, [params.id, company?.id]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          category:document_categories(name, icon, color),
          uploader:users(full_name, email),
          job:jobs(title, address),
          task:tasks(title, description)
        `)
        .eq('id', params.id)
        .eq('company_id', company?.id)
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error('Failed to load document');
      router.push('/documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      const { data, error } = await supabase.storage
        .from(document.storage_bucket)
        .download(document.storage_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log access
      await supabase
        .from('document_access_log')
        .insert({
          document_id: document.id,
          accessed_by: user?.id,
          access_type: 'download'
        });

      toast.success('Document downloaded');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const handleShare = async () => {
    if (!document) return;

    try {
      // Toggle public sharing
      const { error } = await supabase
        .from('documents')
        .update({ is_public: !document.is_public })
        .eq('id', document.id);

      if (error) throw error;

      setDocument(prev => prev ? { ...prev, is_public: !prev.is_public } : null);
      toast.success(document.is_public ? 'Sharing disabled' : 'Sharing enabled');
    } catch (error) {
      console.error('Error updating sharing:', error);
      toast.error('Failed to update sharing');
    }
  };

  const handleDelete = async () => {
    if (!document || !confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      await supabase.storage
        .from(document.storage_bucket)
        .remove([document.storage_path]);

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      toast.success('Document deleted');
      router.push('/documents');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Document not found</h2>
        <p className="text-gray-600 mt-2">The document you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/documents')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{document.title}</h1>
            <p className="text-gray-600 mt-1">{document.original_filename}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            {document.is_public ? 'Disable Sharing' : 'Enable Sharing'}
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Viewer */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <DocumentViewer
                document={document}
                onClose={() => {}}
                showHeader={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Document Details */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Uploaded by</p>
                  <p className="text-sm text-gray-600">{document.uploader?.full_name}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Uploaded</p>
                  <p className="text-sm text-gray-600">
                    {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Tag className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Category</p>
                  <Badge variant="secondary">
                    {document.category?.name || 'Uncategorized'}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">File Information</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Size: {formatFileSize(document.file_size)}</p>
                  <p>Type: {document.mime_type}</p>
                  <p>Extension: {document.file_extension}</p>
                </div>
              </div>

              {document.latitude && document.longitude && (
                <div className="flex items-center space-x-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-gray-600">
                      {document.location_name || `${document.latitude}, ${document.longitude}`}
                    </p>
                  </div>
                </div>
              )}

              {document.tags && document.tags.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {document.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job/Task Association */}
          {(document.job || document.task) && (
            <Card>
              <CardHeader>
                <CardTitle>Associated With</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {document.job && (
                  <div>
                    <p className="text-sm font-medium">Job</p>
                    <p className="text-sm text-gray-600">{document.job.title}</p>
                    {document.job.address && (
                      <p className="text-xs text-gray-500">{document.job.address}</p>
                    )}
                  </div>
                )}
                {document.task && (
                  <div>
                    <p className="text-sm font-medium">Task</p>
                    <p className="text-sm text-gray-600">{document.task.title}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sharing Info */}
          {document.is_public && (
            <Card>
              <CardHeader>
                <CardTitle>Sharing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Public Sharing Enabled
                  </Badge>
                  {document.share_expires_at && (
                    <p className="text-sm text-gray-600">
                      Expires: {new Date(document.share_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}