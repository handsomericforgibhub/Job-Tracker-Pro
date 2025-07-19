-- Test the simple update function to isolate the "stage_record" issue

-- Test the simple function first
SELECT simple_job_status_update(
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    'Test simple update'
);

-- If that works, test the full function
SELECT update_job_status_safely(
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    'Test full update'
);