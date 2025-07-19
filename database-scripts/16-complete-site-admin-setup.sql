-- Complete Site Administrator Setup
-- This script creates all required tables and sets up the site admin role

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- STEP 1: CREATE ADMIN CONFIGURATION TABLES
-- =============================================

-- Create platform_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) NOT NULL CHECK (setting_type IN (
        'job_stages',
        'user_roles',
        'task_priorities',
        'task_statuses',
        'worker_skills',
        'document_categories',
        'time_tracking',
        'notification_settings',
        'system_limits',
        'integration_settings',
        'feature_toggles'
    )),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, setting_key)
);

-- Create workflow_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL CHECK (workflow_type IN (
        'job_progression',
        'task_workflow',
        'approval_chain',
        'notification_flow'
    )),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    workflow_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_audit_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'setting_update',
        'workflow_create',
        'workflow_update',
        'workflow_delete',
        'user_role_change',
        'permission_grant',
        'permission_revoke',
        'feature_toggle',
        'data_export',
        'data_import',
        'system_config'
    )),
    target_type VARCHAR(50),
    target_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- STEP 2: CREATE INDEXES
-- =============================================

-- Platform settings indexes
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_platform_settings_type ON platform_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_platform_settings_active ON platform_settings(is_active);

-- Company settings indexes
CREATE INDEX IF NOT EXISTS idx_company_settings_company_key ON company_settings(company_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_company_settings_type ON company_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_company_settings_active ON company_settings(is_active);

-- Workflow templates indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_type ON workflow_templates(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_company ON workflow_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_type ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- =============================================
-- STEP 3: CREATE UPDATED_AT TRIGGERS
-- =============================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Platform settings trigger
DROP TRIGGER IF EXISTS trigger_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trigger_platform_settings_updated_at
    BEFORE UPDATE ON platform_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Company settings trigger
DROP TRIGGER IF EXISTS trigger_company_settings_updated_at ON company_settings;
CREATE TRIGGER trigger_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Workflow templates trigger
DROP TRIGGER IF EXISTS trigger_workflow_templates_updated_at ON workflow_templates;
CREATE TRIGGER trigger_workflow_templates_updated_at
    BEFORE UPDATE ON workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- STEP 4: ENABLE RLS
-- =============================================

-- Enable RLS on all admin tables
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 5: UPDATE USER ROLE ENUM
-- =============================================

-- Add site_admin to the existing role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('owner', 'foreman', 'worker', 'site_admin'));

-- Make company_id nullable for site_admin users
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;

-- =============================================
-- STEP 6: UPDATE/CREATE SITE ADMIN USER
-- =============================================

-- First, check if the user already exists and update them
UPDATE users 
SET 
    role = 'site_admin',
    company_id = NULL,
    full_name = 'Site Administrator',
    updated_at = NOW()
WHERE email = 'handsomeric@hotmail.com';

-- If no rows were updated, we need to create the user
-- Note: This assumes the user exists in Supabase Auth
-- If they don't exist, they'll need to sign up first

-- =============================================
-- STEP 7: CREATE SITE ADMIN HELPER FUNCTIONS
-- =============================================

-- Function to check if current user is site admin
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'site_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all companies for site admin
CREATE OR REPLACE FUNCTION get_all_companies_for_site_admin()
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    user_count BIGINT,
    job_count BIGINT,
    active_job_count BIGINT
) AS $$
BEGIN
    -- Check if user is site admin
    IF NOT is_site_admin() THEN
        RAISE EXCEPTION 'Access denied. Only site admins can view all companies.';
    END IF;

    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.created_at,
        c.updated_at,
        COALESCE(user_counts.user_count, 0) as user_count,
        COALESCE(job_counts.job_count, 0) as job_count,
        COALESCE(job_counts.active_job_count, 0) as active_job_count
    FROM companies c
    LEFT JOIN (
        SELECT 
            company_id,
            COUNT(*) as user_count
        FROM users 
        WHERE company_id IS NOT NULL
        GROUP BY company_id
    ) user_counts ON c.id = user_counts.company_id
    LEFT JOIN (
        SELECT 
            company_id,
            COUNT(*) as job_count,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_job_count
        FROM jobs 
        GROUP BY company_id
    ) job_counts ON c.id = job_counts.company_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get platform statistics for site admin
