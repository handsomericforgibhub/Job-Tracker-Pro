-- Migrate Existing Jobs to Question-Driven System
-- This script enables the question-driven system for existing jobs

BEGIN;

-- =============================================
-- 1. UPDATE EXISTING JOBS WITH STAGE MAPPING
-- =============================================

-- Map existing job statuses to appropriate stages
UPDATE jobs 
SET 
  current_stage_id = CASE 
    WHEN status = 'planning' THEN '550e8400-e29b-41d4-a716-446655440001' -- Lead Qualification
    WHEN status = 'active' THEN '550e8400-e29b-41d4-a716-446655440009' -- Construction Execution
    WHEN status = 'on_hold' THEN current_stage_id -- Keep current stage if set, otherwise will be NULL
    WHEN status = 'completed' THEN '550e8400-e29b-41d4-a716-446655440012' -- Handover & Close
    WHEN status = 'cancelled' THEN '550e8400-e29b-41d4-a716-446655440012' -- Handover & Close
    ELSE '550e8400-e29b-41d4-a716-446655440001' -- Default to Lead Qualification
  END,
  stage_entered_at = COALESCE(stage_entered_at, updated_at, created_at),
  job_type = COALESCE(job_type, 'standard'),
  mobile_optimized = COALESCE(mobile_optimized, true)
WHERE current_stage_id IS NULL;

-- =============================================
-- 2. CREATE INITIAL STAGE PERFORMANCE METRICS
-- =============================================

-- Create performance metrics for jobs that now have stages
INSERT INTO stage_performance_metrics (
  job_id, 
  stage_id, 
  entered_at, 
  exited_at, 
  duration_hours,
  tasks_completed,
  tasks_overdue,
  conversion_successful
)
SELECT 
  j.id as job_id,
  j.current_stage_id as stage_id,
  j.stage_entered_at as entered_at,
  CASE 
    WHEN j.status IN ('completed', 'cancelled') THEN j.updated_at
    ELSE NULL 
  END as exited_at,
  CASE 
    WHEN j.status IN ('completed', 'cancelled') THEN 
      EXTRACT(EPOCH FROM (j.updated_at - j.stage_entered_at)) / 3600
    ELSE NULL 
  END as duration_hours,
  0 as tasks_completed,
  0 as tasks_overdue,
  CASE 
    WHEN j.status = 'completed' THEN true
    WHEN j.status = 'cancelled' THEN false
    ELSE NULL
  END as conversion_successful
FROM jobs j
WHERE j.current_stage_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM stage_performance_metrics spm 
  WHERE spm.job_id = j.id 
  AND spm.stage_id = j.current_stage_id
);

-- =============================================
-- 3. CREATE INITIAL AUDIT LOG ENTRIES
-- =============================================

-- Create audit log entries for the migration
INSERT INTO stage_audit_log (
  job_id,
  from_stage_id,
  to_stage_id,
  from_status,
  to_status,
  trigger_source,
  triggered_by,
  trigger_details,
  duration_in_previous_stage_hours,
  created_at
)
SELECT 
  j.id as job_id,
  NULL as from_stage_id, -- Migration from non-staged system
  j.current_stage_id as to_stage_id,
  NULL as from_status,
  j.status as to_status,
  'system_auto' as trigger_source,
  j.created_by as triggered_by,
  jsonb_build_object(
    'migration', true,
    'original_status', j.status,
    'migration_date', NOW()
  ) as trigger_details,
  EXTRACT(EPOCH FROM (NOW() - j.created_at)) / 3600 as duration_in_previous_stage_hours,
  NOW() as created_at
FROM jobs j
WHERE j.current_stage_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM stage_audit_log sal 
  WHERE sal.job_id = j.id 
  AND sal.trigger_details ? 'migration'
);

-- =============================================
-- 4. VERIFICATION QUERIES
-- =============================================

-- Show migration results
SELECT 
  'Migration Summary' as report_type,
  COUNT(*) as total_jobs,
  COUNT(current_stage_id) as jobs_with_stages,
  COUNT(CASE WHEN current_stage_id IS NULL THEN 1 END) as jobs_without_stages
FROM jobs;

-- Show jobs by stage after migration
SELECT 
  js.name as stage_name,
  j.status as job_status,
  COUNT(*) as job_count
FROM jobs j
LEFT JOIN job_stages js ON j.current_stage_id = js.id
GROUP BY js.name, js.sequence_order, j.status
ORDER BY js.sequence_order, j.status;

-- Show audit log entries created
SELECT 
  COUNT(*) as migration_audit_entries,
  MIN(created_at) as first_entry,
  MAX(created_at) as last_entry
FROM stage_audit_log
WHERE trigger_details ? 'migration';

COMMIT;

-- =============================================
-- 5. MANUAL OVERRIDE INSTRUCTIONS
-- =============================================

-- If you want to enable question-driven system for specific jobs only,
-- you can run this instead of the bulk update above:

/*
-- Enable question-driven system for a specific job
UPDATE jobs 
SET 
  current_stage_id = '550e8400-e29b-41d4-a716-446655440001', -- Lead Qualification
  stage_entered_at = NOW(),
  job_type = 'standard',
  mobile_optimized = true
WHERE id = 'YOUR_JOB_ID_HERE';
*/

-- =============================================
-- 6. DISABLE QUESTION-DRIVEN FOR SPECIFIC JOBS
-- =============================================

-- If you want to disable question-driven system for some jobs:

/*
-- Disable question-driven system for specific jobs
UPDATE jobs 
SET 
  current_stage_id = NULL,
  stage_entered_at = NULL
WHERE id IN ('job_id_1', 'job_id_2');
*/