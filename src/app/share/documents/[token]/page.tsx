'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Eye, 
  MapPin, 
  Calendar, 
  User, 
  Building,
  AlertCircle,
  Lock,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SharedDocument {
  id: string;
  title: string;
  description: string;
  original_filename: string;
  file_extension: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  storage_bucket: string;
  document_date: string;
  tags: string[];
  latitude: number;
  longitude: number;
  location_name: string;
  is_public: boolean;
  share_token: string;
  share_expires_at: string;
  created_at: string;
  category: {
    name: string;
    icon: string;
    color: string;
  };
  uploader: {
    full_name: string;
  };
  job: {
    title: string;
    address: string;
  };
  company: {
    name: string;
  };
}

export default function SharedDocumentPage() {
  const params = useParams();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const token = params.token as string;

  useEffect(() => {
    if (token) {
      fetchDocument();
    }
  }, [token]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          category:document_categories(name, icon, color),
          uploader:users(full_name),
          job:jobs(title, address),
          company:companies(name)
        `)
        .eq('share_token', token)
        .eq('is_public', true)
        .single();

      if (error) {
        console.error('Error fetching document:', error);
        setError('Document not found or access denied');
        return;
      }

      // Check if document is expired
      if (data.share_expires_at && new Date(data.share_expires_at) < new Date()) {
        setError('This shared link has expired');
        return;
      }

      setDocument(data);

      // Get preview URL for supported file types
      if (data.mime_type.startsWith('image/') || data.mime_type === 'application/pdf') {
        const { data: urlData } = await supabase.storage
          .from(data.storage_bucket)
          .createSignedUrl(data.storage_path, 3600); // 1 hour expiry

        if (urlData) {
          setPreviewUrl(urlData.signedUrl);
        }
      }

      // Log access
      await supabase
        .from('document_access_log')
        .insert({
          document_id: data.id,
          accessed_by: null, // Public access
          access_type: 'view'
        });

    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load document');
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

      // Log download
      await supabase
        .from('document_access_log')
        .insert({
          document_id: document.id,
          accessed_by: null,
          access_type: 'download'
        });

      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (!document) return FileText;
    if (document.mime_type.startsWith('image/')) return Eye;
    return FileText;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex items-center justify-center text-sm text-gray-500">
                <Lock className="h-4 w-4 mr-2" />
                This document is private or the link has expired
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  const FileIcon = getFileIcon();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{document.title}</h1>
                <p className="text-sm text-gray-600">
                  Shared by {document.company?.name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Public Document
              </Badge>
              <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
                <CardDescription>
                  {document.original_filename} • {formatFileSize(document.file_size)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previewUrl ? (
                  <div className="space-y-4">
                    {document.mime_type.startsWith('image/') ? (
                      <img
                        src={previewUrl}
                        alt={document.title}
                        className="w-full h-auto rounded-lg shadow-sm border"
                      />
                    ) : document.mime_type === 'application/pdf' ? (
                      <iframe
                        src={previewUrl}
                        className="w-full h-96 rounded-lg border"
                        title={document.title}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Preview not available for this file type</p>
                        <Button onClick={handleDownload} className="mt-4">
                          <Download className="h-4 w-4 mr-2" />
                          Download to View
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Click to download this document</p>
                    <Button onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download {document.original_filename}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {document.description && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{document.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Document Details */}
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

                {document.category && (
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">Category</p>
                      <Badge variant="secondary">{document.category.name}</Badge>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-2">File Information</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Size: {formatFileSize(document.file_size)}</p>
                    <p>Type: {document.mime_type}</p>
                    <p>Extension: {document.file_extension}</p>
                  </div>
                </div>

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

            {/* Job Information */}
            {document.job && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="h-4 w-4 mr-2" />
                    Project Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Project</p>
                    <p className="text-sm text-gray-600">{document.job.title}</p>
                  </div>
                  {document.job.address && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-gray-600">{document.job.address}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Location Data */}
            {document.latitude && document.longitude && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    Photo Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {document.location_name && (
                      <p className="text-sm text-gray-900">{document.location_name}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Coordinates: {document.latitude.toFixed(6)}, {document.longitude.toFixed(6)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Share Info */}
            <Card>
              <CardHeader>
                <CardTitle>Sharing Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-700">Public Document</span>
                  </div>
                  {document.share_expires_at && (
                    <p className="text-xs text-gray-500">
                      Expires: {new Date(document.share_expires_at).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    This document has been shared publicly by {document.company?.name}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}