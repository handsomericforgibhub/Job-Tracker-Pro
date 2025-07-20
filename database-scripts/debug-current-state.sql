-- Debug Current Database State
-- Run this to understand the current structure before proceeding

-- =============================================
-- 1. CHECK EXISTING STAGES
-- =============================================

-- Show all existing job stages
SELECT 'Existing job_stages' as table_name, count(*) as record_count FROM job_stages;
SELECT id, name, sequence_order, maps_to_status, color FROM job_stages ORDER BY sequence_order LIMIT 20;

-- =============================================
-- 2. CHECK STAGE-RELATED TABLES
-- =============================================

-- Show stage questions
SELECT 'Existing stage_questions' as table_name, count(*) as record_count FROM stage_questions;

-- Show stage transitions  
SELECT 'Existing stage_transitions' as table_name, count(*) as record_count FROM stage_transitions;

-- Show task templates
SELECT 'Existing task_templates' as table_name, count(*) as record_count FROM task_templates;

-- =============================================
-- 3. CHECK JOBS TABLE STRUCTURE
-- =============================================

-- Show jobs with current stage assignments
SELECT 'Jobs with current_stage_id' as metric, count(*) as count FROM jobs WHERE current_stage_id IS NOT NULL;
SELECT 'Jobs without current_stage_id' as metric, count(*) as count FROM jobs WHERE current_stage_id IS NULL;

-- Show sample jobs and their stages
SELECT j.id, j.title, j.status, j.current_stage_id, js.name as current_stage_name 
FROM jobs j 
LEFT JOIN job_stages js ON j.current_stage_id = js.id 
LIMIT 10;

-- =============================================
-- 4. CHECK PLATFORM SETTINGS
-- =============================================

-- Show existing platform settings
SELECT setting_key, setting_value, setting_type FROM platform_settings 
WHERE setting_key LIKE '%stage%' OR setting_key LIKE '%question%' OR setting_key LIKE '%migration%'
ORDER BY setting_key;

-- =============================================
-- 5. CHECK DATA TYPES
-- =============================================

-- Check the data type of stage IDs
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('job_stages', 'jobs', 'stage_questions', 'stage_transitions')
  AND column_name LIKE '%stage_id%' OR column_name = 'id'
ORDER BY table_name, column_name;

-- =============================================
-- 6. CHECK FOREIGN KEY CONSTRAINTS
-- =============================================

-- Show foreign key constraints related to stages
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (tc.table_name LIKE '%stage%' OR tc.table_name = 'jobs')
ORDER BY tc.table_name;

-- =============================================
-- 7. SAMPLE QUERIES TO UNDERSTAND PATTERNS
-- =============================================

-- Show any existing stage IDs to understand the pattern
SELECT DISTINCT current_stage_id FROM jobs WHERE current_stage_id IS NOT NULL LIMIT 10;

-- Show existing stage IDs in job_stages table
SELECT id, name FROM job_stages LIMIT 10;