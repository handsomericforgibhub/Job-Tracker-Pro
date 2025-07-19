-- Debug script to check for triggers and constraints that might cause "stage_record" error

-- Check all triggers on the jobs table
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement,
    p.prosrc as function_source
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON p.proname = REPLACE(REPLACE(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '')
WHERE t.event_object_table = 'jobs';

-- Check all triggers on the job_status_history table  
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement,
    p.prosrc as function_source
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON p.proname = REPLACE(REPLACE(t.action_statement, 'EXECUTE FUNCTION ', ''), '()', '')
WHERE t.event_object_table = 'job_status_history';

-- Check for any functions that might contain "stage_record"
SELECT proname, prosrc 
FROM pg_proc 
WHERE prosrc LIKE '%stage_record%';

-- Check the structure of both tables
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'jobs'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'job_status_history'
ORDER BY ordinal_position;