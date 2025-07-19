-- Document Management System - INCREMENTAL FIX
-- This script safely updates existing installation to complete document management
-- Run this in Supabase SQL Editor

-- ============================================================================
-- PHASE 1: ANALYZE CURRENT STATE
-- ============================================================================

DO $$
DECLARE
    documents_exists BOOLEAN;
    categories_exists BOOLEAN;
    access_log_exists BOOLEAN;
    comments_exists BOOLEAN;
    task_id_exists BOOLEAN;
    company_id_exists BOOLEAN;
BEGIN
    RAISE NOTICE '🔍 Analyzing current database state...';
    
    -- Check if tables exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'documents'
    ) INTO documents_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'document_categories'
    ) INTO categories_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'document_access_log'
    ) INTO access_log_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'document_comments'
    ) INTO comments_exists;
    
    -- Check if documents table has required columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'task_id'
    ) INTO task_id_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'company_id'
    ) INTO company_id_exists;
    
    -- Report findings
    RAISE NOTICE '📊 Current state:';
    RAISE NOTICE '   Documents table: %', CASE WHEN documents_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '   Categories table: %', CASE WHEN categories_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '   Access log table: %', CASE WHEN access_log_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '   Comments table: %', CASE WHEN comments_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '   Documents.task_id: %', CASE WHEN task_id_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '   Documents.company_id: %', CASE WHEN company_id_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
END $$;

-- ============================================================================
-- PHASE 2: CREATE DOCUMENT CATEGORIES TABLE (FOUNDATION)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Phase 2: Creating document categories table...';
END $$;

CREATE TABLE IF NOT EXISTS document_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'FileText',
    color VARCHAR(50) DEFAULT 'gray',
    sort_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(name, company_id)
);

DO $$
BEGIN
    RAISE NOTICE '✅ Document categories table ready';
END $$;

-- ============================================================================
-- PHASE 3: UPDATE DOCUMENTS TABLE STRUCTURE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Phase 3: Updating documents table structure...';
    
    -- Add task_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'task_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN task_id UUID;
        RAISE NOTICE '✅ Added task_id column to documents table';
    ELSE
        RAISE NOTICE 'ℹ️ task_id column already exists in documents table';
    END IF;
    
    -- Add company_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'company_id'
    ) THEN
        -- Add column as nullable first
        ALTER TABLE documents ADD COLUMN company_id UUID;
        
        -- Populate with first company ID for existing rows
        UPDATE documents SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;
        
        -- Now make it NOT NULL
        ALTER TABLE documents ALTER COLUMN company_id SET NOT NULL;
        
        RAISE NOTICE '✅ Added company_id column to documents table';
    ELSE
        RAISE NOTICE 'ℹ️ company_id column already exists in documents table';
    END IF;
    
    -- Add category_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE documents ADD COLUMN category_id UUID;
        RAISE NOTICE '✅ Added category_id column to documents table';
    ELSE
        RAISE NOTICE 'ℹ️ category_id column already exists in documents table';
    END IF;
    
    -- Add other missing columns
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Untitled Document';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255) DEFAULT 'unknown.txt';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_extension VARCHAR(10) DEFAULT 'txt';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'text/plain';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT DEFAULT '';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100) DEFAULT 'documents';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_date DATE;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[];
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_document_id UUID;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS location_name TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP WITH TIME ZONE;
    
    -- Update NOT NULL constraints for required fields if they have defaults
    UPDATE documents SET title = 'Untitled Document' WHERE title IS NULL;
    UPDATE documents SET original_filename = 'unknown.txt' WHERE original_filename IS NULL;
    UPDATE documents SET file_extension = 'txt' WHERE file_extension IS NULL;
    UPDATE documents SET file_size = 0 WHERE file_size IS NULL;
    UPDATE documents SET mime_type = 'text/plain' WHERE mime_type IS NULL;
    UPDATE documents SET storage_path = '' WHERE storage_path IS NULL;
    
    -- Now make them NOT NULL
    ALTER TABLE documents ALTER COLUMN title SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN original_filename SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN file_extension SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN file_size SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN mime_type SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN storage_path SET NOT NULL;
    
    RAISE NOTICE '✅ Documents table structure updated';
END $$;

-- ============================================================================
-- PHASE 4: ADD FOREIGN KEY CONSTRAINTS SAFELY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Phase 4: Adding foreign key constraints...';
    
    -- Add task_id foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_task_id_fkey' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_task_id_fkey 
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added documents -> tasks foreign key';
    ELSE
        RAISE NOTICE 'ℹ️ Documents task_id foreign key already exists';
    END IF;
    
    -- Add company_id foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_company_id_fkey' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_company_id_fkey 
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added documents -> companies foreign key';
    ELSE
        RAISE NOTICE 'ℹ️ Documents company_id foreign key already exists';
    END IF;
    
    -- Add category_id foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_category_id_fkey' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES document_categories(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added documents -> categories foreign key';
    ELSE
        RAISE NOTICE 'ℹ️ Documents category_id foreign key already exists';
    END IF;
    
    -- Add parent_document_id foreign key constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_parent_document_id_fkey' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_parent_document_id_fkey 
        FOREIGN KEY (parent_document_id) REFERENCES documents(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added documents -> documents (parent) foreign key';
    ELSE
        RAISE NOTICE 'ℹ️ Documents parent_document_id foreign key already exists';
    END IF;
    
    -- Add unique constraint for share_token
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_share_token_key' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_share_token_key UNIQUE (share_token);
        RAISE NOTICE '✅ Added documents share_token unique constraint';
    ELSE
        RAISE NOTICE 'ℹ️ Documents share_token unique constraint already exists';
    END IF;
    
    -- Add unique constraint for storage_path + company_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_storage_path_company_id_key' AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_storage_path_company_id_key 
        UNIQUE (storage_path, company_id);
        RAISE NOTICE '✅ Added documents storage_path+company_id unique constraint';
    ELSE
        RAISE NOTICE 'ℹ️ Documents storage_path+company_id unique constraint already exists';
    END IF;
    
    RAISE NOTICE '✅ Foreign key constraints completed';
END $$;

-- ============================================================================
-- PHASE 5: CREATE SUPPORTING TABLES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Phase 5: Creating supporting tables...';
END $$;

CREATE TABLE IF NOT EXISTS document_access_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    accessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'download', 'share')),
    client_ip INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    comment_text TEXT NOT NULL,
    commented_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    RAISE NOTICE '✅ Supporting tables created';
