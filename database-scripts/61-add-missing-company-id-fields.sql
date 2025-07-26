-- ADR Phase 1: Add Missing company_id Fields
-- Purpose: Add company_id to all tables missing multi-tenancy support
-- This ensures complete data isolation between companies

BEGIN;

-- =============================================
-- Add company_id to job_stages table
-- =============================================
-- Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_stages' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE job_stages 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records to have company_id from first company
        -- In production, this would need more careful data migration
        UPDATE job_stages 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        -- Make company_id NOT NULL after data migration
        ALTER TABLE job_stages 
        ALTER COLUMN company_id SET NOT NULL;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_job_stages_company_id ON job_stages(company_id);
        
        -- Update unique constraint to include company_id
        ALTER TABLE job_stages DROP CONSTRAINT IF EXISTS unique_sequence_order;
        ALTER TABLE job_stages ADD CONSTRAINT unique_sequence_order_per_company 
            UNIQUE (company_id, sequence_order);
    END IF;
END $$;

-- =============================================
-- Add company_id to stage_transitions table
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stage_transitions' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE stage_transitions 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related stage
        UPDATE stage_transitions 
        SET company_id = js.company_id
        FROM job_stages js
        WHERE stage_transitions.from_stage_id = js.id
        AND stage_transitions.company_id IS NULL;
        
        ALTER TABLE stage_transitions 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_stage_transitions_company_id ON stage_transitions(company_id);
        
        -- Update unique constraint
        ALTER TABLE stage_transitions DROP CONSTRAINT IF EXISTS unique_transition;
        ALTER TABLE stage_transitions ADD CONSTRAINT unique_transition_per_company 
            UNIQUE (company_id, from_stage_id, to_stage_id, trigger_response);
    END IF;
END $$;

-- =============================================
-- Add company_id to stage_questions table
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stage_questions' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE stage_questions 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related stage
        UPDATE stage_questions 
        SET company_id = js.company_id
        FROM job_stages js
        WHERE stage_questions.stage_id = js.id
        AND stage_questions.company_id IS NULL;
        
        ALTER TABLE stage_questions 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_stage_questions_company_id ON stage_questions(company_id);
        
        -- Update unique constraint
        ALTER TABLE stage_questions DROP CONSTRAINT IF EXISTS unique_question_order;
        ALTER TABLE stage_questions ADD CONSTRAINT unique_question_order_per_company 
            UNIQUE (company_id, stage_id, sequence_order);
    END IF;
END $$;

-- =============================================
-- Add company_id to task_templates table
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task_templates' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE task_templates 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related stage
        UPDATE task_templates 
        SET company_id = js.company_id
        FROM job_stages js
        WHERE task_templates.stage_id = js.id
        AND task_templates.company_id IS NULL;
        
        ALTER TABLE task_templates 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_task_templates_company_id ON task_templates(company_id);
    END IF;
END $$;

-- =============================================
-- Add company_id to job_tasks table (if missing)
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_tasks' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE job_tasks 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related job
        UPDATE job_tasks 
        SET company_id = j.company_id
        FROM jobs j
        WHERE job_tasks.job_id = j.id
        AND job_tasks.company_id IS NULL;
        
        ALTER TABLE job_tasks 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_job_tasks_company_id ON job_tasks(company_id);
    END IF;
END $$;

-- =============================================
-- Add company_id to user_responses table (if missing)
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_responses' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE user_responses 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related job
        UPDATE user_responses 
        SET company_id = j.company_id
        FROM jobs j
        WHERE user_responses.job_id = j.id
        AND user_responses.company_id IS NULL;
        
        ALTER TABLE user_responses 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_user_responses_company_id ON user_responses(company_id);
        
        -- Update unique constraint
        ALTER TABLE user_responses DROP CONSTRAINT IF EXISTS unique_response;
        ALTER TABLE user_responses ADD CONSTRAINT unique_response_per_company 
            UNIQUE (company_id, job_id, question_id, responded_by);
    END IF;
END $$;

-- =============================================
-- Add company_id to stage_audit_log table (if missing)
-- =============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stage_audit_log' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE stage_audit_log 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related job
        UPDATE stage_audit_log 
        SET company_id = j.company_id
        FROM jobs j
        WHERE stage_audit_log.job_id = j.id
        AND stage_audit_log.company_id IS NULL;
        
        ALTER TABLE stage_audit_log 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_stage_audit_log_company_id ON stage_audit_log(company_id);
    END IF;
END $$;

-- =============================================
-- Add company_id to question_reminders table (if exists and missing)
-- =============================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_reminders') 
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'question_reminders' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE question_reminders 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Update existing records based on related job
        UPDATE question_reminders 
        SET company_id = j.company_id
        FROM jobs j
        WHERE question_reminders.job_id = j.id
        AND question_reminders.company_id IS NULL;
        
        ALTER TABLE question_reminders 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_question_reminders_company_id ON question_reminders(company_id);
    END IF;
END $$;

-- =============================================
-- Add company_id to notification_queue table (if exists and missing)
-- =============================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue') 
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_queue' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE notification_queue 
        ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
        
        -- Check if job_id column exists before trying to use it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_queue' AND column_name = 'job_id') THEN
            -- Update existing records based on related job
            UPDATE notification_queue 
            SET company_id = j.company_id
            FROM jobs j
            WHERE notification_queue.job_id = j.id
            AND notification_queue.company_id IS NULL;
        END IF;
        
        -- For records still without company_id, set to first company (needs manual review)
        UPDATE notification_queue 
        SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
        WHERE company_id IS NULL;
        
        ALTER TABLE notification_queue 
        ALTER COLUMN company_id SET NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_notification_queue_company_id ON notification_queue(company_id);
    END IF;
END $$;

-- =============================================
-- Add created_by and updated_by audit fields where missing
-- =============================================

-- Add created_by to job_stages if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_stages' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE job_stages 
        ADD COLUMN created_by UUID REFERENCES users(id);
        
        -- Set to first admin user for existing records
        UPDATE job_stages 
        SET created_by = (
            SELECT id FROM users 
            WHERE role IN ('site_admin', 'company_admin') 
            ORDER BY created_at ASC 
            LIMIT 1
        )
        WHERE created_by IS NULL;
    END IF;
END $$;

-- Add updated_by to job_stages if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_stages' AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE job_stages 
        ADD COLUMN updated_by UUID REFERENCES users(id);
    END IF;
END $$;

-- =============================================
-- Verification Queries
-- =============================================

-- Verify all critical tables have company_id
DO $$
DECLARE
    missing_tables text := '';
    table_name text;
    table_list text[] := ARRAY[
        'job_stages',
        'stage_transitions', 
        'stage_questions',
        'task_templates',
        'job_tasks',
        'user_responses',
        'stage_audit_log'
    ];
BEGIN
    FOREACH table_name IN ARRAY table_list
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = table_name 
            AND column_name = 'company_id'
        ) THEN
            missing_tables := missing_tables || table_name || ', ';
        END IF;
    END LOOP;
    
    IF missing_tables != '' THEN
        RAISE NOTICE 'WARNING: Tables still missing company_id: %', rtrim(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'SUCCESS: All critical tables now have company_id field';
    END IF;
END $$;

COMMIT;

-- =============================================
-- Success Message
-- =============================================

-- ADR Phase 1: Adds company_id fields to all tables for multi-tenancy compliance
SELECT 'company_id fields added successfully - multi-tenancy foundation complete' as status;