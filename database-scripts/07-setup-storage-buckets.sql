-- Setup Supabase Storage Buckets for File Uploads
-- Run this in Supabase SQL Editor

-- Create worker-licenses storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'worker-licenses',
  'worker-licenses', 
  true, -- public bucket for easy access
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create general documents bucket (for future use)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB limit 
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for worker-licenses bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload worker license files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'worker-licenses' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view files (since bucket is public, this is mainly for consistency)
CREATE POLICY "Authenticated users can view worker license files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'worker-licenses'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update worker license files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'worker-licenses'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete files (for re-uploads)
CREATE POLICY "Authenticated users can delete worker license files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'worker-licenses'
  AND auth.role() = 'authenticated'
);

-- Create storage policies for documents bucket
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'documents' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can view documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update documents" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents'
  AND auth.role() = 'authenticated'
);

-- Verify buckets were created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'worker-licenses') THEN
        RAISE NOTICE '✅ worker-licenses bucket created';
    ELSE
        RAISE EXCEPTION '❌ worker-licenses bucket creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
        RAISE NOTICE '✅ documents bucket created';
    ELSE
        RAISE EXCEPTION '❌ documents bucket creation failed';
    END IF;

    RAISE NOTICE '🎉 Storage buckets setup completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📁 Available buckets:';
    RAISE NOTICE '   - worker-licenses (5MB limit, PDF/JPG/PNG)';
    RAISE NOTICE '   - documents (10MB limit, multiple formats)';
END $$;