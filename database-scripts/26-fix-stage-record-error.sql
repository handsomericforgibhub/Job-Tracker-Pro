-- Fix the "stage_record" error by avoiding all potential variable conflicts
-- This version uses different variable names and explicit initialization

DROP FUNCTION IF EXISTS update_job_status_safely(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_job_status_safely(
    p_job_id UUID, 
    p_new_status TEXT, 
    p_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_user_id UUID;
    v_job_company_id UUID;
    v_user_company_id UUID;
    v_user_role TEXT;
    v_auth_user_email TEXT;
    v_is_site_admin BOOLEAN := FALSE;
    v_job_found BOOLEAN := FALSE;
    v_user_found BOOLEAN := FALSE;
BEGIN
    -- Set the user ID (use provided or try to get from auth context)
    v_current_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if job exists and get company_id
    SELECT company_id INTO v_job_company_id
    FROM jobs 
    WHERE id = p_job_id;
    
    -- Check if job was found
    IF v_job_company_id IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    v_job_found := TRUE;
    
    -- First check if user exists in the users table
    SELECT company_id, role INTO v_user_company_id, v_user_role
    FROM users 
    WHERE id = v_current_user_id;
    
    -- Check if user was found in users table
    IF v_user_company_id IS NOT NULL THEN
        v_user_found := TRUE;
    END IF;
    
    -- If user doesn't exist in users table, check if they exist in auth.users
    IF NOT v_user_found THEN
        -- Check if this user exists in auth.users
        SELECT email INTO v_auth_user_email
        FROM auth.users 
        WHERE id = v_current_user_id;
        
        IF v_auth_user_email IS NULL THEN
            RAISE EXCEPTION 'User not found in auth system: %', v_current_user_id;
        END IF;
        
        -- Assume any user in auth.users but not in users table is a site admin
        v_is_site_admin := TRUE;
        v_user_role := 'site_admin';
    END IF;
    
    -- Check access permissions
    -- Site admins can update any job, others must be in same company
    IF v_user_role != 'site_admin' AND NOT v_is_site_admin AND v_user_company_id != v_job_company_id THEN
        RAISE EXCEPTION 'User does not have access to update this job';
    END IF;
    
    -- Update the job status
    UPDATE jobs 
    SET 
        status = p_new_status, 
        updated_at = NOW(),
        updated_by = v_current_user_id
    WHERE id = p_job_id;
    
    -- Check if update was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to update job status - no rows affected';
    END IF;
    
    -- Manually add status history entry
    INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
    VALUES (p_job_id, p_new_status, v_current_user_id, NOW(), p_notes);
    
    -- Check if insert was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to insert status history - no rows affected';
    END IF;
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error updating job status: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_job_status_safely(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Create a super simple test function to isolate the issue
CREATE OR REPLACE FUNCTION simple_job_status_update(
    p_job_id UUID, 
    p_new_status TEXT, 
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Direct update without complex logic
    UPDATE jobs 
    SET 
        status = p_new_status, 
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE id = p_job_id;
    
    -- Direct insert without complex logic
    INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
    VALUES (p_job_id, p_new_status, p_user_id, NOW(), p_notes);
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Simple update error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION simple_job_status_update(UUID, TEXT, UUID, TEXT) TO authenticated;