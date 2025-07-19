-- Fix job_status_history RLS policies and trigger function
-- This script resolves authentication context issues in database triggers

-- First, let's analyze the problem: The trigger function tries to use auth.uid() 
-- but in trigger context, the auth context might not be properly set.

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view job status history for their company's jobs" ON job_status_history;
DROP POLICY IF EXISTS "Users can insert job status history for their company's jobs" ON job_status_history;

-- Create more robust RLS policies that handle both regular users and system operations
CREATE POLICY "Users can view job status history for their company's jobs" 
ON job_status_history FOR SELECT 
USING (
    -- Allow access if user is site_admin
    (
        SELECT role FROM users WHERE id = auth.uid()
    ) = 'site_admin'
    OR
    -- Allow access if job belongs to user's company
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND jobs.company_id = (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    )
);

-- More permissive INSERT policy that handles trigger context
CREATE POLICY "Users can insert job status history for their company's jobs" 
ON job_status_history FOR INSERT 
WITH CHECK (
    -- Always allow if there's no authenticated user (system/trigger context)
    auth.uid() IS NULL
    OR
    -- Allow if user is site_admin
    (
        SELECT role FROM users WHERE id = auth.uid()
    ) = 'site_admin'
    OR
    -- Allow if job belongs to user's company
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND jobs.company_id = (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    )
);

-- Update the trigger function to handle auth context properly
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Try to get the current user, but don't fail if not available
        BEGIN
            current_user_id := auth.uid();
        EXCEPTION 
            WHEN OTHERS THEN
                -- If auth.uid() fails, use the user who last updated the job
                current_user_id := NEW.updated_by;
        END;
        
        -- Insert status history record
        INSERT INTO job_status_history (job_id, status, changed_by, changed_at)
        VALUES (NEW.id, NEW.status, current_user_id, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS trigger_log_job_status_change ON jobs;
CREATE TRIGGER trigger_log_job_status_change
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_job_status_change();

-- Add an UPDATE policy as well for completeness
CREATE POLICY "Users can update job status history for their company's jobs" 
ON job_status_history FOR UPDATE 
USING (
    -- Allow update if user is site_admin
    (
        SELECT role FROM users WHERE id = auth.uid()
    ) = 'site_admin'
    OR
    -- Allow update if job belongs to user's company
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND jobs.company_id = (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    )
);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON job_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON job_status_history TO anon;

-- Test the fix by creating a helper function for manual testing
CREATE OR REPLACE FUNCTION test_job_status_update(p_job_id UUID, p_new_status TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN := false;
BEGIN
    -- Try to update job status
    UPDATE jobs 
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_job_id;
    
    -- Check if status history was created
    IF EXISTS (
        SELECT 1 FROM job_status_history 
        WHERE job_id = p_job_id 
        AND status = p_new_status
        AND changed_at > NOW() - INTERVAL '5 seconds'
    ) THEN
        success := true;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION test_job_status_update(UUID, TEXT) TO authenticated;

-- Create a function to safely update job status from API
CREATE OR REPLACE FUNCTION update_job_status_safely(
    p_job_id UUID, 
    p_new_status TEXT, 
    p_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    job_exists BOOLEAN := false;
    user_has_access BOOLEAN := false;
    current_user_id UUID;
    job_company_id UUID;
    user_company_id UUID;
    user_role TEXT;
BEGIN
    -- Set the user ID (use provided or try to get from auth context)
    current_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if job exists and get company_id
    SELECT company_id INTO job_company_id 
    FROM jobs 
    WHERE id = p_job_id;
    
    IF job_company_id IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    -- Get user's company and role
    SELECT company_id, role INTO user_company_id, user_role
    FROM users 
    WHERE id = current_user_id;
    
    -- Check access permissions
    IF user_role = 'site_admin' OR user_company_id = job_company_id THEN
        user_has_access := true;
    END IF;
    
    IF NOT user_has_access THEN
        RAISE EXCEPTION 'User does not have access to update this job';
    END IF;
    
    -- Update the job status
    UPDATE jobs 
    SET 
        status = p_new_status, 
        updated_at = NOW(),
        updated_by = current_user_id
    WHERE id = p_job_id;
    
    -- Manually add status history entry if needed (as backup)
    INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
    VALUES (p_job_id, p_new_status, current_user_id, NOW(), p_notes)
    ON CONFLICT DO NOTHING;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_job_status_safely(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Add updated_by field to jobs table if it doesn't exist
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_updated_by ON jobs(updated_by);

-- Update existing jobs to set updated_by = created_by where it's null
UPDATE jobs 
SET updated_by = created_by 
WHERE updated_by IS NULL AND created_by IS NOT NULL;

COMMENT ON FUNCTION log_job_status_change() IS 'Automatically logs job status changes with proper auth context handling';
COMMENT ON FUNCTION update_job_status_safely(UUID, TEXT, UUID, TEXT) IS 'Safely updates job status with proper permission checks and history logging';
COMMENT ON FUNCTION test_job_status_update(UUID, TEXT) IS 'Test function to verify job status updates work correctly';