END $$;

-- ============================================================================
-- PHASE 6: INSERT DEFAULT CATEGORIES
-- ============================================================================

DO $$
DECLARE
    company_record RECORD;
    category_count INTEGER;
BEGIN
    RAISE NOTICE '📋 Phase 6: Adding default document categories...';
    
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
            RAISE NOTICE 'ℹ️ Categories already exist for company: % (% categories)', company_record.id, category_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Default categories installation complete';
END $$;

-- ============================================================================
-- PHASE 7: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Phase 7: Creating indexes...';
END $$;

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

DO $$
BEGIN
    RAISE NOTICE '✅ Indexes created';
END $$;

-- ============================================================================
-- PHASE 8: CREATE TRIGGERS AND FUNCTIONS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Phase 8: Creating triggers and functions...';
END $$;

-- Create or replace helper functions
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate share token when document is made public
    IF NEW.is_public = TRUE AND (OLD.is_public = FALSE OR OLD.is_public IS NULL) THEN
        NEW.share_token := generate_share_token();
        NEW.share_expires_at := NOW() + INTERVAL '30 days';
    END IF;
    
    -- Clear share token when document is made private
    IF NEW.is_public = FALSE AND OLD.is_public = TRUE THEN
        NEW.share_token := NULL;
        NEW.share_expires_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_document_categories_updated_at') THEN
        CREATE TRIGGER update_document_categories_updated_at 
            BEFORE UPDATE ON document_categories
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for document_categories';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_documents_updated_at') THEN
        CREATE TRIGGER update_documents_updated_at 
            BEFORE UPDATE ON documents
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for documents';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_document_comments_updated_at') THEN
        CREATE TRIGGER update_document_comments_updated_at 
            BEFORE UPDATE ON document_comments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for document_comments';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_generate_share_token') THEN
        CREATE TRIGGER trigger_auto_generate_share_token
            BEFORE UPDATE ON documents
            FOR EACH ROW
            EXECUTE FUNCTION auto_generate_share_token();
        RAISE NOTICE '✅ Created share token trigger';
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Triggers and functions created';
END $$;

-- ============================================================================
-- PHASE 9: FINAL VERIFICATION
-- ============================================================================

DO $$
DECLARE
    table_count INTEGER;
    category_count INTEGER;
    company_count INTEGER;
    column_count INTEGER;
    constraint_count INTEGER;
BEGIN
    RAISE NOTICE '📋 Phase 9: Final verification...';
    
    -- Check all tables exist
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_name IN ('documents', 'document_categories', 'document_access_log', 'document_comments');
    
    -- Check required columns exist
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'documents' 
    AND column_name IN ('task_id', 'company_id', 'category_id', 'title', 'storage_path');
    
    -- Check foreign key constraints
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE table_name = 'documents' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN ('documents_task_id_fkey', 'documents_company_id_fkey', 'documents_category_id_fkey');
    
    SELECT COUNT(*) INTO category_count FROM document_categories WHERE is_system = true;
    SELECT COUNT(*) INTO company_count FROM companies;
    
    -- Report results
    RAISE NOTICE '';
    RAISE NOTICE '📊 VERIFICATION RESULTS:';
    RAISE NOTICE '   Tables created: % of 4 expected', table_count;
    RAISE NOTICE '   Required columns: % of 5 expected', column_count;
    RAISE NOTICE '   Foreign key constraints: % of 3 expected', constraint_count;
    RAISE NOTICE '   Default categories: % total', category_count;
    RAISE NOTICE '   Companies served: %', company_count;
    
    IF table_count = 4 AND column_count = 5 AND constraint_count = 3 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉🎉🎉 DOCUMENT MANAGEMENT SYSTEM SUCCESSFULLY INSTALLED! 🎉🎉🎉';
        RAISE NOTICE '';
        RAISE NOTICE '✅ All tables created successfully';
        RAISE NOTICE '✅ All foreign key constraints working';
        RAISE NOTICE '✅ Default categories populated';
        RAISE NOTICE '✅ Indexes and triggers configured';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 System ready for document uploads and management!';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ INSTALLATION INCOMPLETE - Some components missing';
        RAISE NOTICE '   Please check the verification results above';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '   1. Run the storage buckets script (11-document-storage-buckets-fixed.sql)';
    RAISE NOTICE '   2. Test document upload functionality';
    RAISE NOTICE '   3. Verify document sharing works correctly';
END $$;