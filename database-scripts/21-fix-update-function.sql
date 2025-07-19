-- Fix the update_job_status_safely function
-- This addresses the "stage_record is not assigned yet" error

-- Drop and recreate the function with proper variable initialization
DROP FUNCTION IF EXISTS update_job_status_safely(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_job_status_safely(
    p_job_id UUID, 
    p_new_status TEXT, 
    p_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    job_company_id UUID;
    user_company_id UUID;
    user_role TEXT;
    job_record RECORD;
    user_record RECORD;
BEGIN
    -- Set the user ID (use provided or try to get from auth context)
    current_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if job exists and get company_id
    SELECT * INTO job_record 
    FROM jobs 
    WHERE id = p_job_id;
    
    IF job_record IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    job_company_id := job_record.company_id;
    
    -- Get user's company and role
    SELECT * INTO user_record
    FROM users 
    WHERE id = current_user_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found: %', current_user_id;
    END IF;
    
    user_company_id := user_record.company_id;
    user_role := user_record.role;
    
    -- Check access permissions
    IF user_role != 'site_admin' AND user_company_id != job_company_id THEN
        RAISE EXCEPTION 'User does not have access to update this job';
    END IF;
    
    -- Update the job status
    UPDATE jobs 
    SET 
        status = p_new_status, 
        updated_at = NOW(),
        updated_by = current_user_id
    WHERE id = p_job_id;
    
    -- Manually add status history entry
    INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
    VALUES (p_job_id, p_new_status, current_user_id, NOW(), p_notes);
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error updating job status: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_job_status_safely(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Test the function
SELECT update_job_status_safely(
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    'Test update from fixed function'
);