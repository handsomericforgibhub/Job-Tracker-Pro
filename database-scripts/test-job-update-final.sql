-- Test job update now that the trigger function is fixed

-- Test simple manual update first
UPDATE jobs 
SET status = 'active', updated_at = NOW()
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;

-- Test inserting into job_status_history
INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
VALUES (
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    NOW(),
    'Test after trigger fix'
);

-- Test our safe update function
SELECT update_job_status_safely(
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'on_hold',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    'Test safe function after trigger fix'
);

-- Verify the job was updated
SELECT id, status, updated_at, updated_by
FROM jobs 
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;

-- Check the status history
SELECT job_id, status, changed_by, changed_at, notes
FROM job_status_history 
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID
ORDER BY changed_at DESC
LIMIT 5;