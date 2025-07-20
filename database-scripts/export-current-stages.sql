-- Export Current Stage Configuration
-- This will give us the exact data to update our TypeScript config

SELECT 
  sequence_order,
  id,
  name,
  description,
  color,
  maps_to_status,
  stage_type,
  min_duration_hours,
  max_duration_hours
FROM job_stages 
WHERE name LIKE '%/%'
ORDER BY sequence_order;