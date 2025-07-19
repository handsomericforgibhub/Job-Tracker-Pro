-- Document Management System Database Schema (SAFE VERSION)
-- Phase 6: Comprehensive document management for JobTracker Pro
-- Run this in Supabase SQL Editor

-- First, ensure tasks table has all required columns
DO $$
BEGIN
    -- Add parent_task_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added parent_task_id column to tasks table';
    ELSE
        RAISE NOTICE 'ℹ️ parent_task_id column already exists in tasks table';
    END IF;

    -- Add sort_order column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added sort_order column to tasks table';
    ELSE
        RAISE NOTICE 'ℹ️ sort_order column already exists in tasks table';
    END IF;
END $$;

-- Create document categories table for organization
CREATE TABLE IF NOT EXISTS document_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'FileText', -- Lucide icon name
    color VARCHAR(50) DEFAULT 'gray', -- Color theme
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE, -- System categories can't be deleted
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(name, company_id)
);

-- Create main documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Basic document info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    file_size BIGINT NOT NULL, -- Size in bytes
    mime_type VARCHAR(100) NOT NULL,
    
    -- Storage info
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    storage_bucket VARCHAR(100) DEFAULT 'documents',
    file_url TEXT, -- Public URL if shared
    
    -- Organization
    category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    task_id UUID, -- Will add foreign key constraint after ensuring column exists
    
    -- Metadata
    document_date DATE, -- When the document was created/relevant (not uploaded)
    tags TEXT[], -- Array of tags for search
    version_number INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL, -- For versioning
    
    -- GPS and location data (for photos taken on-site)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name TEXT, -- Human readable location
    
    -- Permissions and sharing
    is_public BOOLEAN DEFAULT FALSE, -- Can be shared with clients
    share_token VARCHAR(255) UNIQUE, -- For secure public sharing
    share_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure file paths are unique within a company
    UNIQUE(storage_path, company_id)
);

-- Now safely add the foreign key constraint for task_id
DO $$
BEGIN
    -- Check if the foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_task_id_fkey'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE documents ADD CONSTRAINT documents_task_id_fkey 
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added foreign key constraint for documents.task_id';
    ELSE
        RAISE NOTICE 'ℹ️ Foreign key constraint for documents.task_id already exists';
    END IF;
END $$;

-- Create document access log for tracking views/downloads
CREATE TABLE IF NOT EXISTS document_access_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    accessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'download', 'share')),
    client_ip INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document comments for collaboration
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    comment_text TEXT NOT NULL,
    commented_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default document categories for each company
DO $$
DECLARE
    company_record RECORD;
    category_count INTEGER;
BEGIN
    FOR company_record IN SELECT id FROM companies LOOP
        -- Check if categories already exist for this company
        SELECT COUNT(*) INTO category_count 
        FROM document_categories 
        WHERE company_id = company_record.id AND is_system = true;
        
        IF category_count = 0 THEN
            INSERT INTO document_categories (name, description, icon, color, sort_order, is_system, company_id) 
            VALUES 
                ('Contracts', 'Contracts, agreements, and legal documents', 'FileSignature', 'blue', 1, true, company_record.id),
                ('Permits', 'Building permits and regulatory documents', 'FileCheck', 'green', 2, true, company_record.id),
                ('Photos', 'Progress photos and site images', 'Camera', 'purple', 3, true, company_record.id),
                ('Reports', 'Daily reports, inspection reports, and logs', 'FileText', 'orange', 4, true, company_record.id),
                ('Receipts', 'Material receipts, invoices, and expenses', 'Receipt', 'yellow', 5, true, company_record.id),
                ('Safety', 'Safety documents, checklists, and certifications', 'Shield', 'red', 6, true, company_record.id),
                ('Plans', 'Blueprints, drawings, and technical plans', 'FileImage', 'indigo', 7, true, company_record.id),
                ('Correspondence', 'Emails, letters, and client communication', 'Mail', 'gray', 8, true, company_record.id),
                ('Other', 'Miscellaneous documents', 'File', 'slate', 9, true, company_record.id);
            
            RAISE NOTICE '✅ Default categories added for company: %', company_record.id;
        ELSE
            RAISE NOTICE 'ℹ️ Categories already exist for company: %', company_record.id;
        END IF;
    END LOOP;
