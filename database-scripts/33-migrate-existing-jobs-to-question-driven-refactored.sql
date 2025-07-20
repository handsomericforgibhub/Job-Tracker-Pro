-- Migrate Existing Jobs to Question-Driven System (Refactored)
-- This script enables the question-driven system for existing jobs
-- Uses constants that match the central TypeScript configuration

BEGIN;

-- =============================================
-- STAGE ID CONSTANTS (matching src/config/stages.ts)
-- =============================================

-- LEAD_QUALIFICATION: '550e8400-e29b-41d4-a716-446655440001'
-- CONSTRUCTION_EXECUTION: '550e8400-e29b-41d4-a716-446655440009'
-- HANDOVER_CLOSE: '550e8400-e29b-41d4-a716-446655440012'

-- =============================================
-- 1. UPDATE EXISTING JOBS WITH STAGE MAPPING
-- =============================================

-- Map existing job statuses to appropriate stages using central config constants
UPDATE jobs 
SET 
  current_stage_id = CASE 
    WHEN status = 'planning' THEN '550e8400-e29b-41d4-a716-446655440001' -- LEAD_QUALIFICATION
    WHEN status = 'active' THEN '550e8400-e29b-41d4-a716-446655440009' -- CONSTRUCTION_EXECUTION
    WHEN status = 'on_hold' THEN current_stage_id -- Keep current stage if set, otherwise will be NULL
    WHEN status = 'completed' THEN '550e8400-e29b-41d4-a716-446655440012' -- HANDOVER_CLOSE
    WHEN status = 'cancelled' THEN '550e8400-e29b-41d4-a716-446655440012' -- HANDOVER_CLOSE
    ELSE '550e8400-e29b-41d4-a716-446655440001' -- Default to LEAD_QUALIFICATION
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
      EXTRACT(EPOCH FROM (j.updated_at - j.stage_entered_at)) / 3600.0
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
    WHERE spm.job_id = j.id AND spm.stage_id = j.current_stage_id
  );

-- =============================================
-- 3. UPDATE JOB STATUS HISTORY
-- =============================================

-- Add stage transition records to job_status_history for existing jobs
INSERT INTO job_status_history (
  job_id,
  old_status,
  new_status,
  changed_by,
  notes,
  created_at
)
SELECT 
  j.id as job_id,
  NULL as old_status,
  j.status as new_status,
  j.created_by as changed_by,
  'Migrated to question-driven system' as notes,
  j.stage_entered_at as created_at
FROM jobs j
WHERE j.current_stage_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_status_history jsh 
    WHERE jsh.job_id = j.id AND jsh.notes = 'Migrated to question-driven system'
  );

-- =============================================
-- 4. CREATE INITIAL STAGE QUESTIONS RESPONSES
-- =============================================

-- For completed jobs, mark final stage questions as answered
INSERT INTO question_responses (
  job_id,
  question_id,
  response_value,
  response_type,
  uploaded_file_path,
  created_at,
  updated_at
)
SELECT 
  j.id as job_id,
  sq.id as question_id,
  CASE 
    WHEN sq.response_type = 'yes_no' THEN 'Yes'
    WHEN sq.response_type = 'text' THEN 'Completed during migration'
    WHEN sq.response_type = 'number' THEN '100'
    WHEN sq.response_type = 'date' THEN j.updated_at::text
    ELSE 'Completed'
  END as response_value,
  sq.response_type,
  NULL as uploaded_file_path,
  j.updated_at as created_at,
  j.updated_at as updated_at
FROM jobs j
JOIN stage_questions sq ON sq.stage_id = j.current_stage_id
WHERE j.status = 'completed' 
  AND j.current_stage_id = '550e8400-e29b-41d4-a716-446655440012' -- HANDOVER_CLOSE
  AND NOT EXISTS (
    SELECT 1 FROM question_responses qr 
    WHERE qr.job_id = j.id AND qr.question_id = sq.id
  );

-- =============================================
-- 5. UPDATE PLATFORM SETTINGS
-- =============================================

-- Ensure migration tracking is recorded
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_active, created_at) VALUES
('question_driven_migration_completed', 'true', 'migration_tracking', 'Question-driven system migration completed', true, NOW())
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = 'true',
  updated_at = NOW();

-- Record migration statistics
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_active, created_at) VALUES
('migration_jobs_updated', (SELECT COUNT(*)::text FROM jobs WHERE current_stage_id IS NOT NULL), 'migration_tracking', 'Number of jobs migrated to question-driven system', true, NOW())
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = (SELECT COUNT(*)::text FROM jobs WHERE current_stage_id IS NOT NULL),
  updated_at = NOW();

COMMIT;

-- =============================================
-- 6. VERIFICATION QUERIES
-- =============================================

-- Show migration results
SELECT 
  'Jobs with stage assignments' as metric,
  COUNT(*) as count
FROM jobs 
WHERE current_stage_id IS NOT NULL

UNION ALL

SELECT 
  'Performance metrics created' as metric,
  COUNT(*) as count
FROM stage_performance_metrics

UNION ALL

SELECT 
  'Question responses created' as metric,
  COUNT(*) as count
FROM question_responses

UNION ALL

SELECT 
  'Status history entries' as metric,
  COUNT(*) as count
FROM job_status_history 
WHERE notes = 'Migrated to question-driven system';

-- Show stage distribution after migration
SELECT 
  js.name as stage_name,
  js.sequence_order,
  COUNT(j.id) as job_count,
  js.maps_to_status as maps_to_status
FROM job_stages js
LEFT JOIN jobs j ON j.current_stage_id = js.id
GROUP BY js.id, js.name, js.sequence_order, js.maps_to_status
ORDER BY js.sequence_order;

-- Show jobs that still need manual review (no stage assigned)
SELECT 
  id,
  title,
  status,
  created_at,
  'Manual stage assignment needed' as action_required
FROM jobs 
WHERE current_stage_id IS NULL
ORDER BY created_at DESC;

-- =============================================
-- MAINTENANCE NOTES
-- =============================================

-- This refactored migration script:
-- 1. Uses the same stage IDs as defined in /src/config/stages.ts
-- 2. Maintains consistency with the central configuration
-- 3. Includes proper verification and rollback safety
-- 4. Records migration metadata for audit purposes

-- Post-migration steps:
-- 1. Review jobs without stage assignments
-- 2. Test question-driven progression on a sample job
-- 3. Verify stage transitions work correctly
-- 4. Check that colors and names match UI expectations