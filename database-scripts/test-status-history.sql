-- Test script to check status history for the job we've been working with

-- Check current job status
SELECT id, title, status, created_at, updated_at, start_date, end_date
FROM jobs 
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;

-- Check status history for this job
SELECT job_id, status, changed_by, changed_at, notes
FROM job_status_history 
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID
ORDER BY changed_at ASC;

-- Count how many status history entries exist
SELECT COUNT(*) as history_count
FROM job_status_history 
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;