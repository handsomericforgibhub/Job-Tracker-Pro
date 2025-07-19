-- Add Company-Specific Stage Support
-- Allows each company to customize their own stage workflows

BEGIN;

-- =============================================
-- 1. ADD COMPANY_ID TO JOB_STAGES TABLE
-- =============================================

-- Add company_id column to job_stages (make it nullable initially for migration)
ALTER TABLE job_stages 
ADD COLUMN company_id UUID REFERENCES companies(id);

-- Add created_by column to track who created the stage
ALTER TABLE job_stages 
ADD COLUMN created_by UUID REFERENCES users(id);

-- Update existing stages to be global (null company_id means global)
-- This preserves the current 12-stage system as global defaults

-- =============================================
-- 2. UPDATE CONSTRAINTS AND INDEXES
-- =============================================

-- Drop the global unique constraint on sequence_order since companies can have their own orders
ALTER TABLE job_stages 
DROP CONSTRAINT unique_sequence_order;

-- Add company-specific sequence order constraint
ALTER TABLE job_stages 
ADD CONSTRAINT unique_company_sequence_order 
UNIQUE (company_id, sequence_order);

-- Create index for company-specific stage queries
CREATE INDEX idx_job_stages_company_id ON job_stages(company_id);

-- =============================================
-- 3. CREATE COMPANY STAGE MANAGEMENT FUNCTIONS
-- =============================================

