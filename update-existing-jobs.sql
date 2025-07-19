-- Update existing jobs to use the first stage of the question-driven system
-- This will assign the Lead Qualification stage to all jobs that don't have a current_stage_id

UPDATE jobs 
SET 
  current_stage_id = '550e8400-e29b-41d4-a716-446655440001',  -- Lead Qualification stage
  stage_entered_at = NOW()
WHERE current_stage_id IS NULL;

-- Verify the update
SELECT 
  j.id,
  j.title,
  j.status,
  j.current_stage_id,
  js.name as current_stage_name
FROM jobs j
LEFT JOIN job_stages js ON j.current_stage_id = js.id
ORDER BY j.created_at DESC;