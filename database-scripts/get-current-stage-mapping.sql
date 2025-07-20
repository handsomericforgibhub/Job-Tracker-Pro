-- Get Current Stage Mapping
-- This will help us understand the existing stage structure

-- Show all existing stages in order
SELECT 
  id, 
  name, 
  sequence_order, 
  color, 
  maps_to_status, 
  stage_type,
  min_duration_hours,
  max_duration_hours
FROM job_stages 
ORDER BY sequence_order;

-- Show which stages are missing (if any)
SELECT 
  CASE sequence_order
    WHEN 1 THEN '1/12 Lead Qualification'
    WHEN 2 THEN '2/12 Initial Client Meeting'
    WHEN 3 THEN '3/12 Quote Preparation'
    WHEN 4 THEN '4/12 Quote Submission'
    WHEN 5 THEN '5/12 Client Decision'
    WHEN 6 THEN '6/12 Contract & Deposit'
    WHEN 7 THEN '7/12 Planning & Procurement'
    WHEN 8 THEN '8/12 On-Site Preparation'
    WHEN 9 THEN '9/12 Construction Execution'
    WHEN 10 THEN '10/12 Inspections & Progress Payments'
    WHEN 11 THEN '11/12 Finalisation'
    WHEN 12 THEN '12/12 Handover & Close'
  END as expected_name,
  sequence_order,
  name as actual_name,
  id as current_uuid
FROM job_stages 
WHERE sequence_order BETWEEN 1 AND 12
ORDER BY sequence_order;

-- Check if we have all 12 stages
SELECT 
  'Total stages (should be 12)' as metric,
  COUNT(*) as count
FROM job_stages
WHERE name LIKE '%/%';

-- Check for missing stages
WITH expected_stages AS (
  SELECT generate_series(1, 12) as seq
)
SELECT 
  es.seq as missing_sequence_order,
  CASE es.seq
    WHEN 1 THEN '1/12 Lead Qualification'
    WHEN 2 THEN '2/12 Initial Client Meeting'
    WHEN 3 THEN '3/12 Quote Preparation'
    WHEN 4 THEN '4/12 Quote Submission'
    WHEN 5 THEN '5/12 Client Decision'
    WHEN 6 THEN '6/12 Contract & Deposit'
    WHEN 7 THEN '7/12 Planning & Procurement'
    WHEN 8 THEN '8/12 On-Site Preparation'
    WHEN 9 THEN '9/12 Construction Execution'
    WHEN 10 THEN '10/12 Inspections & Progress Payments'
    WHEN 11 THEN '11/12 Finalisation'
    WHEN 12 THEN '12/12 Handover & Close'
  END as missing_stage_name
FROM expected_stages es
LEFT JOIN job_stages js ON js.sequence_order = es.seq
WHERE js.id IS NULL;