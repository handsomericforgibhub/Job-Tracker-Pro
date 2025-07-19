-- Test script to verify the update_job_status_safely function works
-- Run this after applying 21-fix-update-function.sql

-- First, check if the function exists
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname = 'update_job_status_safely';

-- Check if there are any jobs to test with
SELECT id, title, status, company_id 
FROM jobs 
LIMIT 5;

-- Check if there are any users to test with
SELECT id, email, role, company_id 
FROM users 
WHERE role = 'site_admin' 
LIMIT 1;

-- Test the function with a simple case (replace UUIDs with actual values from your database)
-- This should work if the function is properly fixed
-- SELECT update_job_status_safely(
--     'your-job-id-here'::UUID,
--     'active',
--     'your-user-id-here'::UUID,
--     'Test update from fixed function'
-- );