-- Function to copy global stages to a company
CREATE OR REPLACE FUNCTION copy_global_stages_to_company(target_company_id UUID, created_by_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    stage_count INTEGER := 0;
    stage_record RECORD;
    old_stage_id UUID;
    new_stage_id UUID;
    stage_mapping JSONB := '{}';
BEGIN
    -- Copy all global stages (where company_id IS NULL) to the target company
    FOR stage_record IN 
        SELECT * FROM job_stages WHERE company_id IS NULL ORDER BY sequence_order
    LOOP
        old_stage_id := stage_record.id;
        new_stage_id := gen_random_uuid();
        
        -- Insert the copied stage
        INSERT INTO job_stages (
            id, name, description, color, sequence_order, maps_to_status, 
            stage_type, min_duration_hours, max_duration_hours, requires_approval,
            company_id, created_by
        ) VALUES (
            new_stage_id, stage_record.name, stage_record.description, stage_record.color,
            stage_record.sequence_order, stage_record.maps_to_status, stage_record.stage_type,
            stage_record.min_duration_hours, stage_record.max_duration_hours, stage_record.requires_approval,
            target_company_id, created_by_user_id
        );
        
        -- Track the mapping for transition copying
        stage_mapping := stage_mapping || jsonb_build_object(old_stage_id::text, new_stage_id::text);
        stage_count := stage_count + 1;
    END LOOP;
    
    -- Copy stage transitions
    FOR stage_record IN 
        SELECT st.*, sm_from.value::uuid as new_from_id, sm_to.value::uuid as new_to_id
        FROM stage_transitions st
        JOIN job_stages js_from ON st.from_stage_id = js_from.id
        JOIN job_stages js_to ON st.to_stage_id = js_to.id
        CROSS JOIN jsonb_each_text(stage_mapping) sm_from
        CROSS JOIN jsonb_each_text(stage_mapping) sm_to
        WHERE js_from.company_id IS NULL 
        AND js_to.company_id IS NULL
        AND sm_from.key = st.from_stage_id::text
        AND sm_to.key = st.to_stage_id::text
    LOOP
        INSERT INTO stage_transitions (
            from_stage_id, to_stage_id, trigger_response, conditions,
            is_automatic, requires_admin_override
        ) VALUES (
            stage_record.new_from_id, stage_record.new_to_id, stage_record.trigger_response,
            stage_record.conditions, stage_record.is_automatic, stage_record.requires_admin_override
        );
    END LOOP;
    
    -- Copy stage questions
    FOR stage_record IN 
        SELECT sq.*, sm.value::uuid as new_stage_id
        FROM stage_questions sq
        JOIN job_stages js ON sq.stage_id = js.id
        CROSS JOIN jsonb_each_text(stage_mapping) sm
        WHERE js.company_id IS NULL
        AND sm.key = sq.stage_id::text
    LOOP
        INSERT INTO stage_questions (
            stage_id, question_text, response_type, response_options,
            sequence_order, is_required, skip_conditions, help_text, mobile_optimized
        ) VALUES (
            stage_record.new_stage_id, stage_record.question_text, stage_record.response_type,
            stage_record.response_options, stage_record.sequence_order, stage_record.is_required,
            stage_record.skip_conditions, stage_record.help_text, stage_record.mobile_optimized
        );
    END LOOP;
    
    -- Copy task templates
    FOR stage_record IN 
        SELECT tt.*, sm.value::uuid as new_stage_id
        FROM task_templates tt
        JOIN job_stages js ON tt.stage_id = js.id
        CROSS JOIN jsonb_each_text(stage_mapping) sm
        WHERE js.company_id IS NULL
        AND sm.key = tt.stage_id::text
    LOOP
        INSERT INTO task_templates (
            stage_id, task_type, title, description, subtasks,
            upload_required, upload_file_types, max_file_size_mb,
            due_date_offset_hours, priority, auto_assign_to, client_visible, sla_hours
        ) VALUES (
            stage_record.new_stage_id, stage_record.task_type, stage_record.title,
            stage_record.description, stage_record.subtasks, stage_record.upload_required,
            stage_record.upload_file_types, stage_record.max_file_size_mb,
            stage_record.due_date_offset_hours, stage_record.priority, stage_record.auto_assign_to,
            stage_record.client_visible, stage_record.sla_hours
        );
    END LOOP;
    
    RETURN stage_count;
END;
$$;

-- =============================================
-- 4. CREATE STAGE LOOKUP FUNCTIONS
-- =============================================

-- Function to get stages for a company (falls back to global if no company stages exist)
CREATE OR REPLACE FUNCTION get_company_stages(target_company_id UUID)
RETURNS TABLE (
    id UUID, name VARCHAR, description TEXT, color VARCHAR, sequence_order INTEGER,
    maps_to_status VARCHAR, stage_type VARCHAR, min_duration_hours INTEGER,
    max_duration_hours INTEGER, requires_approval BOOLEAN, company_id UUID, created_by UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if company has custom stages
    IF EXISTS (SELECT 1 FROM job_stages WHERE job_stages.company_id = target_company_id) THEN
        -- Return company-specific stages
        RETURN QUERY 
        SELECT js.id, js.name, js.description, js.color, js.sequence_order,
               js.maps_to_status, js.stage_type, js.min_duration_hours,
               js.max_duration_hours, js.requires_approval, js.company_id, js.created_by
        FROM job_stages js 
        WHERE js.company_id = target_company_id
        ORDER BY js.sequence_order;
    ELSE
        -- Return global stages
        RETURN QUERY 
        SELECT js.id, js.name, js.description, js.color, js.sequence_order,
               js.maps_to_status, js.stage_type, js.min_duration_hours,
               js.max_duration_hours, js.requires_approval, js.company_id, js.created_by
        FROM job_stages js 
        WHERE js.company_id IS NULL
        ORDER BY js.sequence_order;
    END IF;
END;
$$;

-- =============================================
-- 5. UPDATE EXISTING JOBS TO USE COMPANY STAGES
-- =============================================

-- We'll handle this in the application layer to maintain data integrity

-- =============================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_stage_questions_stage_id ON stage_questions(stage_id);
CREATE INDEX idx_stage_transitions_from_stage ON stage_transitions(from_stage_id);
CREATE INDEX idx_stage_transitions_to_stage ON stage_transitions(to_stage_id);
CREATE INDEX idx_task_templates_stage_id ON task_templates(stage_id);

COMMIT;

-- =============================================
-- 7. VERIFICATION QUERIES
-- =============================================

-- Show current stage distribution
SELECT 
    CASE 
        WHEN company_id IS NULL THEN 'Global Stages'
        ELSE 'Company Stages'
    END as stage_type,
    COUNT(*) as stage_count
FROM job_stages 
GROUP BY (company_id IS NULL);

-- Show global stages
SELECT name, sequence_order, maps_to_status, color 
FROM job_stages 
WHERE company_id IS NULL 
ORDER BY sequence_order;