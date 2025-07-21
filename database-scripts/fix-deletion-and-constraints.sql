-- Comprehensive fix for job deletion and stage progression constraints
-- This script addresses foreign key constraints and null value violations

BEGIN;

-- =============================================
-- 1. ADD CASCADE DELETIONS FOR RELATED TABLES
-- =============================================

-- Drop existing foreign key constraints and recreate with CASCADE
ALTER TABLE user_responses 
DROP CONSTRAINT IF EXISTS user_responses_job_id_fkey;

ALTER TABLE user_responses
ADD CONSTRAINT user_responses_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- Handle other related tables that might block job deletion
ALTER TABLE job_tasks 
DROP CONSTRAINT IF EXISTS job_tasks_job_id_fkey;

ALTER TABLE job_tasks
ADD CONSTRAINT job_tasks_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE stage_audit_log 
DROP CONSTRAINT IF EXISTS stage_audit_log_job_id_fkey;

ALTER TABLE stage_audit_log
ADD CONSTRAINT stage_audit_log_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE stage_performance_metrics 
DROP CONSTRAINT IF EXISTS stage_performance_metrics_job_id_fkey;

ALTER TABLE stage_performance_metrics
ADD CONSTRAINT stage_performance_metrics_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- =============================================
-- 2. FIX STAGE_AUDIT_LOG CONSTRAINTS
-- =============================================

-- Make to_status nullable for error cases
ALTER TABLE stage_audit_log 
ALTER COLUMN to_status DROP NOT NULL;

-- =============================================
-- 3. ENHANCED PROCESS_STAGE_RESPONSE FUNCTION
-- =============================================

