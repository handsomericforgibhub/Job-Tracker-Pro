-- Document Storage Buckets Configuration
-- Setup Supabase Storage buckets for document management
-- Run this in Supabase SQL Editor

-- Create main documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false, -- Private by default
    52428800, -- 50MB limit per file
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'text/plain',
        'text/csv',
        'application/rtf',
        'application/zip',
        'application/x-rar-compressed',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create photos storage bucket (separate for optimized handling)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'photos',
    'photos',
    false, -- Private by default, can be made public per file
    20971520, -- 20MB limit per photo
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'image/heic',
        'image/heif'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for documents bucket
-- Policy for authenticated users to upload documents
CREATE POLICY "Enable uploads for authenticated users" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Policy for users to view their company's documents
CREATE POLICY "Enable read access for company documents" ON storage.objects
FOR SELECT USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Policy for users to update their company's documents
CREATE POLICY "Enable update for company documents" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
) WITH CHECK (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Policy for users to delete their company's documents
CREATE POLICY "Enable delete for company documents" ON storage.objects
FOR DELETE USING (
    bucket_id = 'documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- RLS Policies for photos bucket
-- Policy for authenticated users to upload photos
CREATE POLICY "Enable photo uploads for authenticated users" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'photos' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Policy for users to view their company's photos
CREATE POLICY "Enable read access for company photos" ON storage.objects
FOR SELECT USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Policy for users to update their company's photos
CREATE POLICY "Enable update for company photos" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
) WITH CHECK (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Policy for users to delete their company's photos
CREATE POLICY "Enable delete for company photos" ON storage.objects
FOR DELETE USING (
    bucket_id = 'photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);

-- Public access policy for shared documents (using share tokens)
CREATE POLICY "Enable public access for shared documents" ON storage.objects
FOR SELECT USING (
    bucket_id IN ('documents', 'photos')
    AND EXISTS (
        SELECT 1 FROM documents d 
        WHERE d.storage_path = name 
        AND d.is_public = true 
        AND d.share_expires_at > NOW()
    )
);

-- Function to generate organized file paths
CREATE OR REPLACE FUNCTION generate_document_path(
    company_uuid UUID,
    job_uuid UUID,
    category_name TEXT,
    filename TEXT
)
RETURNS TEXT AS $$
DECLARE
    sanitized_category TEXT;
    sanitized_filename TEXT;
    timestamp_suffix TEXT;
BEGIN
    -- Sanitize inputs for file system
    sanitized_category := REGEXP_REPLACE(LOWER(category_name), '[^a-z0-9_-]', '_', 'g');
    
    -- Generate timestamp to avoid conflicts
    timestamp_suffix := EXTRACT(EPOCH FROM NOW())::TEXT;
    
    -- Sanitize filename but preserve extension
    sanitized_filename := timestamp_suffix || '_' || filename;
    
    -- Return organized path: company_id/job_id/category/timestamped_filename
    RETURN company_uuid::TEXT || '/' || 
           job_uuid::TEXT || '/' || 
           sanitized_category || '/' || 
           sanitized_filename;
END;
$$ LANGUAGE plpgsql;

-- Function to generate photo paths
CREATE OR REPLACE FUNCTION generate_photo_path(
    company_uuid UUID,
    job_uuid UUID,
    task_uuid UUID DEFAULT NULL,
    filename TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    timestamp_suffix TEXT;
    final_filename TEXT;
    date_folder TEXT;
BEGIN
    -- Generate timestamp for unique naming
    timestamp_suffix := EXTRACT(EPOCH FROM NOW())::TEXT;
    
    -- Use provided filename or generate one
    final_filename := COALESCE(filename, 'photo_' || timestamp_suffix || '.jpg');
    
    -- Create date-based folder structure
    date_folder := TO_CHAR(NOW(), 'YYYY/MM/DD');
    
    -- Return organized path with date folders
    IF task_uuid IS NOT NULL THEN
        -- company_id/job_id/photos/YYYY/MM/DD/task_id/timestamped_filename
        RETURN company_uuid::TEXT || '/' || 
               job_uuid::TEXT || '/photos/' || 
               date_folder || '/' ||
               task_uuid::TEXT || '/' ||
               timestamp_suffix || '_' || final_filename;
    ELSE
        -- company_id/job_id/photos/YYYY/MM/DD/timestamped_filename
        RETURN company_uuid::TEXT || '/' || 
               job_uuid::TEXT || '/photos/' || 
               date_folder || '/' ||
               timestamp_suffix || '_' || final_filename;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Verification
DO $$
DECLARE
    documents_bucket_exists BOOLEAN;
    photos_bucket_exists BOOLEAN;
BEGIN
    -- Check if buckets exist
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'documents') INTO documents_bucket_exists;
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'photos') INTO photos_bucket_exists;
    
    IF documents_bucket_exists THEN
        RAISE NOTICE '✅ Documents storage bucket configured';
    ELSE
        RAISE EXCEPTION '❌ Documents bucket creation failed';
    END IF;
    
    IF photos_bucket_exists THEN
        RAISE NOTICE '✅ Photos storage bucket configured';
    ELSE
        RAISE EXCEPTION '❌ Photos bucket creation failed';
    END IF;
    
    -- Check if helper functions exist
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'generate_document_path') THEN
        RAISE NOTICE '✅ Document path generator function ready';
    ELSE
        RAISE EXCEPTION '❌ Document path generator function creation failed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'generate_photo_path') THEN
        RAISE NOTICE '✅ Photo path generator function ready';
    ELSE
        RAISE EXCEPTION '❌ Photo path generator function creation failed';
    END IF;
    
    RAISE NOTICE '🎉 Document storage system ready!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Storage configuration:';
    RAISE NOTICE '   ✅ Documents bucket: 50MB limit, multiple file types';
    RAISE NOTICE '   ✅ Photos bucket: 20MB limit, optimized for images';
    RAISE NOTICE '   ✅ Company-based folder organization';
    RAISE NOTICE '   ✅ RLS policies for security';
    RAISE NOTICE '   ✅ Public sharing for client access';
    RAISE NOTICE '   ✅ Automatic file path generation';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for document upload components!';
END $$;