CREATE OR REPLACE FUNCTION get_platform_statistics()
RETURNS TABLE (
    total_companies BIGINT,
    total_users BIGINT,
    total_jobs BIGINT,
    active_jobs BIGINT,
    total_workers BIGINT,
    recent_signups BIGINT
) AS $$
BEGIN
    -- Check if user is site admin
    IF NOT is_site_admin() THEN
        RAISE EXCEPTION 'Access denied. Only site admins can view platform statistics.';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM companies) as total_companies,
        (SELECT COUNT(*) FROM users WHERE role != 'site_admin') as total_users,
        (SELECT COUNT(*) FROM jobs) as total_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'active') as active_jobs,
        (SELECT COUNT(*) FROM users WHERE role = 'worker') as total_workers,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days' AND role != 'site_admin') as recent_signups;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_action_type VARCHAR(50),
    p_target_type VARCHAR(50) DEFAULT NULL,
    p_target_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user
    current_user_id := auth.uid();
    
    -- Insert audit log entry
    INSERT INTO admin_audit_log (
        admin_user_id,
        action_type,
        target_type,
        target_id,
        old_values,
        new_values,
        description,
        ip_address,
        user_agent,
        company_id
    ) VALUES (
        current_user_id,
        p_action_type,
        p_target_type,
        p_target_id,
        p_old_values,
        p_new_values,
        p_description,
        p_ip_address,
        p_user_agent,
        p_company_id
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_site_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_companies_for_site_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_action(VARCHAR(50), VARCHAR(50), UUID, JSONB, JSONB, TEXT, INET, TEXT, UUID) TO authenticated;

-- =============================================
-- STEP 8: CREATE SITE ADMIN VIEWS
-- =============================================

-- View for site admin to see all users across companies
CREATE OR REPLACE VIEW site_admin_users_view AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    u.created_at,
    u.updated_at,
    c.name as company_name
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
WHERE is_site_admin() = true
ORDER BY u.created_at DESC;

-- View for site admin to see all jobs across companies
CREATE OR REPLACE VIEW site_admin_jobs_view AS
SELECT 
    j.id,
    j.title,
    j.description,
    j.status,
    j.start_date,
    j.end_date,
    j.budget,
    j.client_name,
    j.company_id,
    j.created_at,
    j.updated_at,
    c.name as company_name,
    u.full_name as created_by_name
FROM jobs j
LEFT JOIN companies c ON j.company_id = c.id
LEFT JOIN users u ON j.created_by = u.id
WHERE is_site_admin() = true
ORDER BY j.created_at DESC;

-- Grant select permissions on views
GRANT SELECT ON site_admin_users_view TO authenticated;
GRANT SELECT ON site_admin_jobs_view TO authenticated;

-- =============================================
-- STEP 9: CREATE/UPDATE RLS POLICIES
-- =============================================

-- Companies table - site admin and company users can see their companies
DROP POLICY IF EXISTS "Users can view companies" ON companies;
CREATE POLICY "Users can view companies" ON companies 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            users.company_id = companies.id
        )
    )
);

-- Jobs table - site admin and company users can see their jobs
DROP POLICY IF EXISTS "Users can view jobs" ON jobs;
CREATE POLICY "Users can view jobs" ON jobs 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            users.company_id = jobs.company_id
        )
    )
);

-- Jobs table - site admin and authorized users can create jobs
DROP POLICY IF EXISTS "Users can create jobs" ON jobs;
CREATE POLICY "Users can create jobs" ON jobs 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.company_id = jobs.company_id AND users.role IN ('owner', 'foreman'))
        )
    )
);

-- Jobs table - site admin and authorized users can update jobs
DROP POLICY IF EXISTS "Users can update jobs" ON jobs;
CREATE POLICY "Users can update jobs" ON jobs 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.company_id = jobs.company_id AND users.role IN ('owner', 'foreman'))
        )
    )
);

-- Jobs table - site admin and owners can delete jobs
DROP POLICY IF EXISTS "Users can delete jobs" ON jobs;
CREATE POLICY "Users can delete jobs" ON jobs 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.company_id = jobs.company_id AND users.role = 'owner')
        )
    )
);

-- Users table - site admin and company users can view users
DROP POLICY IF EXISTS "Users can view users" ON users;
CREATE POLICY "Users can view users" ON users 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'site_admin' OR 
            u.company_id = users.company_id
        )
    )
);

-- Users table - site admin and authorized users can create users
DROP POLICY IF EXISTS "Users can create users" ON users;
CREATE POLICY "Users can create users" ON users 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'site_admin' OR 
            (u.company_id = users.company_id AND u.role IN ('owner', 'foreman'))
        )
    )
);

