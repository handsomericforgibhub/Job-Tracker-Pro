-- Find the problematic trigger function

-- Get the source of the update_project_stage_completion function
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'update_project_stage_completion';

-- Check what triggers use this function
SELECT 
    t.trigger_name,
    t.event_object_table,
    t.event_manipulation,
    t.action_timing,
    t.action_statement
FROM information_schema.triggers t
WHERE t.action_statement LIKE '%update_project_stage_completion%';