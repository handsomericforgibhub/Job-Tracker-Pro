-- Platform Admin Configuration Schema
-- This creates tables for site administrators to configure various platform settings

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PLATFORM SETTINGS TABLE
-- =============================================
-- System-wide configuration that affects all companies
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) NOT NULL CHECK (setting_type IN (
        'job_stages',           -- Configurable job status stages
        'user_roles',           -- Available user roles and permissions
        'task_priorities',      -- Task priority levels
        'task_statuses',        -- Task status options
        'worker_skills',        -- Available skill categories
        'document_categories',  -- Document category options
        'time_tracking',        -- Time tracking configuration
        'notification_settings', -- Email/notification templates
        'system_limits',        -- File size limits, user limits, etc.
        'integration_settings', -- API keys, third-party configs
        'feature_toggles'       -- Enable/disable platform features
    )),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- COMPANY SETTINGS TABLE  
-- =============================================
-- Company-specific overrides of platform settings
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
    -- Ensure one setting per company per key
    UNIQUE(company_id, setting_key)
);

-- =============================================
-- WORKFLOW TEMPLATES TABLE
-- =============================================
-- Configurable workflows for jobs, tasks, and approvals
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL CHECK (workflow_type IN (
        'job_progression',      -- Job status progression rules
        'task_workflow',        -- Task assignment and completion workflows
        'approval_chain',       -- Document/timesheet approval workflows
        'notification_flow'     -- Automated notification triggers
    )),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL for platform-wide templates
    workflow_config JSONB NOT NULL, -- Contains stages, rules, conditions
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ADMIN AUDIT LOG TABLE
-- =============================================
-- Track all administrative actions for accountability
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'setting_update',       -- Platform/company setting changes
        'workflow_create',      -- New workflow template creation
        'workflow_update',      -- Workflow template modifications
        'workflow_delete',      -- Workflow template deletion
        'user_role_change',     -- User role modifications
        'permission_grant',     -- Permission changes
        'permission_revoke',    -- Permission removals
        'feature_toggle',       -- Feature enable/disable
        'data_export',          -- Bulk data exports
        'data_import',          -- Bulk data imports
        'system_config'         -- System-level configuration changes
    )),
    target_type VARCHAR(50), -- What was affected (user, company, setting, etc.)
    target_id UUID,          -- ID of the affected entity
    old_values JSONB,        -- Previous values (for updates)
    new_values JSONB,        -- New values
    description TEXT,        -- Human-readable description of the action
    ip_address INET,         -- IP address of admin user
    user_agent TEXT,         -- Browser/client information
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL, -- Company context if applicable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
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
CREATE INDEX IF NOT EXISTS idx_workflow_templates_default ON workflow_templates(is_default);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_type ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_company ON admin_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

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
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all admin tables
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Platform settings policies (only owners can access)
CREATE POLICY "Only owners can view platform settings" 
ON platform_settings FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
    )
);

CREATE POLICY "Only owners can modify platform settings" 
ON platform_settings FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
    )
);

-- Company settings policies (owners of the same company can access)
CREATE POLICY "Users can view their company settings" 
ON company_settings FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
        AND users.company_id = company_settings.company_id
    )
);

CREATE POLICY "Users can modify their company settings" 
ON company_settings FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
        AND users.company_id = company_settings.company_id
    )
);

-- Workflow templates policies
CREATE POLICY "Users can view workflow templates" 
ON workflow_templates FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
        AND (
            workflow_templates.company_id IS NULL OR -- Platform-wide templates
            users.company_id = workflow_templates.company_id -- Company-specific templates
        )
    )
);

CREATE POLICY "Users can modify workflow templates" 
ON workflow_templates FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
        AND (
            workflow_templates.company_id IS NULL OR -- Platform-wide templates
            users.company_id = workflow_templates.company_id -- Company-specific templates
        )
    )
);

-- Audit log policies (owners can view their company's audit log)
CREATE POLICY "Users can view audit log" 
ON admin_audit_log FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
        AND (
            admin_audit_log.company_id IS NULL OR -- System-wide actions
            users.company_id = admin_audit_log.company_id -- Company-specific actions
        )
    )
);

