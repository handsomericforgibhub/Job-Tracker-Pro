-- Custom Migration Script for Existing Database
-- Based on actual database structure analysis
-- This script only adds missing company_id fields and enables RLS where needed

BEGIN;

-- =============================================
-- Add company_id to tables that are missing it
-- =============================================

-- 1. Add company_id to users table (critical for RLS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Set to first company for existing users (manual review needed)
        UPDATE users 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
    END IF;
END $$;

-- 2. Add company_id to tasks table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Try to get company_id from related job if exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'job_id') THEN
            UPDATE tasks 
            SET company_id = j.company_id
            FROM jobs j
            WHERE tasks.job_id = j.id AND tasks.company_id IS NULL;
        END IF;
        
        -- Set remaining to first company
        UPDATE tasks 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE tasks ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
    END IF;
END $$;

-- 3. Add company_id to job_tasks table (if missing)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_tasks' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE job_tasks ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        UPDATE job_tasks 
        SET company_id = j.company_id
        FROM jobs j
        WHERE job_tasks.job_id = j.id AND job_tasks.company_id IS NULL;
        
        ALTER TABLE job_tasks ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_job_tasks_company_id ON job_tasks(company_id);
    END IF;
END $$;

-- 4. Add company_id to workers table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workers' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE workers ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Try to get from user relationship if exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'user_id') THEN
            UPDATE workers 
            SET company_id = u.company_id
            FROM users u
            WHERE workers.user_id = u.id AND workers.company_id IS NULL;
        END IF;
        
        UPDATE workers 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE workers ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_workers_company_id ON workers(company_id);
    END IF;
END $$;

-- 5. Add company_id to worker_skills table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_skills' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE worker_skills ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Get from workers table
        UPDATE worker_skills 
        SET company_id = w.company_id
        FROM workers w
        WHERE worker_skills.worker_id = w.id AND worker_skills.company_id IS NULL;
        
        UPDATE worker_skills 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)  
        WHERE company_id IS NULL;
        
        ALTER TABLE worker_skills ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_worker_skills_company_id ON worker_skills(company_id);
    END IF;
END $$;

-- 6. Add company_id to worker_licenses table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_licenses' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE worker_licenses ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Get from workers table
        UPDATE worker_licenses 
        SET company_id = w.company_id
        FROM workers w
        WHERE worker_licenses.worker_id = w.id AND worker_licenses.company_id IS NULL;
        
        UPDATE worker_licenses 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE worker_licenses ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_worker_licenses_company_id ON worker_licenses(company_id);
    END IF;
END $$;

-- 7. Add company_id to time_entries table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'time_entries' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE time_entries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Get from users table if user_id exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'user_id') THEN
            UPDATE time_entries 
            SET company_id = u.company_id
            FROM users u
            WHERE time_entries.user_id = u.id AND time_entries.company_id IS NULL;
        END IF;
        
        UPDATE time_entries 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE time_entries ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);
    END IF;
END $$;

-- 8. Add company_id to time_approvals table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'time_approvals' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE time_approvals ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Get from time_entries if exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_approvals' AND column_name = 'time_entry_id') THEN
            UPDATE time_approvals 
            SET company_id = te.company_id
            FROM time_entries te
            WHERE time_approvals.time_entry_id = te.id AND time_approvals.company_id IS NULL;
        END IF;
        
        UPDATE time_approvals 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE time_approvals ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_time_approvals_company_id ON time_approvals(company_id);
    END IF;
END $$;

-- 9. Add company_id to overtime_rules table  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'overtime_rules' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE overtime_rules ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        UPDATE overtime_rules 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE overtime_rules ALTER COLUMN company_id SET NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_overtime_rules_company_id ON overtime_rules(company_id);
    END IF;
END $$;

-- 10. Make document_categories.company_id NOT NULL
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_categories' AND column_name = 'company_id' AND is_nullable = 'YES') THEN
        UPDATE document_categories 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE document_categories ALTER COLUMN company_id SET NOT NULL;
    END IF;
END $$;

-- =============================================
-- Enable RLS on tables that don't have it
-- =============================================

-- Core business tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Document tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

-- Worker tables
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_licenses ENABLE ROW LEVEL SECURITY;

-- Time tracking tables
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_summaries ENABLE ROW LEVEL SECURITY;

-- Other tables
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper Functions (if not already created)
-- =============================================

-- Function to get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is site admin
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM users 
        WHERE id = auth.uid() 
        AND role = 'site_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has company access
CREATE OR REPLACE FUNCTION has_company_access(target_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Site admins have access to all companies
    IF is_site_admin() THEN
        RETURN TRUE;
    END IF;
    
    -- Regular users only have access to their own company
    RETURN (
        SELECT company_id = target_company_id 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Create RLS Policies for newly enabled tables
-- =============================================

-- Companies: Site admins see all, users see only their company
DROP POLICY IF EXISTS "company_access_policy" ON companies;
CREATE POLICY "company_access_policy" ON companies
    FOR ALL USING (
        is_site_admin() 
        OR id = get_user_company_id()
    );

-- Users: Site admins see all, users see only their company's users
DROP POLICY IF EXISTS "users_access_policy" ON users;
CREATE POLICY "users_access_policy" ON users
    FOR ALL USING (
        is_site_admin() 
        OR company_id = get_user_company_id()
    );

-- Jobs: Users can only access their company's jobs
DROP POLICY IF EXISTS "jobs_access_policy" ON jobs;
CREATE POLICY "jobs_access_policy" ON jobs
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Tasks: Users can only access their company's tasks
DROP POLICY IF EXISTS "tasks_access_policy" ON tasks;
CREATE POLICY "tasks_access_policy" ON tasks
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Documents: Users can only access their company's documents
DROP POLICY IF EXISTS "documents_access_policy" ON documents;
CREATE POLICY "documents_access_policy" ON documents
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Document Categories
DROP POLICY IF EXISTS "document_categories_access_policy" ON document_categories;
CREATE POLICY "document_categories_access_policy" ON document_categories
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Workers
DROP POLICY IF EXISTS "workers_access_policy" ON workers;
CREATE POLICY "workers_access_policy" ON workers
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Worker Skills
DROP POLICY IF EXISTS "worker_skills_access_policy" ON worker_skills;
CREATE POLICY "worker_skills_access_policy" ON worker_skills
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Worker Licenses  
DROP POLICY IF EXISTS "worker_licenses_access_policy" ON worker_licenses;
CREATE POLICY "worker_licenses_access_policy" ON worker_licenses
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Time Entries
DROP POLICY IF EXISTS "time_entries_access_policy" ON time_entries;
CREATE POLICY "time_entries_access_policy" ON time_entries
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Time Approvals
DROP POLICY IF EXISTS "time_approvals_access_policy" ON time_approvals;
CREATE POLICY "time_approvals_access_policy" ON time_approvals
    FOR ALL USING (
        has_company_access(company_id)
    );

-- Overtime Rules
DROP POLICY IF EXISTS "overtime_rules_access_policy" ON overtime_rules;
CREATE POLICY "overtime_rules_access_policy" ON overtime_rules
    FOR ALL USING (
        has_company_access(company_id)
    );

COMMIT;

-- =============================================
-- Verification
-- =============================================

-- Check which tables now have company_id
SELECT 
    table_name,
    column_name,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND column_name = 'company_id'
ORDER BY table_name;

-- Check RLS status
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('companies', 'users', 'jobs', 'tasks', 'documents', 'workers', 'time_entries')
ORDER BY tablename;

SELECT 'Custom migration completed successfully - company_id fields added and RLS policies created' as status;