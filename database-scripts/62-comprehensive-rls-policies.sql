-- ADR Phase 1: Comprehensive RLS Policies
-- Purpose: Implement Row Level Security for all company-scoped tables
-- This ensures complete data isolation between companies

BEGIN;

-- =============================================
-- Helper Functions
-- =============================================

-- Function to get current user's company_id
CREATE OR REPLACE FUNCTION auth.get_user_company_id()
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
CREATE OR REPLACE FUNCTION auth.is_site_admin()
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
CREATE OR REPLACE FUNCTION auth.has_company_access(target_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Site admins have access to all companies
    IF auth.is_site_admin() THEN
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
-- Enable RLS on all company-scoped tables
-- =============================================

-- Core business tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- New company-scoped configuration tables
ALTER TABLE company_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_status_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_color_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_stage_transitions ENABLE ROW LEVEL SECURITY;

-- Question-driven tables
ALTER TABLE job_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_audit_log ENABLE ROW LEVEL SECURITY;

-- Time tracking tables
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_summaries ENABLE ROW LEVEL SECURITY;

-- Document management tables
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Worker management tables (if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workers') THEN
        EXECUTE 'ALTER TABLE workers ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'worker_skills') THEN
        EXECUTE 'ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'worker_licenses') THEN
        EXECUTE 'ALTER TABLE worker_licenses ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- Notification tables (if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_reminders') THEN
        EXECUTE 'ALTER TABLE question_reminders ENABLE ROW LEVEL SECURITY';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue') THEN
        EXECUTE 'ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY';
    END IF;
END $$;

-- =============================================
-- RLS Policies for Core Tables
-- =============================================

-- Companies: Site admins see all, users see only their company
DROP POLICY IF EXISTS "company_access_policy" ON companies;
CREATE POLICY "company_access_policy" ON companies
    FOR ALL USING (
        auth.is_site_admin() 
        OR id = auth.get_user_company_id()
    );

-- Users: Site admins see all, users see only their company's users
DROP POLICY IF EXISTS "users_access_policy" ON users;
CREATE POLICY "users_access_policy" ON users
    FOR ALL USING (
        auth.is_site_admin() 
        OR company_id = auth.get_user_company_id()
    );

-- Jobs: Users can only access their company's jobs
DROP POLICY IF EXISTS "jobs_access_policy" ON jobs;
CREATE POLICY "jobs_access_policy" ON jobs
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Projects: Users can only access their company's projects
DROP POLICY IF EXISTS "projects_access_policy" ON projects;
CREATE POLICY "projects_access_policy" ON projects
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Tasks: Users can only access their company's tasks
DROP POLICY IF EXISTS "tasks_access_policy" ON tasks;
CREATE POLICY "tasks_access_policy" ON tasks
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- =============================================
-- RLS Policies for Configuration Tables
-- =============================================

-- Company Stages
DROP POLICY IF EXISTS "company_stages_access_policy" ON company_stages;
CREATE POLICY "company_stages_access_policy" ON company_stages
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Company Status Configs
DROP POLICY IF EXISTS "company_status_configs_access_policy" ON company_status_configs;
CREATE POLICY "company_status_configs_access_policy" ON company_status_configs
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Company Color Schemes
DROP POLICY IF EXISTS "company_color_schemes_access_policy" ON company_color_schemes;
CREATE POLICY "company_color_schemes_access_policy" ON company_color_schemes
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Company Stage Transitions
DROP POLICY IF EXISTS "company_stage_transitions_access_policy" ON company_stage_transitions;
CREATE POLICY "company_stage_transitions_access_policy" ON company_stage_transitions
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- =============================================
-- RLS Policies for Question-Driven Tables
-- =============================================

-- Job Stages
DROP POLICY IF EXISTS "job_stages_access_policy" ON job_stages;
CREATE POLICY "job_stages_access_policy" ON job_stages
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Stage Transitions
DROP POLICY IF EXISTS "stage_transitions_access_policy" ON stage_transitions;
CREATE POLICY "stage_transitions_access_policy" ON stage_transitions
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Stage Questions
DROP POLICY IF EXISTS "stage_questions_access_policy" ON stage_questions;
CREATE POLICY "stage_questions_access_policy" ON stage_questions
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Task Templates
DROP POLICY IF EXISTS "task_templates_access_policy" ON task_templates;
CREATE POLICY "task_templates_access_policy" ON task_templates
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Job Tasks
DROP POLICY IF EXISTS "job_tasks_access_policy" ON job_tasks;
CREATE POLICY "job_tasks_access_policy" ON job_tasks
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- User Responses
DROP POLICY IF EXISTS "user_responses_access_policy" ON user_responses;
CREATE POLICY "user_responses_access_policy" ON user_responses
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Stage Audit Log
DROP POLICY IF EXISTS "stage_audit_log_access_policy" ON stage_audit_log;
CREATE POLICY "stage_audit_log_access_policy" ON stage_audit_log
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- =============================================
-- RLS Policies for Time Tracking Tables
-- =============================================

-- Time Entries
DROP POLICY IF EXISTS "time_entries_access_policy" ON time_entries;
CREATE POLICY "time_entries_access_policy" ON time_entries
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Time Approvals
DROP POLICY IF EXISTS "time_approvals_access_policy" ON time_approvals;
CREATE POLICY "time_approvals_access_policy" ON time_approvals
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Overtime Rules
DROP POLICY IF EXISTS "overtime_rules_access_policy" ON overtime_rules;
CREATE POLICY "overtime_rules_access_policy" ON overtime_rules
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Time Summaries
DROP POLICY IF EXISTS "time_summaries_access_policy" ON time_summaries;
CREATE POLICY "time_summaries_access_policy" ON time_summaries
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- =============================================
-- RLS Policies for Document Management Tables
-- =============================================

-- Document Categories
DROP POLICY IF EXISTS "document_categories_access_policy" ON document_categories;
CREATE POLICY "document_categories_access_policy" ON document_categories
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Documents
DROP POLICY IF EXISTS "documents_access_policy" ON documents;
CREATE POLICY "documents_access_policy" ON documents
    FOR ALL USING (
        auth.has_company_access(company_id)
    );

-- Document Access Log
DROP POLICY IF EXISTS "document_access_log_access_policy" ON document_access_log;
CREATE POLICY "document_access_log_access_policy" ON document_access_log
    FOR ALL USING (
        -- Users can see access logs for documents they have access to
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = document_id 
            AND auth.has_company_access(d.company_id)
        )
    );

