-- Fix the update_job_status_safely function - simplified version
-- This addresses the "stage_record is not assigned yet" error by avoiding RECORD variables

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
    job_exists BOOLEAN := FALSE;
    user_exists BOOLEAN := FALSE;
BEGIN
    -- Set the user ID (use provided or try to get from auth context)
    current_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if job exists and get company_id (avoid RECORD variables)
    SELECT company_id INTO job_company_id
    FROM jobs 
    WHERE id = p_job_id;
    
    -- Check if we found a job
    IF job_company_id IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    -- Get user's company and role (avoid RECORD variables)
    SELECT company_id, role INTO user_company_id, user_role
    FROM users 
    WHERE id = current_user_id;
    
    -- Check if we found a user
    IF user_company_id IS NULL THEN
        RAISE EXCEPTION 'User not found: %', current_user_id;
    END IF;
    
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

-- Test the function with debug output
CREATE OR REPLACE FUNCTION debug_update_job_status_safely(
    p_job_id UUID, 
    p_new_status TEXT, 
    p_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    current_user_id UUID;
    job_company_id UUID;
    user_company_id UUID;
    user_role TEXT;
    debug_info TEXT := '';
BEGIN
    -- Set the user ID (use provided or try to get from auth context)
    current_user_id := COALESCE(p_user_id, auth.uid());
    debug_info := debug_info || 'User ID: ' || current_user_id || E'\n';
    
    -- Check if job exists and get company_id
    SELECT company_id INTO job_company_id
    FROM jobs 
    WHERE id = p_job_id;
    
    debug_info := debug_info || 'Job Company ID: ' || COALESCE(job_company_id::TEXT, 'NULL') || E'\n';
    
    IF job_company_id IS NULL THEN
        RETURN debug_info || 'ERROR: Job not found';
    END IF;
    
    -- Get user's company and role
    SELECT company_id, role INTO user_company_id, user_role
    FROM users 
    WHERE id = current_user_id;
    
    debug_info := debug_info || 'User Company ID: ' || COALESCE(user_company_id::TEXT, 'NULL') || E'\n';
    debug_info := debug_info || 'User Role: ' || COALESCE(user_role, 'NULL') || E'\n';
    
    IF user_company_id IS NULL THEN
        RETURN debug_info || 'ERROR: User not found';
    END IF;
    
    -- Check access permissions
    IF user_role != 'site_admin' AND user_company_id != job_company_id THEN
        RETURN debug_info || 'ERROR: User does not have access to update this job';
    END IF;
    
    debug_info := debug_info || 'Permission check passed' || E'\n';
    
    -- Try to update the job status
    UPDATE jobs 
    SET 
        status = p_new_status, 
        updated_at = NOW(),
        updated_by = current_user_id
    WHERE id = p_job_id;
    
    debug_info := debug_info || 'Job status updated' || E'\n';
    
    -- Try to insert status history
    INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
    VALUES (p_job_id, p_new_status, current_user_id, NOW(), p_notes);
    
    debug_info := debug_info || 'Status history inserted' || E'\n';
    
    RETURN debug_info || 'SUCCESS: Job status updated successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN debug_info || 'ERROR: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_update_job_status_safely(UUID, TEXT, UUID, TEXT) TO authenticated;