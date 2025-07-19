-- Test function that bypasses potential trigger issues

-- Create a function that updates without triggers
CREATE OR REPLACE FUNCTION direct_job_status_update(
    p_job_id UUID, 
    p_new_status TEXT, 
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status TEXT;
BEGIN
    -- Get current status first
    SELECT status INTO v_old_status
    FROM jobs
    WHERE id = p_job_id;
    
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    -- Try to insert into job_status_history FIRST (before updating jobs)
    -- This might avoid trigger conflicts
    INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
    VALUES (p_job_id, p_new_status, p_user_id, NOW(), p_notes);
    
    -- Then update the job
    UPDATE jobs 
    SET 
        status = p_new_status, 
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE id = p_job_id;
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Direct update error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION direct_job_status_update(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Test with the direct function
SELECT direct_job_status_update(
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    'Test direct update'
);