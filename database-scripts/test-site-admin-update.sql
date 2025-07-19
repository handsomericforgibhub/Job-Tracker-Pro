-- Test the site admin job update function

-- First, check the user status
SELECT check_user_status('fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID);

-- Then test the job update
SELECT update_job_status_safely(
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    'Test update from site admin'
);