-- Users table - site admin and authorized users can update users
DROP POLICY IF EXISTS "Users can update users" ON users;
CREATE POLICY "Users can update users" ON users 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'site_admin' OR 
            (u.company_id = users.company_id AND u.role IN ('owner', 'foreman'))
        )
    )
);

-- Platform settings policies
DROP POLICY IF EXISTS "Site admin and owners can view platform settings" ON platform_settings;
CREATE POLICY "Site admin and owners can view platform settings" ON platform_settings 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('site_admin', 'owner')
    )
);

DROP POLICY IF EXISTS "Site admin and owners can modify platform settings" ON platform_settings;
CREATE POLICY "Site admin and owners can modify platform settings" ON platform_settings 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('site_admin', 'owner')
    )
);

-- Company settings policies
DROP POLICY IF EXISTS "Users can view company settings" ON company_settings;
CREATE POLICY "Users can view company settings" ON company_settings 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND users.company_id = company_settings.company_id)
        )
    )
);

DROP POLICY IF EXISTS "Users can modify company settings" ON company_settings;
CREATE POLICY "Users can modify company settings" ON company_settings 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND users.company_id = company_settings.company_id)
        )
    )
);

-- Workflow templates policies
DROP POLICY IF EXISTS "Users can view workflow templates" ON workflow_templates;
CREATE POLICY "Users can view workflow templates" ON workflow_templates 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND (
                workflow_templates.company_id IS NULL OR 
                users.company_id = workflow_templates.company_id
            ))
        )
    )
);

DROP POLICY IF EXISTS "Users can modify workflow templates" ON workflow_templates;
CREATE POLICY "Users can modify workflow templates" ON workflow_templates 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND (
                workflow_templates.company_id IS NULL OR 
                users.company_id = workflow_templates.company_id
            ))
        )
    )
);

-- Audit log policies
DROP POLICY IF EXISTS "Users can view audit log" ON admin_audit_log;
CREATE POLICY "Users can view audit log" ON admin_audit_log 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND (
                admin_audit_log.company_id IS NULL OR 
                users.company_id = admin_audit_log.company_id
            ))
        )
    )
);

DROP POLICY IF EXISTS "Users can insert audit log entries" ON admin_audit_log;
CREATE POLICY "Users can insert audit log entries" ON admin_audit_log 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('site_admin', 'owner')
        AND users.id = admin_audit_log.admin_user_id
    )
);

-- =============================================
-- STEP 10: GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_templates TO authenticated;
GRANT SELECT, INSERT ON admin_audit_log TO authenticated;

-- =============================================
-- STEP 11: INSERT DEFAULT DATA
-- =============================================

-- Insert default job stages
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) 
VALUES (
    'default_job_stages',
    '[
        {
            "key": "planning",
            "label": "Planning",
            "color": "#6B7280",
            "description": "Job is in planning phase",
            "is_initial": true,
            "is_final": false,
            "allowed_transitions": ["active", "cancelled"]
        },
        {
            "key": "active",
            "label": "Active",
            "color": "#3B82F6",
            "description": "Job is actively in progress",
            "is_initial": false,
            "is_final": false,
            "allowed_transitions": ["on_hold", "completed", "cancelled"]
        },
        {
            "key": "on_hold",
            "label": "On Hold",
            "color": "#F59E0B",
            "description": "Job is temporarily paused",
            "is_initial": false,
            "is_final": false,
            "allowed_transitions": ["active", "cancelled"]
        },
        {
            "key": "completed",
            "label": "Completed",
            "color": "#10B981",
            "description": "Job has been completed successfully",
            "is_initial": false,
            "is_final": true,
            "allowed_transitions": []
        },
        {
            "key": "cancelled",
            "label": "Cancelled",
            "color": "#EF4444",
            "description": "Job has been cancelled",
            "is_initial": false,
            "is_final": true,
            "allowed_transitions": []
        }
    ]'::jsonb,
    'job_stages',
    'Default job status stages - can be customized by admins'
) ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- FINAL STEP: LOG THE IMPLEMENTATION
-- =============================================

-- Log the site admin implementation
INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    description,
    new_values,
    created_at
) VALUES (
    (SELECT id FROM users WHERE email = 'handsomeric@hotmail.com'),
    'system_config',
    'Complete site administrator role implementation',
    '{"role": "site_admin", "permissions": "cross_company_access", "implementation": "complete"}'::jsonb,
    NOW()
) ON CONFLICT DO NOTHING;

-- Success message
SELECT 
    'Site administrator role successfully implemented!' as message,
    'User handsomeric@hotmail.com has been set as site admin' as user_status,
    'All RLS policies updated for cross-company access' as security_status;