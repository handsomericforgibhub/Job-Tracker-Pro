-- Debug why the API isn't returning real status history

-- Test the exact query the API is using
SELECT 
    id,
    status,
    changed_at,
    notes,
    changed_by
FROM job_status_history
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID
ORDER BY changed_at ASC;

-- Check RLS policies on job_status_history
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'job_status_history';

-- Test if the API user (anon) can see the status history
SET ROLE anon;
SELECT COUNT(*) as visible_count
FROM job_status_history
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;
RESET ROLE;

-- Test if authenticated user can see the status history
SET ROLE authenticated;
SELECT COUNT(*) as visible_count
FROM job_status_history
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;
RESET ROLE;