-- Enhanced stage progression function with complete error handling
CREATE OR REPLACE FUNCTION process_stage_response(
  p_job_id UUID,
  p_question_id UUID,
  p_response_value TEXT,
  p_user_id UUID,
  p_response_source VARCHAR(50) DEFAULT 'web_app',
  p_response_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_current_stage_id UUID;
  v_next_stage_id UUID;
  v_question_record RECORD;
  v_transition_record RECORD;
  v_job_record RECORD;
  v_should_skip BOOLEAN := false;
  v_created_tasks INTEGER := 0;
  v_audit_id UUID;
  v_result JSONB;
  v_duration_hours INTEGER;
  v_existing_response RECORD;
  v_current_status TEXT;
  v_next_status TEXT;
BEGIN
  -- 1. Validate inputs
  IF p_job_id IS NULL OR p_question_id IS NULL OR p_response_value IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;
  
  -- 2. Get job details
  SELECT * INTO v_job_record
  FROM jobs
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  v_current_stage_id := v_job_record.current_stage_id;
  v_current_status := v_job_record.status;
  
  -- 3. Get question details
  SELECT * INTO v_question_record
  FROM stage_questions
  WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found: %', p_question_id;
  END IF;
  
  -- 4. Validate response format
  PERFORM validate_response_format(v_question_record.response_type, p_response_value);
  
  -- 5. Check for existing response
  SELECT * INTO v_existing_response
  FROM user_responses
  WHERE job_id = p_job_id AND question_id = p_question_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- 6. Handle existing response - update instead of insert to avoid duplicate key violation
  IF FOUND THEN
    UPDATE user_responses
    SET 
      response_value = p_response_value,
      response_metadata = p_response_metadata,
      response_source = p_response_source,
      updated_at = NOW()
    WHERE job_id = p_job_id AND question_id = p_question_id;
  ELSE
    -- Insert new response
    INSERT INTO user_responses (
      job_id, question_id, response_value, response_metadata,
      responded_by, response_source, created_at, updated_at
    ) VALUES (
      p_job_id, p_question_id, p_response_value, p_response_metadata,
      p_user_id, p_response_source, NOW(), NOW()
    );
  END IF;
  
  -- 7. Check for conditional skip logic
  v_should_skip := evaluate_skip_conditions(p_job_id, p_question_id, p_response_value);
  
  -- 8. Skip processing if conditions met
  IF v_should_skip THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'skipped',
      'message', 'Question skipped due to conditional logic',
      'current_stage_id', v_current_stage_id,
      'next_stage_id', v_current_stage_id,
      'stage_progressed', false
    );
  END IF;
  
  -- 9. Determine next stage
  SELECT * INTO v_transition_record
  FROM stage_transitions
  WHERE from_stage_id = v_current_stage_id
  AND (
    trigger_response = p_response_value
    OR (
      conditions->>'condition' IS NOT NULL
      AND evaluate_transition_condition(conditions->>'condition', p_response_value)
    )
  )
  ORDER BY is_automatic DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No transition found, stay in current stage
    RETURN jsonb_build_object(
      'success', true,
      'action', 'no_transition',
      'message', 'No stage transition triggered',
      'current_stage_id', v_current_stage_id,
      'next_stage_id', v_current_stage_id,
      'stage_progressed', false
    );
  END IF;
  
  v_next_stage_id := v_transition_record.to_stage_id;
  v_next_status := get_status_from_stage(v_next_stage_id);
  
  -- 10. Calculate duration in previous stage
  SELECT EXTRACT(EPOCH FROM (NOW() - stage_entered_at)) / 3600 INTO v_duration_hours
  FROM jobs
  WHERE id = p_job_id;
  
  -- 11. Update job stage atomically
  UPDATE jobs
  SET 
    current_stage_id = v_next_stage_id,
    stage_entered_at = NOW(),
    status = v_next_status,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- 12. Create performance metrics record
  INSERT INTO stage_performance_metrics (
    job_id, stage_id, entered_at, exited_at, duration_hours
  ) VALUES (
    p_job_id, v_current_stage_id, v_job_record.stage_entered_at, NOW(), v_duration_hours
  );
  
  -- 13. Create audit log entry
  INSERT INTO stage_audit_log (
    job_id, from_stage_id, to_stage_id, from_status, to_status,
    trigger_source, triggered_by, trigger_details, question_id, response_value,
    duration_in_previous_stage_hours, created_at
  ) VALUES (
    p_job_id, v_current_stage_id, v_next_stage_id, 
    v_current_status, v_next_status,
    'question_response', p_user_id, 
    jsonb_build_object('source', p_response_source, 'metadata', p_response_metadata),
    p_question_id, p_response_value, v_duration_hours, NOW()
  ) RETURNING id INTO v_audit_id;
  
  -- 14. Create tasks for new stage
  SELECT create_tasks_for_stage(p_job_id, v_next_stage_id, p_user_id) INTO v_created_tasks;
  
  -- 15. Build result
  v_result := jsonb_build_object(
    'success', true,
    'action', 'stage_transition',
    'message', 'Stage transition completed successfully',
    'current_stage_id', v_current_stage_id,
    'next_stage_id', v_next_stage_id,
    'tasks_created', v_created_tasks,
    'duration_hours', v_duration_hours,
    'audit_id', v_audit_id,
    'stage_progressed', true
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with proper handling of null constraints
    INSERT INTO stage_audit_log (
      job_id, from_stage_id, to_stage_id, from_status, to_status,
      trigger_source, triggered_by, trigger_details, created_at
    ) VALUES (
      p_job_id, v_current_stage_id, v_current_stage_id, v_current_status, NULL,
      'error', p_user_id,
      jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE), NOW()
    );
    
    RAISE EXCEPTION 'Stage progression failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. ADD UPDATED_AT COLUMN IF MISSING
-- =============================================

-- Ensure user_responses has updated_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='user_responses' AND column_name='updated_at'
  ) THEN
    ALTER TABLE user_responses ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_stage_response(UUID, UUID, TEXT, UUID, VARCHAR, JSONB) TO authenticated;

COMMIT;

-- =============================================
-- 5. VERIFICATION
-- =============================================

-- Verify foreign key constraints
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'jobs'
ORDER BY tc.table_name, tc.constraint_name;