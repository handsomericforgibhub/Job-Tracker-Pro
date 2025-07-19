-- Manual test without any functions to isolate the issue

-- First, try a simple SELECT to make sure the job exists
SELECT id, status, company_id, created_by, updated_by
FROM jobs 
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;

-- Try a simple UPDATE without any function
UPDATE jobs 
SET status = 'active', updated_at = NOW()
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;

-- Try a simple INSERT into job_status_history
INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
VALUES (
    'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID,
    'active',
    'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID,
    NOW(),
    'Manual test insert'
);