-- Document Management System Database Schema (ULTIMATE SAFE VERSION)
-- Phase 6: Comprehensive document management for JobTracker Pro
-- Run this in Supabase SQL Editor

-- Step 1: Ensure tasks table has all required columns
DO $$
BEGIN
    RAISE NOTICE '📋 Step 1: Updating tasks table...';
    
    -- Add parent_task_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN parent_task_id UUID;
        -- Add foreign key constraint separately
        ALTER TABLE tasks ADD CONSTRAINT tasks_parent_task_id_fkey 
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
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
    
    RAISE NOTICE '✅ Step 1 complete: Tasks table updated';
END $$;

-- Step 2: Create document categories table FIRST (no dependencies)
DO $$
BEGIN
    RAISE NOTICE '📋 Step 2: Creating document categories table...';
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
    RAISE NOTICE '✅ Step 2 complete: Document categories table created';
END $$;

-- Step 3: Create documents table (with all foreign key references)
DO $$
BEGIN
    RAISE NOTICE '📋 Step 3: Creating documents table...';
END $$;

CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Basic document info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_filename VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    
    -- Storage info
    storage_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'documents',
    file_url TEXT,
    
    -- Organization (all foreign keys should work now)
    category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- Metadata
    document_date DATE,
    tags TEXT[],
    version_number INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    -- GPS and location data
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_name TEXT,
    
    -- Permissions and sharing
    is_public BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(255) UNIQUE,
    share_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure file paths are unique within a company
    UNIQUE(storage_path, company_id)
);

DO $$
BEGIN
    RAISE NOTICE '✅ Step 3 complete: Documents table created';
END $$;

-- Step 4: Create supporting tables
DO $$
BEGIN
    RAISE NOTICE '📋 Step 4: Creating supporting tables...';
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
    RAISE NOTICE '✅ Step 4 complete: Supporting tables created';
END $$;

-- Step 5: Insert default document categories
DO $$
DECLARE
    company_record RECORD;
    category_count INTEGER;
BEGIN
    RAISE NOTICE '📋 Step 5: Inserting default categories...';
    
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
    
    RAISE NOTICE '✅ Step 5 complete: Default categories inserted';
END $$;

-- Step 6: Create triggers
DO $$
BEGIN
    RAISE NOTICE '📋 Step 6: Creating triggers...';
    
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
    
    RAISE NOTICE '✅ Step 6 complete: Triggers created';
END $$;

-- Step 7: Create indexes
DO $$
BEGIN
    RAISE NOTICE '📋 Step 7: Creating indexes...';
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
    RAISE NOTICE '✅ Step 7 complete: Indexes created';
END $$;

-- Step 8: Create helper functions
DO $$
BEGIN
    RAISE NOTICE '📋 Step 8: Creating helper functions...';
END $$;

CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_public = TRUE AND (OLD.is_public = FALSE OR OLD.is_public IS NULL) THEN
        NEW.share_token := generate_share_token();
        NEW.share_expires_at := NOW() + INTERVAL '30 days';
    END IF;
    
    IF NEW.is_public = FALSE AND OLD.is_public = TRUE THEN
        NEW.share_token := NULL;
        NEW.share_expires_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create share token trigger
DO $$
BEGIN
    RAISE NOTICE '📋 Step 9: Creating share token trigger...';
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_generate_share_token') THEN
        CREATE TRIGGER trigger_auto_generate_share_token
            BEFORE UPDATE ON documents
            FOR EACH ROW
            EXECUTE FUNCTION auto_generate_share_token();
        RAISE NOTICE '✅ Created share token trigger';
    END IF;
    
    RAISE NOTICE '✅ Step 9 complete: Share token trigger created';
END $$;

-- Step 10: Final verification
DO $$
DECLARE
    table_count INTEGER;
    category_count INTEGER;
    company_count INTEGER;
BEGIN
    RAISE NOTICE '📋 Step 10: Final verification...';
    
    -- Check all tables exist
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_name IN ('documents', 'document_categories', 'document_access_log', 'document_comments');
    
    SELECT COUNT(*) INTO category_count FROM document_categories WHERE is_system = true;
    SELECT COUNT(*) INTO company_count FROM companies;
    
    IF table_count = 4 THEN
        RAISE NOTICE '✅ All document management tables created (% tables)', table_count;
    ELSE
        RAISE NOTICE '⚠️ Some tables missing. Found % of 4 expected tables', table_count;
    END IF;
    
    IF category_count > 0 THEN
        RAISE NOTICE '✅ Default categories created (% categories for % companies)', category_count, company_count;
    ELSE
        RAISE NOTICE '⚠️ No default categories found';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉🎉🎉 DOCUMENT MANAGEMENT SYSTEM SETUP COMPLETE! 🎉🎉🎉';
    RAISE NOTICE '';
    RAISE NOTICE '📋 System ready with:';
    RAISE NOTICE '   ✅ Document storage with metadata and categorization';
    RAISE NOTICE '   ✅ Job and task associations';
    RAISE NOTICE '   ✅ GPS location tracking for photos';
    RAISE NOTICE '   ✅ Version control and document history';
    RAISE NOTICE '   ✅ Secure public sharing with tokens';
    RAISE NOTICE '   ✅ Access logging and audit trail';
    RAISE NOTICE '   ✅ Document comments and collaboration';
    RAISE NOTICE '   ✅ Tag-based search and filtering';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for document upload and management!';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Tables created:';
    RAISE NOTICE '   📄 documents - Main document storage';
    RAISE NOTICE '   📁 document_categories - Organization categories';
    RAISE NOTICE '   📊 document_access_log - Usage tracking';
    RAISE NOTICE '   💬 document_comments - Collaboration';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Next step: Test document upload functionality!';
END $$;