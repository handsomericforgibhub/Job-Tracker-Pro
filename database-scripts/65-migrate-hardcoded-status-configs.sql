-- ADR Phase 1: Migrate Hard-Coded Status Configurations
-- Purpose: Move status configurations from components and constants to company_status_configs table
-- This replaces hard-coded status objects with company-specific data

BEGIN;

-- =============================================
-- Create Migration Function for Status Data
-- =============================================

CREATE OR REPLACE FUNCTION migrate_hardcoded_status_configs_to_companies()
RETURNS TEXT AS $$
DECLARE
    company_record RECORD;
    config_count INTEGER := 0;
    company_count INTEGER := 0;
    result_message TEXT := '';
BEGIN
    -- Loop through all companies and create default status configurations
    FOR company_record IN SELECT id, name FROM companies ORDER BY created_at ASC
    LOOP
        company_count := company_count + 1;
        
        -- Insert Job Status Configurations
        INSERT INTO company_status_configs (
            company_id,
            status_type,
            status_key,
            label,
            color,
            description,
            icon,
            sort_order,
            is_system_status,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES
        -- Job Statuses (from job-status-change-form.tsx and constants.ts)
        (company_record.id, 'job', 'planning', 'Planning', '#3B82F6', 'Job is in planning phase', 'Clock', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'job', 'active', 'Active', '#10B981', 'Job is actively being worked on', 'CheckCircle', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'job', 'on_hold', 'On Hold', '#EAB308', 'Job is temporarily paused', 'Pause', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'job', 'completed', 'Completed', '#6B7280', 'Job has been completed', 'CheckCircle', 4, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'job', 'cancelled', 'Cancelled', '#EF4444', 'Job has been cancelled', 'AlertCircle', 5, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Task Statuses (from constants.ts)
        (company_record.id, 'task', 'pending', 'Pending', '#6B7280', 'Task is waiting to be started', 'Clock', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'task', 'in_progress', 'In Progress', '#3B82F6', 'Task is being worked on', 'Play', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'task', 'completed', 'Completed', '#10B981', 'Task has been completed', 'CheckCircle', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'task', 'on_hold', 'On Hold', '#EAB308', 'Task is temporarily paused', 'Pause', 4, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'task', 'cancelled', 'Cancelled', '#EF4444', 'Task has been cancelled', 'X', 5, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Assignment Roles (from job-assignments.tsx)
        (company_record.id, 'assignment_role', 'lead', 'Team Lead', '#8B5CF6', 'Team leader role', 'Crown', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'assignment_role', 'foreman', 'Foreman', '#3B82F6', 'Foreman role', 'HardHat', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'assignment_role', 'worker', 'Worker', '#6B7280', 'General worker role', 'User', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'assignment_role', 'specialist', 'Specialist', '#F97316', 'Specialist role', 'Wrench', 4, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'assignment_role', 'apprentice', 'Apprentice', '#22C55E', 'Apprentice role', 'GraduationCap', 5, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Assignment Statuses (from job-assignments.tsx)
        (company_record.id, 'assignment_status', 'active', 'Active', '#10B981', 'Assignment is active', 'CheckCircle', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'assignment_status', 'completed', 'Completed', '#6B7280', 'Assignment is completed', 'Check', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'assignment_status', 'removed', 'Removed', '#EF4444', 'Assignment has been removed', 'X', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage Types (from constants.ts)
        (company_record.id, 'stage_type', 'standard', 'Standard', '#6B7280', 'Regular stage in the job progression', 'Circle', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage_type', 'milestone', 'Milestone', '#F59E0B', 'Important checkpoint or deliverable stage', 'Flag', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage_type', 'approval', 'Approval', '#EF4444', 'Stage requiring management approval to proceed', 'Shield', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Priority Levels (from constants.ts)
        (company_record.id, 'priority', 'low', 'Low', '#6B7280', 'Low priority level', 'ChevronDown', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'priority', 'medium', 'Medium', '#F59E0B', 'Medium priority level', 'Minus', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'priority', 'high', 'High', '#EF4444', 'High priority level', 'ChevronUp', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'priority', 'urgent', 'Urgent', '#DC2626', 'Urgent priority level', 'AlertTriangle', 4, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Response Types (from constants.ts)
        (company_record.id, 'response_type', 'yes_no', 'Yes/No', '#3B82F6', 'Boolean yes/no response', 'ToggleLeft', 1, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'response_type', 'text', 'Text', '#6B7280', 'Free text response', 'Type', 2, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'response_type', 'number', 'Number', '#10B981', 'Numeric response', 'Hash', 3, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'response_type', 'date', 'Date', '#F59E0B', 'Date response', 'Calendar', 4, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'response_type', 'file_upload', 'File Upload', '#8B5CF6', 'File upload response', 'Upload', 5, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'response_type', 'multiple_choice', 'Multiple Choice', '#EC4899', 'Multiple choice response', 'List', 6, true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW())
        
        ON CONFLICT (company_id, status_type, status_key) DO NOTHING;
        
        config_count := config_count + 29; -- 29 status configs per company (5 job + 5 task + 5 assignment_role + 3 assignment_status + 3 stage_type + 4 priority + 6 response_type)
        
        result_message := result_message || 'Created status configs for company: ' || company_record.name || E'\n';
    END LOOP;
    
    result_message := result_message || E'\nSummary:\n';
    result_message := result_message || '- Companies processed: ' || company_count || E'\n';
    result_message := result_message || '- Total status configs created: ' || config_count || E'\n';
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Execute Migration
-- =============================================

-- Run the migration
SELECT migrate_hardcoded_status_configs_to_companies() as migration_result;

-- =============================================
-- Create Helper Functions for Status Config Access
-- =============================================

-- Function to get status configuration (replaces hard-coded statusConfig objects)
CREATE OR REPLACE FUNCTION get_company_status_config(
    p_company_id UUID,
    p_status_type TEXT,
    p_status_key TEXT
)
RETURNS TABLE (
    status_key TEXT,
    label TEXT,
    color TEXT,
    description TEXT,
    icon TEXT,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        csc.status_key,
        csc.label,
        csc.color,
        csc.description,
        csc.icon,
        csc.sort_order
    FROM company_status_configs csc
    WHERE csc.company_id = p_company_id
      AND csc.status_type = p_status_type
      AND csc.status_key = p_status_key
      AND csc.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all status configs for a type (replaces hard-coded config objects)
CREATE OR REPLACE FUNCTION get_company_status_configs_by_type(
    p_company_id UUID,
    p_status_type TEXT
)
RETURNS TABLE (
    status_key TEXT,
    label TEXT,
    color TEXT,
    description TEXT,
    icon TEXT,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        csc.status_key,
        csc.label,
        csc.color,
        csc.description,
        csc.icon,
        csc.sort_order
    FROM company_status_configs csc
    WHERE csc.company_id = p_company_id
      AND csc.status_type = p_status_type
      AND csc.is_active = true
    ORDER BY csc.sort_order ASC, csc.label ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get job status label (replaces JOB_STATUS_LABELS)
CREATE OR REPLACE FUNCTION get_job_status_label(
    p_company_id UUID,
    p_status_key TEXT
)
RETURNS TEXT AS $$
DECLARE
    status_label TEXT;
BEGIN
    SELECT label INTO status_label
    FROM company_status_configs
    WHERE company_id = p_company_id
      AND status_type = 'job'
      AND status_key = p_status_key
      AND is_active = true;
    
    RETURN COALESCE(status_label, INITCAP(REPLACE(p_status_key, '_', ' ')));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get priority level numeric value (replaces PRIORITY_VALUES)
CREATE OR REPLACE FUNCTION get_priority_value(
    p_company_id UUID,
    p_priority_key TEXT
)
RETURNS INTEGER AS $$
DECLARE
    priority_value INTEGER;
BEGIN
    SELECT sort_order INTO priority_value
    FROM company_status_configs
    WHERE company_id = p_company_id
      AND status_type = 'priority'
      AND status_key = p_priority_key
      AND is_active = true;
    
    -- Fallback to default values if not found
    RETURN COALESCE(priority_value,
        CASE p_priority_key
            WHEN 'low' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'high' THEN 3
            WHEN 'urgent' THEN 4
            ELSE 2
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get valid statuses for transitions
CREATE OR REPLACE FUNCTION get_valid_job_statuses(p_company_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    status_array TEXT[];
BEGIN
    SELECT ARRAY_AGG(status_key ORDER BY sort_order) INTO status_array
    FROM company_status_configs
    WHERE company_id = p_company_id
      AND status_type = 'job'
      AND is_active = true;
    
    RETURN status_array;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION is_valid_status_transition(
    p_company_id UUID,
    p_from_status TEXT,
    p_to_status TEXT
) 
RETURNS BOOLEAN AS $$
DECLARE
    valid_statuses TEXT[];
BEGIN
    -- Get all valid statuses for the company
    SELECT get_valid_job_statuses(p_company_id) INTO valid_statuses;
    
    -- Check if both statuses are valid
    IF NOT (p_from_status = ANY(valid_statuses) AND p_to_status = ANY(valid_statuses)) THEN
        RETURN FALSE;
    END IF;
    
    -- For now, allow all transitions between valid statuses
    -- This can be enhanced with more complex business rules
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Create API Helper Functions
-- =============================================

-- Function to get status configuration for API responses
CREATE OR REPLACE FUNCTION get_status_config_for_api(
    p_company_id UUID,
    p_status_type TEXT
)
RETURNS JSON AS $$
DECLARE
    config_json JSON;
BEGIN
    SELECT JSON_OBJECT_AGG(
        status_key,
        JSON_BUILD_OBJECT(
            'label', label,
            'color', color,
            'description', description,
            'icon', icon,
            'sort_order', sort_order
        )
    ) INTO config_json
    FROM company_status_configs
    WHERE company_id = p_company_id
      AND status_type = p_status_type
      AND is_active = true;
    
    RETURN COALESCE(config_json, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Verification and Reports
-- =============================================

-- Verify migration results
SELECT 
    'Status Config Migration Verification:' as status,
    COUNT(*) as total_configs,
    COUNT(DISTINCT company_id) as companies_with_configs,
    COUNT(DISTINCT status_type) as status_types
FROM company_status_configs;

-- Configuration distribution by type
SELECT 
    status_type,
    COUNT(*) as config_count,
    COUNT(DISTINCT company_id) as companies
FROM company_status_configs
GROUP BY status_type
ORDER BY status_type;

-- Sample configurations for first company
SELECT 
    c.name as company_name,
    csc.status_type,
    csc.status_key,
    csc.label,
    csc.color,
    csc.description
FROM companies c
JOIN company_status_configs csc ON c.id = csc.company_id
WHERE csc.is_active = true
ORDER BY c.name, csc.status_type, csc.sort_order
LIMIT 30;

COMMIT;

-- =============================================
-- Success Message
-- =============================================

SELECT 'Hard-coded status configurations successfully migrated to company-scoped database tables' as final_status;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON FUNCTION migrate_hardcoded_status_configs_to_companies() IS 'Migrates hard-coded status configurations from components and constants to company_status_configs table';
COMMENT ON FUNCTION get_company_status_config(UUID, TEXT, TEXT) IS 'Returns status configuration for a specific company, type, and key';
COMMENT ON FUNCTION get_company_status_configs_by_type(UUID, TEXT) IS 'Returns all status configurations for a company and type';
COMMENT ON FUNCTION get_job_status_label(UUID, TEXT) IS 'Returns job status label, replacing JOB_STATUS_LABELS constant';
COMMENT ON FUNCTION get_priority_value(UUID, TEXT) IS 'Returns priority numeric value, replacing PRIORITY_VALUES constant';
COMMENT ON FUNCTION get_valid_job_statuses(UUID) IS 'Returns array of valid job statuses for a company';
COMMENT ON FUNCTION is_valid_status_transition(UUID, TEXT, TEXT) IS 'Validates if a status transition is allowed';
COMMENT ON FUNCTION get_status_config_for_api(UUID, TEXT) IS 'Returns status configuration as JSON for API responses';