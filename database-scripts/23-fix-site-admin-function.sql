-- Fix the update_job_status_safely function to handle site_admin users properly
-- Site admins might exist in auth.users but not in the users table

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
    auth_user_email TEXT;
    is_site_admin BOOLEAN := FALSE;
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
    
    -- First check if user exists in the users table
    SELECT company_id, role INTO user_company_id, user_role
    FROM users 
    WHERE id = current_user_id;
    
    -- If user doesn't exist in users table, check if they're a site admin in auth.users
    IF user_company_id IS NULL THEN
        -- Check if this user exists in auth.users and has site_admin role
        SELECT email INTO auth_user_email
        FROM auth.users 
        WHERE id = current_user_id;
        
        IF auth_user_email IS NULL THEN
            RAISE EXCEPTION 'User not found in auth system: %', current_user_id;
        END IF;
        
        -- Check if this is a site admin by looking at raw_user_meta_data
        SELECT CASE 
            WHEN raw_user_meta_data->>'role' = 'site_admin' THEN TRUE
            ELSE FALSE
        END INTO is_site_admin
        FROM auth.users 
        WHERE id = current_user_id;
        
        IF NOT is_site_admin THEN
            RAISE EXCEPTION 'User exists in auth but is not a site admin and not found in users table: %', current_user_id;
        END IF;
        
        -- Set site admin role for permissions check
        user_role := 'site_admin';
    END IF;
    
    -- Check access permissions
    -- Site admins can update any job, others must be in same company
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

-- Create a helper function to check user status
CREATE OR REPLACE FUNCTION check_user_status(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    user_company_id UUID;
    user_role TEXT;
    auth_email TEXT;
    auth_role TEXT;
BEGIN
    -- Check users table
    SELECT company_id, role INTO user_company_id, user_role
    FROM users 
    WHERE id = p_user_id;
    
    result := result || 'Users table: ';
    IF user_company_id IS NOT NULL THEN
        result := result || 'Found - Role: ' || COALESCE(user_role, 'NULL') || ', Company: ' || user_company_id || E'\n';
    ELSE
        result := result || 'Not found' || E'\n';
    END IF;
    
    -- Check auth.users table
    SELECT email, raw_user_meta_data->>'role' INTO auth_email, auth_role
    FROM auth.users 
    WHERE id = p_user_id;
    
    result := result || 'Auth table: ';
    IF auth_email IS NOT NULL THEN
        result := result || 'Found - Email: ' || auth_email || ', Role: ' || COALESCE(auth_role, 'NULL');
    ELSE
        result := result || 'Not found';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_user_status(UUID) TO authenticated;