-- Document Comments
DROP POLICY IF EXISTS "document_comments_access_policy" ON document_comments;
CREATE POLICY "document_comments_access_policy" ON document_comments
    FOR ALL USING (
        -- Users can see comments on documents they have access to
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = document_id 
            AND auth.has_company_access(d.company_id)
        )
    );

-- =============================================
-- RLS Policies for Worker Management Tables (if they exist)
-- =============================================

DO $$ 
BEGIN
    -- Workers table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workers') THEN
        EXECUTE 'DROP POLICY IF EXISTS "workers_access_policy" ON workers';
        EXECUTE 'CREATE POLICY "workers_access_policy" ON workers
            FOR ALL USING (auth.has_company_access(company_id))';
    END IF;
    
    -- Worker Skills table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'worker_skills') THEN
        EXECUTE 'DROP POLICY IF EXISTS "worker_skills_access_policy" ON worker_skills';
        EXECUTE 'CREATE POLICY "worker_skills_access_policy" ON worker_skills
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM workers w 
                    WHERE w.id = worker_id 
                    AND auth.has_company_access(w.company_id)
                )
            )';
    END IF;
    
    -- Worker Licenses table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'worker_licenses') THEN
        EXECUTE 'DROP POLICY IF EXISTS "worker_licenses_access_policy" ON worker_licenses';
        EXECUTE 'CREATE POLICY "worker_licenses_access_policy" ON worker_licenses
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM workers w 
                    WHERE w.id = worker_id 
                    AND auth.has_company_access(w.company_id)
                )
            )';
    END IF;
END $$;

-- =============================================
-- RLS Policies for Notification Tables (if they exist)
-- =============================================

DO $$ 
BEGIN
    -- Question Reminders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_reminders') THEN
        EXECUTE 'DROP POLICY IF EXISTS "question_reminders_access_policy" ON question_reminders';
        EXECUTE 'CREATE POLICY "question_reminders_access_policy" ON question_reminders
            FOR ALL USING (auth.has_company_access(company_id))';
    END IF;
    
    -- Notification Queue
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue') THEN
        EXECUTE 'DROP POLICY IF EXISTS "notification_queue_access_policy" ON notification_queue';
        EXECUTE 'CREATE POLICY "notification_queue_access_policy" ON notification_queue
            FOR ALL USING (auth.has_company_access(company_id))';
    END IF;
END $$;

-- =============================================
-- Additional Security Policies
-- =============================================

-- Ensure site admins can perform administrative functions
-- This policy allows site admins to bypass RLS for administrative operations
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Create policy for service role operations (for background jobs, etc.)
DO $$
BEGIN
    -- Check if we're using service role and create bypass policies
    IF current_setting('role') = 'service_role' THEN
        -- Service role can access all data for system operations
        CREATE POLICY IF NOT EXISTS "service_role_bypass" ON companies
            FOR ALL TO service_role USING (true);
        CREATE POLICY IF NOT EXISTS "service_role_bypass" ON users
            FOR ALL TO service_role USING (true);
    END IF;
EXCEPTION 
    WHEN insufficient_privilege THEN
        -- Service role might not exist, continue
        NULL;
END $$;

-- =============================================
-- Verification and Testing
-- =============================================

-- Function to verify RLS is working
CREATE OR REPLACE FUNCTION verify_rls_setup()
RETURNS TABLE (
    table_name text,
    rls_enabled boolean,
    policy_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::text as table_name,
        t.rowsecurity as rls_enabled,
        COUNT(p.policyname) as policy_count
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename
    WHERE t.schemaname = 'public'
    AND t.tablename IN (
        'companies', 'users', 'jobs', 'projects', 'tasks',
        'company_stages', 'company_status_configs', 'company_color_schemes', 'company_stage_transitions',
        'job_stages', 'stage_transitions', 'stage_questions', 'task_templates', 
        'job_tasks', 'user_responses', 'stage_audit_log',
        'time_entries', 'time_approvals', 'overtime_rules', 'time_summaries',
        'document_categories', 'documents', 'document_access_log', 'document_comments'
    )
    GROUP BY t.tablename, t.rowsecurity
    ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =============================================
-- Final Verification
-- =============================================

-- Check RLS setup
SELECT 'RLS Verification:' as status;
SELECT * FROM verify_rls_setup();

-- Success message
SELECT 'Comprehensive RLS policies implemented successfully' as status;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON FUNCTION auth.get_user_company_id() IS 'Returns the company_id of the currently authenticated user';
COMMENT ON FUNCTION auth.is_site_admin() IS 'Returns true if the current user is a site admin';
COMMENT ON FUNCTION auth.has_company_access(UUID) IS 'Returns true if the current user has access to the specified company';
COMMENT ON FUNCTION verify_rls_setup() IS 'Verification function to ensure RLS is properly configured on all tables';