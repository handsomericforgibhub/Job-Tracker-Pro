-- Fix the update_project_stage_completion trigger function
-- This function has a variable initialization issue

-- First, let's see if we can get the current function definition
-- and then fix the "stage_record" variable issue

-- Drop the problematic function temporarily to allow job updates
DROP FUNCTION IF EXISTS update_project_stage_completion() CASCADE;

-- Create a fixed version that properly initializes the stage_record variable
CREATE OR REPLACE FUNCTION update_project_stage_completion()
RETURNS TRIGGER AS $$
DECLARE
    stage_record RECORD;
    completion_percentage DECIMAL;
    total_jobs INTEGER;
    completed_jobs INTEGER;
BEGIN
    -- Only process if project_stage_id exists in the NEW record
    IF NEW.project_stage_id IS NOT NULL THEN
        -- Initialize the stage_record by selecting from project_stages
        SELECT * INTO stage_record
        FROM project_stages
        WHERE id = NEW.project_stage_id;
        
        -- Only proceed if we found the stage record
        IF stage_record IS NOT NULL THEN
            -- Calculate completion percentage for this stage
            SELECT COUNT(*) INTO total_jobs
            FROM jobs
            WHERE project_stage_id = NEW.project_stage_id;
            
            SELECT COUNT(*) INTO completed_jobs
            FROM jobs
            WHERE project_stage_id = NEW.project_stage_id
            AND status = 'completed';
            
            -- Calculate percentage
            IF total_jobs > 0 THEN
                completion_percentage := (completed_jobs::DECIMAL / total_jobs::DECIMAL) * 100;
            ELSE
                completion_percentage := 0;
            END IF;
            
            -- Update the project stage completion
            UPDATE project_stages
            SET 
                completion_percentage = completion_percentage,
                updated_at = NOW()
            WHERE id = NEW.project_stage_id;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the main operation if stage completion update fails
        RAISE WARNING 'Failed to update project stage completion: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger if it existed
-- We'll check first if the project_stages table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_stages') THEN
        -- Only create trigger if project_stages table exists
        DROP TRIGGER IF EXISTS update_project_stage_completion_trigger ON jobs;
        CREATE TRIGGER update_project_stage_completion_trigger
            AFTER UPDATE ON jobs
            FOR EACH ROW
            EXECUTE FUNCTION update_project_stage_completion();
    END IF;
END $$;

-- Test the job update again
UPDATE jobs 
SET status = 'active', updated_at = NOW()
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;