END $$;

-- Add updated_at triggers (only if they don't already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_document_categories_updated_at'
    ) THEN
        CREATE TRIGGER update_document_categories_updated_at 
            BEFORE UPDATE ON document_categories
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for document_categories';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_documents_updated_at'
    ) THEN
        CREATE TRIGGER update_documents_updated_at 
            BEFORE UPDATE ON documents
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for documents';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_document_comments_updated_at'
    ) THEN
        CREATE TRIGGER update_document_comments_updated_at 
            BEFORE UPDATE ON document_comments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for document_comments';
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_job_id ON documents(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_document_date ON documents(document_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_share_token ON documents(share_token) WHERE share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_log_accessed_at ON document_access_log(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created_at ON document_comments(created_at DESC);

-- Function to generate secure share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate share token when document is made public
CREATE OR REPLACE FUNCTION auto_generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate share token when document is made public
    IF NEW.is_public = TRUE AND (OLD.is_public = FALSE OR OLD.is_public IS NULL) THEN
        NEW.share_token := generate_share_token();
        NEW.share_expires_at := NOW() + INTERVAL '30 days'; -- Default 30 day expiry
    END IF;
    
    -- Clear share token when document is made private
    IF NEW.is_public = FALSE AND OLD.is_public = TRUE THEN
        NEW.share_token := NULL;
        NEW.share_expires_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for share token management (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_auto_generate_share_token'
    ) THEN
        CREATE TRIGGER trigger_auto_generate_share_token
            BEFORE UPDATE ON documents
            FOR EACH ROW
            EXECUTE FUNCTION auto_generate_share_token();
        RAISE NOTICE '✅ Created share token trigger';
    END IF;
END $$;

-- Verification and setup complete message
DO $$
DECLARE
    task_columns_exist BOOLEAN;
    documents_table_exists BOOLEAN;
    categories_table_exists BOOLEAN;
    default_categories_count INTEGER;
BEGIN
    -- Check if tasks table has required columns
    SELECT 
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'tasks' AND column_name IN ('parent_task_id', 'sort_order')) = 2
    INTO task_columns_exist;
    
    -- Check tables were created
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') 
    INTO documents_table_exists;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_categories') 
    INTO categories_table_exists;
    
    -- Check default categories
    SELECT COUNT(*) FROM document_categories WHERE is_system = true 
    INTO default_categories_count;

    IF task_columns_exist THEN
        RAISE NOTICE '✅ Tasks table updated with required columns';
    ELSE
        RAISE NOTICE '⚠️ Some columns missing from tasks table';
    END IF;

    IF documents_table_exists THEN
        RAISE NOTICE '✅ Documents table created';
    ELSE
        RAISE EXCEPTION '❌ Documents table creation failed';
    END IF;

    IF categories_table_exists THEN
        RAISE NOTICE '✅ Document categories table created';
    ELSE
        RAISE EXCEPTION '❌ Document categories table creation failed';
    END IF;

    IF default_categories_count > 0 THEN
        RAISE NOTICE '✅ Default document categories inserted (% categories)', default_categories_count;
    ELSE
        RAISE NOTICE '⚠️ No default categories found';
    END IF;

    RAISE NOTICE '🎉 Document Management System database schema ready!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Features available:';
    RAISE NOTICE '   ✅ Document storage with metadata';
    RAISE NOTICE '   ✅ Categorization and organization';
    RAISE NOTICE '   ✅ Job and task associations';
    RAISE NOTICE '   ✅ GPS location tracking for photos';
    RAISE NOTICE '   ✅ Version control and document history';
    RAISE NOTICE '   ✅ Secure public sharing with tokens';
    RAISE NOTICE '   ✅ Access logging and audit trail';
    RAISE NOTICE '   ✅ Document comments and collaboration';
    RAISE NOTICE '   ✅ Tag-based search and filtering';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Document management system is ready for use!';
END $$;