CREATE POLICY "Users can insert audit log entries" 
ON admin_audit_log FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'owner'
        AND users.id = admin_audit_log.admin_user_id
    )
);

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON company_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_templates TO authenticated;
GRANT SELECT, INSERT ON admin_audit_log TO authenticated;

-- =============================================
-- DEFAULT PLATFORM SETTINGS
-- =============================================

-- Insert default job stages (configurable version of current hardcoded stages)
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

-- Insert default task priorities
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) 
VALUES (
    'default_task_priorities',
    '[
        {"key": "low", "label": "Low", "color": "#6B7280", "order": 1},
        {"key": "medium", "label": "Medium", "color": "#F59E0B", "order": 2},
        {"key": "high", "label": "High", "color": "#EF4444", "order": 3},
        {"key": "urgent", "label": "Urgent", "color": "#DC2626", "order": 4}
    ]'::jsonb,
    'task_priorities',
    'Default task priority levels'
) ON CONFLICT (setting_key) DO NOTHING;

-- Insert default task statuses
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) 
VALUES (
    'default_task_statuses',
    '[
        {"key": "todo", "label": "To Do", "color": "#6B7280", "is_initial": true, "is_final": false},
        {"key": "in_progress", "label": "In Progress", "color": "#3B82F6", "is_initial": false, "is_final": false},
        {"key": "completed", "label": "Completed", "color": "#10B981", "is_initial": false, "is_final": true},
        {"key": "blocked", "label": "Blocked", "color": "#EF4444", "is_initial": false, "is_final": false}
    ]'::jsonb,
    'task_statuses',
    'Default task status options'
) ON CONFLICT (setting_key) DO NOTHING;

-- Insert default user roles configuration
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description) 
VALUES (
    'user_roles_config',
    '{
        "roles": [
            {
                "key": "owner",
                "label": "Owner",
                "description": "Full platform access and company management",
                "permissions": ["all"]
            },
            {
                "key": "foreman",
                "label": "Foreman",
                "description": "Job and worker management",
                "permissions": ["jobs.manage", "workers.manage", "tasks.manage", "time.approve"]
            },
            {
                "key": "worker",
                "label": "Worker",
                "description": "Basic access to assigned work",
                "permissions": ["jobs.view", "tasks.view", "time.track", "documents.view"]
            }
        ]
    }'::jsonb,
    'user_roles',
    'User role definitions and permissions'
) ON CONFLICT (setting_key) DO NOTHING;

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to get platform setting with fallback
CREATE OR REPLACE FUNCTION get_platform_setting(
    p_setting_key VARCHAR(100),
    p_company_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- First try to get company-specific setting
    IF p_company_id IS NOT NULL THEN
        SELECT setting_value INTO result
        FROM company_settings
        WHERE setting_key = p_setting_key 
        AND company_id = p_company_id 
        AND is_active = TRUE;
        
        IF result IS NOT NULL THEN
            RETURN result;
        END IF;
    END IF;
    
    -- Fallback to platform setting
    SELECT setting_value INTO result
    FROM platform_settings
    WHERE setting_key = p_setting_key 
    AND is_active = TRUE;
    
    RETURN COALESCE(result, '{}'::jsonb);
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

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_platform_setting(VARCHAR(100), UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_action(VARCHAR(50), VARCHAR(50), UUID, JSONB, JSONB, TEXT, INET, TEXT, UUID) TO authenticated;

-- =============================================
-- VIEWS FOR EASY QUERYING
-- =============================================

-- View combining platform and company settings
CREATE OR REPLACE VIEW effective_settings AS
SELECT 
    COALESCE(cs.company_id, '00000000-0000-0000-0000-000000000000'::uuid) as company_id,
    COALESCE(cs.setting_key, ps.setting_key) as setting_key,
    COALESCE(cs.setting_value, ps.setting_value) as setting_value,
    COALESCE(cs.setting_type, ps.setting_type) as setting_type,
    CASE 
        WHEN cs.id IS NOT NULL THEN 'company'
        ELSE 'platform'
    END as source,
    COALESCE(cs.is_active, ps.is_active) as is_active,
    COALESCE(cs.updated_at, ps.updated_at) as updated_at
FROM platform_settings ps
FULL OUTER JOIN company_settings cs ON ps.setting_key = cs.setting_key
WHERE COALESCE(cs.is_active, ps.is_active) = TRUE;

GRANT SELECT ON effective_settings TO authenticated;