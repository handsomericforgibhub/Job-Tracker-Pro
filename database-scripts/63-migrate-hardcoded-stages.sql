-- ADR Phase 1: Migrate Hard-Coded Stage Configurations
-- Purpose: Move stage definitions from src/config/stages.ts to company_stages table
-- This replaces hard-coded stage definitions with company-specific data

BEGIN;

-- =============================================
-- Create Migration Function for Stage Data
-- =============================================

CREATE OR REPLACE FUNCTION migrate_hardcoded_stages_to_companies()
RETURNS TEXT AS $$
DECLARE
    company_record RECORD;
    stage_count INTEGER := 0;
    company_count INTEGER := 0;
    result_message TEXT := '';
BEGIN
    -- Loop through all companies and create default stage configurations
    FOR company_record IN SELECT id, name FROM companies ORDER BY created_at ASC
    LOOP
        company_count := company_count + 1;
        
        -- Insert default stages for this company
        INSERT INTO company_stages (
            id,
            company_id,
            name,
            description,
            color,
            sequence_order,
            stage_type,
            maps_to_status,
            min_duration_hours,
            max_duration_hours,
            is_system_stage,
            created_by,
            created_at,
            updated_at
        ) VALUES
        -- Stage 1: Lead Qualification
        (
            gen_random_uuid(),
            company_record.id,
            '1/12 Lead Qualification',
            'Initial assessment of lead viability and requirements',
            '#C7D2FE',
            1,
            'standard',
            'planning',
            1,
            168,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 2: Initial Client Meeting
        (
            gen_random_uuid(),
            company_record.id,
            '2/12 Initial Client Meeting',
            'First meeting with client to understand project scope',
            '#A5B4FC',
            2,
            'milestone',
            'planning',
            2,
            72,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 3: Quote Preparation
        (
            gen_random_uuid(),
            company_record.id,
            '3/12 Quote Preparation',
            'Prepare detailed project quote and estimates',
            '#93C5FD',
            3,
            'standard',
            'planning',
            4,
            120,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 4: Quote Submission
        (
            gen_random_uuid(),
            company_record.id,
            '4/12 Quote Submission',
            'Submit quote to client and await response',
            '#60A5FA',
            4,
            'milestone',
            'planning',
            1,
            336,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 5: Client Decision
        (
            gen_random_uuid(),
            company_record.id,
            '5/12 Client Decision',
            'Client reviews and makes decision on quote',
            '#38BDF8',
            5,
            'approval',
            'planning',
            1,
            168,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 6: Contract & Deposit
        (
            gen_random_uuid(),
            company_record.id,
            '6/12 Contract & Deposit',
            'Finalize contract terms and collect deposit',
            '#34D399',
            6,
            'milestone',
            'active',
            2,
            72,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 7: Planning & Procurement
        (
            gen_random_uuid(),
            company_record.id,
            '7/12 Planning & Procurement',
            'Detailed planning and material procurement',
            '#4ADE80',
            7,
            'standard',
            'active',
            8,
            168,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 8: On-Site Preparation
        (
            gen_random_uuid(),
            company_record.id,
            '8/12 On-Site Preparation',
            'Site preparation and setup for construction',
            '#FACC15',
            8,
            'standard',
            'active',
            4,
            72,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 9: Construction Execution
        (
            gen_random_uuid(),
            company_record.id,
            '9/12 Construction Execution',
            'Main construction and building phase',
            '#FB923C',
            9,
            'standard',
            'active',
            40,
            2000,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 10: Inspections & Progress Payments
        (
            gen_random_uuid(),
            company_record.id,
            '10/12 Inspections & Progress Payments',
            'Quality inspections and progress billing',
            '#F87171',
            10,
            'milestone',
            'active',
            2,
            48,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 11: Finalisation
        (
            gen_random_uuid(),
            company_record.id,
            '11/12 Finalisation',
            'Final touches and completion preparations',
            '#F472B6',
            11,
            'standard',
            'active',
            8,
            120,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        ),
        -- Stage 12: Handover & Close
        (
            gen_random_uuid(),
            company_record.id,
            '12/12 Handover & Close',
            'Final handover and project closure',
            '#D1D5DB',
            12,
            'milestone',
            'completed',
            1,
            24,
            true,
            (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1),
            NOW(),
            NOW()
        )
        ON CONFLICT (company_id, name, stage_type) DO NOTHING;
        
        stage_count := stage_count + 12; -- 12 stages per company
        
        result_message := result_message || 'Created stages for company: ' || company_record.name || E'\n';
    END LOOP;
    
    result_message := result_message || E'\nSummary:\n';
    result_message := result_message || '- Companies processed: ' || company_count || E'\n';
    result_message := result_message || '- Total stages created: ' || stage_count || E'\n';
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Execute Migration
-- =============================================

-- Run the migration
SELECT migrate_hardcoded_stages_to_companies() as migration_result;

-- =============================================
-- Create Default Stage Transitions
-- =============================================

CREATE OR REPLACE FUNCTION create_default_stage_transitions()
RETURNS TEXT AS $$
DECLARE
    company_record RECORD;
    transition_count INTEGER := 0;
    company_count INTEGER := 0;
    result_message TEXT := '';
    stage_1_id UUID;
    stage_2_id UUID;
    stage_3_id UUID;
    stage_4_id UUID;
    stage_5_id UUID;
    stage_6_id UUID;
    stage_7_id UUID;
    stage_8_id UUID;
    stage_9_id UUID;
    stage_10_id UUID;
    stage_11_id UUID;
    stage_12_id UUID;
BEGIN
    -- Loop through all companies and create stage transitions
    FOR company_record IN SELECT id, name FROM companies ORDER BY created_at ASC
    LOOP
        company_count := company_count + 1;
        
        -- Get stage IDs for this company
        SELECT id INTO stage_1_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 1;
        SELECT id INTO stage_2_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 2;
        SELECT id INTO stage_3_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 3;
        SELECT id INTO stage_4_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 4;
        SELECT id INTO stage_5_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 5;
        SELECT id INTO stage_6_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 6;
        SELECT id INTO stage_7_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 7;
        SELECT id INTO stage_8_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 8;
        SELECT id INTO stage_9_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 9;
        SELECT id INTO stage_10_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 10;
        SELECT id INTO stage_11_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 11;
        SELECT id INTO stage_12_id FROM company_stages WHERE company_id = company_record.id AND sequence_order = 12;
        
        -- Create sequential transitions
        INSERT INTO company_stage_transitions (
            company_id,
            from_stage_id,
            to_stage_id,
            stage_type,
            transition_name,
            description,
            requires_approval,
            is_active,
            created_by,
            created_at,
            updated_at
        ) VALUES
        -- Initial stage (NULL -> Stage 1)
        (company_record.id, NULL, stage_1_id, 'job', 'Start Job', 'Begin job at Lead Qualification stage', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 1 -> Stage 2
        (company_record.id, stage_1_id, stage_2_id, 'job', 'Proceed to Meeting', 'Move from qualification to client meeting', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 2 -> Stage 3
        (company_record.id, stage_2_id, stage_3_id, 'job', 'Prepare Quote', 'Move to quote preparation', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 3 -> Stage 4
        (company_record.id, stage_3_id, stage_4_id, 'job', 'Submit Quote', 'Submit prepared quote to client', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 4 -> Stage 5
        (company_record.id, stage_4_id, stage_5_id, 'job', 'Await Decision', 'Wait for client decision', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 5 -> Stage 6
        (company_record.id, stage_5_id, stage_6_id, 'job', 'Approved - Contract', 'Client approved, proceed to contract', true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 6 -> Stage 7
        (company_record.id, stage_6_id, stage_7_id, 'job', 'Begin Planning', 'Start planning and procurement', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 7 -> Stage 8
        (company_record.id, stage_7_id, stage_8_id, 'job', 'Site Preparation', 'Move to on-site preparation', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 8 -> Stage 9
        (company_record.id, stage_8_id, stage_9_id, 'job', 'Begin Construction', 'Start main construction phase', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 9 -> Stage 10
        (company_record.id, stage_9_id, stage_10_id, 'job', 'Inspections', 'Move to inspections and payments', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 10 -> Stage 11
        (company_record.id, stage_10_id, stage_11_id, 'job', 'Finalization', 'Begin final touches', false, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW()),
        
        -- Stage 11 -> Stage 12
        (company_record.id, stage_11_id, stage_12_id, 'job', 'Handover', 'Final handover and closure', true, true,
         (SELECT id FROM users WHERE company_id = company_record.id AND role IN ('company_admin', 'site_admin') ORDER BY created_at ASC LIMIT 1), NOW(), NOW())
        
        ON CONFLICT (company_id, from_stage_id, to_stage_id) DO NOTHING;
        
        transition_count := transition_count + 12; -- 12 transitions per company
        
        result_message := result_message || 'Created transitions for company: ' || company_record.name || E'\n';
    END LOOP;
    
    result_message := result_message || E'\nSummary:\n';
    result_message := result_message || '- Companies processed: ' || company_count || E'\n';
    result_message := result_message || '- Total transitions created: ' || transition_count || E'\n';
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- Execute stage transitions creation
SELECT create_default_stage_transitions() as transition_result;

-- =============================================
-- Create Helper Functions for Stage Access
-- =============================================

-- Function to get company stages (replaces hard-coded STAGE_DEFINITIONS)
CREATE OR REPLACE FUNCTION get_company_stage_definitions(p_company_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    color TEXT,
    sequence_order INTEGER,
    stage_type TEXT,
    maps_to_status TEXT,
    min_duration_hours INTEGER,
    max_duration_hours INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.name,
        cs.description,
        cs.color,
        cs.sequence_order,
        cs.stage_type,
        cs.maps_to_status,
        cs.min_duration_hours,
        cs.max_duration_hours
    FROM company_stages cs
    WHERE cs.company_id = p_company_id
      AND cs.is_active = true
    ORDER BY cs.sequence_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stage by sequence order (replaces hard-coded lookups)
CREATE OR REPLACE FUNCTION get_company_stage_by_order(
    p_company_id UUID,
    p_sequence_order INTEGER
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    color TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.name,
        cs.color
    FROM company_stages cs
    WHERE cs.company_id = p_company_id
      AND cs.sequence_order = p_sequence_order
      AND cs.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get default/first stage for a company
CREATE OR REPLACE FUNCTION get_company_default_stage(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
    default_stage_id UUID;
BEGIN
    SELECT id INTO default_stage_id
    FROM company_stages
    WHERE company_id = p_company_id
      AND is_active = true
    ORDER BY sequence_order ASC
    LIMIT 1;
    
    RETURN default_stage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Verification and Cleanup
-- =============================================

-- Verify migration results
SELECT 
    'Stage Migration Verification:' as status,
    COUNT(*) as total_stages,
    COUNT(DISTINCT company_id) as companies_with_stages
FROM company_stages;

SELECT 
    'Transition Migration Verification:' as status,
    COUNT(*) as total_transitions,
    COUNT(DISTINCT company_id) as companies_with_transitions
FROM company_stage_transitions;

-- List stages by company
SELECT 
    c.name as company_name,
    cs.sequence_order,
    cs.name as stage_name,
    cs.color,
    cs.maps_to_status
FROM companies c
JOIN company_stages cs ON c.id = cs.company_id
WHERE cs.is_active = true
ORDER BY c.name, cs.sequence_order;

COMMIT;

-- =============================================
-- Success Message
-- =============================================

SELECT 'Hard-coded stage configurations successfully migrated to company-scoped database tables' as final_status;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON FUNCTION migrate_hardcoded_stages_to_companies() IS 'Migrates hard-coded stage definitions from src/config/stages.ts to company_stages table';
COMMENT ON FUNCTION create_default_stage_transitions() IS 'Creates default stage transitions for all companies based on sequential workflow';
COMMENT ON FUNCTION get_company_stage_definitions(UUID) IS 'Returns stage definitions for a company, replacing hard-coded STAGE_DEFINITIONS';
COMMENT ON FUNCTION get_company_stage_by_order(UUID, INTEGER) IS 'Returns stage info by sequence order for a company';
COMMENT ON FUNCTION get_company_default_stage(UUID) IS 'Returns the default (first) stage ID for a company';