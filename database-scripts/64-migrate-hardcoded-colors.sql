-- ADR Phase 1: Migrate Hard-Coded Color Configurations
-- Purpose: Move color definitions from src/config/colors.ts to company_color_schemes table
-- This replaces hard-coded color definitions with company-specific data

BEGIN;

-- =============================================
-- Create Migration Function for Color Data
-- =============================================

CREATE OR REPLACE FUNCTION migrate_hardcoded_colors_to_companies()
RETURNS TEXT AS $$
DECLARE
    company_record RECORD;
    color_count INTEGER := 0;
    company_count INTEGER := 0;
    result_message TEXT := '';
BEGIN
    -- Loop through all companies and create default color configurations
    FOR company_record IN SELECT id, name FROM companies ORDER BY created_at ASC
    LOOP
        company_count := company_count + 1;
        
        -- Insert Stage Colors
        INSERT INTO company_color_schemes (
            company_id,
            scheme_type,
            color_key,
            color_value,
            description,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES
        (company_record.id, 'stage', 'LEAD_QUALIFICATION', '#EF4444', 'Red - Lead qualification stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'INITIAL_CLIENT_MEETING', '#F97316', 'Orange - Initial client meeting stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'SITE_ASSESSMENT', '#EAB308', 'Yellow - Site assessment stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'QUOTE_SUBMISSION', '#84CC16', 'Lime - Quote submission stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'CLIENT_DECISION', '#22C55E', 'Green - Client decision stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'CONTRACT_DEPOSIT', '#06B6D4', 'Cyan - Contract and deposit stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'MATERIAL_ORDERING', '#3B82F6', 'Blue - Material ordering stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'MATERIAL_DELIVERY', '#6366F1', 'Indigo - Material delivery stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'CONSTRUCTION_START', '#8B5CF6', 'Purple - Construction start stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'QUALITY_INSPECTIONS', '#EC4899', 'Pink - Quality inspections stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'CLIENT_WALKTHROUGH', '#F59E0B', 'Amber - Client walkthrough stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'stage', 'HANDOVER_CLOSE', '#10B981', 'Emerald - Handover and close stage', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Priority Colors
        (company_record.id, 'priority', 'LOW', '#6B7280', 'Gray - Low priority', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'priority', 'MEDIUM', '#F59E0B', 'Amber - Medium priority', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'priority', 'HIGH', '#EF4444', 'Red - High priority', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'priority', 'URGENT', '#DC2626', 'Dark Red - Urgent priority', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Status Colors
        (company_record.id, 'status', 'TODO', '#6B7280', 'Gray - To Do status', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'status', 'IN_PROGRESS', '#3B82F6', 'Blue - In Progress status', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'status', 'COMPLETED', '#10B981', 'Emerald - Completed status', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'status', 'BLOCKED', '#EF4444', 'Red - Blocked status', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'status', 'ON_HOLD', '#F59E0B', 'Amber - On Hold status', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'status', 'CANCELLED', '#DC2626', 'Dark Red - Cancelled status', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Chart Colors
        (company_record.id, 'chart', 'PRIMARY', '#8884d8', 'Purple-blue - Primary chart color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'chart', 'SECONDARY', '#82ca9d', 'Green - Secondary chart color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'chart', 'TERTIARY', '#ffc658', 'Yellow-orange - Tertiary chart color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'chart', 'QUATERNARY', '#ff7c7c', 'Light red - Quaternary chart color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'chart', 'QUINARY', '#8dd1e1', 'Light blue - Quinary chart color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'chart', 'SENARY', '#d084d0', 'Light purple - Senary chart color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- System UI Colors
        (company_record.id, 'system', 'SUCCESS', '#10B981', 'Emerald - Success system color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'system', 'WARNING', '#F59E0B', 'Amber - Warning system color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'system', 'ERROR', '#EF4444', 'Red - Error system color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'system', 'INFO', '#3B82F6', 'Blue - Info system color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'system', 'NEUTRAL', '#6B7280', 'Gray - Neutral system color', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Background Variants
        (company_record.id, 'background', 'SUCCESS_LIGHT', '#ECFDF5', 'Light green - Success background', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'background', 'WARNING_LIGHT', '#FFFBEB', 'Light amber - Warning background', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'background', 'ERROR_LIGHT', '#FEF2F2', 'Light red - Error background', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'background', 'INFO_LIGHT', '#EFF6FF', 'Light blue - Info background', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'background', 'NEUTRAL_LIGHT', '#F9FAFB', 'Light gray - Neutral background', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Text Variants
        (company_record.id, 'text', 'SUCCESS', '#065F46', 'Dark green - Success text', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'text', 'WARNING', '#92400E', 'Dark amber - Warning text', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'text', 'ERROR', '#991B1B', 'Dark red - Error text', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'text', 'INFO', '#1E40AF', 'Dark blue - Info text', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        (company_record.id, 'text', 'NEUTRAL', '#374151', 'Dark gray - Neutral text', true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW())
        
        ON CONFLICT (company_id, scheme_type, color_key) DO NOTHING;
        
        color_count := color_count + 42; -- 42 colors per company (12 stage + 4 priority + 6 status + 6 chart + 5 system + 5 background + 5 text)
        
        result_message := result_message || 'Created color schemes for company: ' || company_record.name || E'\n';
    END LOOP;
    
    result_message := result_message || E'\nSummary:\n';
    result_message := result_message || '- Companies processed: ' || company_count || E'\n';
    result_message := result_message || '- Total colors created: ' || color_count || E'\n';
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Execute Migration
-- =============================================

-- Run the migration
SELECT migrate_hardcoded_colors_to_companies() as migration_result;

-- =============================================
-- Create Helper Functions for Color Access
-- =============================================

-- Function to get stage colors (replaces getStageColor helper)
CREATE OR REPLACE FUNCTION get_company_stage_color(
    p_company_id UUID,
    p_stage_name TEXT
)
RETURNS TEXT AS $$
DECLARE
    color_value TEXT;
    stage_key TEXT;
BEGIN
    -- Convert stage name to key format (similar to the original helper)
    stage_key := UPPER(REPLACE(REPLACE(REGEXP_REPLACE(p_stage_name, '^\d+/\d+\s*', ''), ' ', '_'), '&', ''));
    
    -- Try to get the color from company_color_schemes
    SELECT ccs.color_value INTO color_value
    FROM company_color_schemes ccs
    WHERE ccs.company_id = p_company_id
      AND ccs.scheme_type = 'stage'
      AND ccs.color_key = stage_key
      AND ccs.is_active = true;
    
    -- If not found, return neutral color
    IF color_value IS NULL THEN
        SELECT ccs.color_value INTO color_value
        FROM company_color_schemes ccs
        WHERE ccs.company_id = p_company_id
          AND ccs.scheme_type = 'system'
          AND ccs.color_key = 'NEUTRAL'
          AND ccs.is_active = true;
    END IF;
    
    -- Fallback to gray if still null
    RETURN COALESCE(color_value, '#6B7280');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get priority colors (replaces getPriorityColor helper)
CREATE OR REPLACE FUNCTION get_company_priority_color(
    p_company_id UUID,
    p_priority TEXT
)
RETURNS TEXT AS $$
DECLARE
    color_value TEXT;
    priority_key TEXT;
BEGIN
    priority_key := UPPER(p_priority);
    
    SELECT ccs.color_value INTO color_value
    FROM company_color_schemes ccs
    WHERE ccs.company_id = p_company_id
      AND ccs.scheme_type = 'priority'
      AND ccs.color_key = priority_key
      AND ccs.is_active = true;
    
    -- Default to medium priority if not found
    IF color_value IS NULL THEN
        SELECT ccs.color_value INTO color_value
        FROM company_color_schemes ccs
        WHERE ccs.company_id = p_company_id
          AND ccs.scheme_type = 'priority'
          AND ccs.color_key = 'MEDIUM'
          AND ccs.is_active = true;
    END IF;
    
    RETURN COALESCE(color_value, '#F59E0B');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get status colors (replaces getStatusColor helper)
CREATE OR REPLACE FUNCTION get_company_status_color(
    p_company_id UUID,
    p_status TEXT
)
RETURNS TEXT AS $$
DECLARE
    color_value TEXT;
    status_key TEXT;
BEGIN
    -- Map common status variations to standard keys
    status_key := CASE UPPER(p_status)
        WHEN 'TODO' THEN 'TODO'
        WHEN 'PENDING' THEN 'TODO'
        WHEN 'PLANNING' THEN 'TODO'
        WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
        WHEN 'ACTIVE' THEN 'IN_PROGRESS'
        WHEN 'COMPLETED' THEN 'COMPLETED'
        WHEN 'BLOCKED' THEN 'BLOCKED'
        WHEN 'ON_HOLD' THEN 'ON_HOLD'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        ELSE UPPER(p_status)
    END;
    
    SELECT ccs.color_value INTO color_value
    FROM company_color_schemes ccs
    WHERE ccs.company_id = p_company_id
      AND ccs.scheme_type = 'status'
      AND ccs.color_key = status_key
      AND ccs.is_active = true;
    
    -- Default to TODO if not found
    IF color_value IS NULL THEN
        SELECT ccs.color_value INTO color_value
        FROM company_color_schemes ccs
        WHERE ccs.company_id = p_company_id
          AND ccs.scheme_type = 'status'
          AND ccs.color_key = 'TODO'
          AND ccs.is_active = true;
    END IF;
    
    RETURN COALESCE(color_value, '#6B7280');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get chart color palette (replaces CHART_COLOR_PALETTE)
CREATE OR REPLACE FUNCTION get_company_chart_colors(p_company_id UUID)
RETURNS TEXT[] AS $$
DECLARE
    color_array TEXT[];
BEGIN
    SELECT ARRAY[
        (SELECT color_value FROM company_color_schemes WHERE company_id = p_company_id AND scheme_type = 'chart' AND color_key = 'PRIMARY' AND is_active = true),
        (SELECT color_value FROM company_color_schemes WHERE company_id = p_company_id AND scheme_type = 'chart' AND color_key = 'SECONDARY' AND is_active = true),
        (SELECT color_value FROM company_color_schemes WHERE company_id = p_company_id AND scheme_type = 'chart' AND color_key = 'TERTIARY' AND is_active = true),
        (SELECT color_value FROM company_color_schemes WHERE company_id = p_company_id AND scheme_type = 'chart' AND color_key = 'QUATERNARY' AND is_active = true),
        (SELECT color_value FROM company_color_schemes WHERE company_id = p_company_id AND scheme_type = 'chart' AND color_key = 'QUINARY' AND is_active = true),
        (SELECT color_value FROM company_color_schemes WHERE company_id = p_company_id AND scheme_type = 'chart' AND color_key = 'SENARY' AND is_active = true)
    ] INTO color_array;
    
    RETURN color_array;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system colors
CREATE OR REPLACE FUNCTION get_company_system_color(
    p_company_id UUID,
    p_color_type TEXT
)
RETURNS TEXT AS $$
DECLARE
    color_value TEXT;
BEGIN
    SELECT ccs.color_value INTO color_value
    FROM company_color_schemes ccs
    WHERE ccs.company_id = p_company_id
      AND ccs.scheme_type = 'system'
      AND ccs.color_key = UPPER(p_color_type)
      AND ccs.is_active = true;
    
    RETURN COALESCE(color_value, '#6B7280');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Verification and Reports
-- =============================================

-- Verify migration results
SELECT 
    'Color Migration Verification:' as status,
    COUNT(*) as total_colors,
    COUNT(DISTINCT company_id) as companies_with_colors,
    COUNT(DISTINCT scheme_type) as color_scheme_types
FROM company_color_schemes;

-- Color distribution by scheme type
SELECT 
    scheme_type,
    COUNT(*) as color_count,
    COUNT(DISTINCT company_id) as companies
FROM company_color_schemes
GROUP BY scheme_type
ORDER BY scheme_type;

-- Sample color schemes for first company
SELECT 
    c.name as company_name,
    ccs.scheme_type,
    ccs.color_key,
    ccs.color_value,
    ccs.description
FROM companies c
JOIN company_color_schemes ccs ON c.id = ccs.company_id
WHERE ccs.is_active = true
ORDER BY c.name, ccs.scheme_type, ccs.color_key
LIMIT 20;

COMMIT;

-- =============================================
-- Success Message
-- =============================================

SELECT 'Hard-coded color configurations successfully migrated to company-scoped database tables' as final_status;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON FUNCTION migrate_hardcoded_colors_to_companies() IS 'Migrates hard-coded color definitions from src/config/colors.ts to company_color_schemes table';
COMMENT ON FUNCTION get_company_stage_color(UUID, TEXT) IS 'Returns stage color for a company, replacing getStageColor helper function';
COMMENT ON FUNCTION get_company_priority_color(UUID, TEXT) IS 'Returns priority color for a company, replacing getPriorityColor helper function';
COMMENT ON FUNCTION get_company_status_color(UUID, TEXT) IS 'Returns status color for a company, replacing getStatusColor helper function';
COMMENT ON FUNCTION get_company_chart_colors(UUID) IS 'Returns chart color palette for a company, replacing CHART_COLOR_PALETTE constant';
COMMENT ON FUNCTION get_company_system_color(UUID, TEXT) IS 'Returns system UI colors for a company';