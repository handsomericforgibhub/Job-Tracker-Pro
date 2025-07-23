-- =============================================================================
-- STAGE PROGRESSION BUG FIX - CONSOLIDATED DEPLOYMENT SCRIPT
-- =============================================================================
-- This script fixes the case-sensitive transition evaluation bug that prevents
-- jobs from progressing between stages despite correct question answers.
--
-- ISSUE: "Yes" !== "yes" causes no_transition even with correct answers
-- FIX: Case-insensitive comparison with UPPER(TRIM(...))
--
-- DEPLOY INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- 4. Test stage progression in your application
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: HELPER FUNCTIONS
-- =============================================================================

-- Function to validate response format (simple version)
CREATE OR REPLACE FUNCTION validate_response_format(
  response_type TEXT,
  response_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Simple validation - can be enhanced later
  IF response_type = 'yes_no' THEN
    RETURN UPPER(TRIM(response_value)) IN ('YES', 'NO');
  ELSIF response_type = 'text' THEN
    RETURN response_value IS NOT NULL AND LENGTH(TRIM(response_value)) > 0;
  ELSIF response_type = 'number' THEN
    RETURN response_value ~ '^[0-9]+(\.[0-9]+)?$';
  ELSIF response_type = 'date' THEN
    BEGIN
      PERFORM response_value::DATE;
      RETURN TRUE;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN FALSE;
    END;
  ELSE
    RETURN TRUE; -- Allow other types for now
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate skip conditions (simple version)
CREATE OR REPLACE FUNCTION evaluate_skip_conditions(
  job_id UUID,
  question_id UUID,
  response_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_skip_conditions JSONB;
BEGIN
  -- Get skip conditions for the question
  SELECT skip_conditions INTO v_skip_conditions
  FROM stage_questions
  WHERE id = question_id;
  
  -- If no skip conditions, don't skip
  IF v_skip_conditions IS NULL OR v_skip_conditions = '{}' THEN
    RETURN FALSE;
  END IF;
  
  -- Simple skip condition evaluation - can be enhanced
  -- For now, just return false to never skip
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get status from stage (simple version)
CREATE OR REPLACE FUNCTION get_status_from_stage(
  stage_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_maps_to_status TEXT;
BEGIN
  SELECT maps_to_status INTO v_maps_to_status
  FROM job_stages
  WHERE id = stage_id;
  
  RETURN COALESCE(v_maps_to_status, 'active');
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate transition conditions (simple version)
CREATE OR REPLACE FUNCTION evaluate_transition_condition(
  condition_text TEXT,
  response_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Simple condition evaluation - can be enhanced
  -- For now, just do case-insensitive comparison
  RETURN UPPER(TRIM(condition_text)) = UPPER(TRIM(response_value));
END;
$$ LANGUAGE plpgsql;

-- Function to create tasks for stage (simple version)
CREATE OR REPLACE FUNCTION create_tasks_for_stage(
  job_id UUID,
  stage_id UUID,
  user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_tasks_created INTEGER := 0;
  v_template_record RECORD;
BEGIN
  -- Create tasks from templates for the new stage
  FOR v_template_record IN
    SELECT * FROM task_templates 
    WHERE stage_id = stage_id AND is_active = TRUE
  LOOP
    INSERT INTO job_tasks (
      job_id, template_id, title, description, 
      status, due_date, priority, created_by, created_at
    ) VALUES (
      job_id, v_template_record.id, v_template_record.title, v_template_record.description,
      'pending', NOW() + INTERVAL '1 day' * COALESCE(v_template_record.default_due_days, 7),
      COALESCE(v_template_record.priority, 'medium'), user_id, NOW()
    );
    
    v_tasks_created := v_tasks_created + 1;
  END LOOP;
  
  RETURN v_tasks_created;
  
EXCEPTION
  WHEN OTHERS THEN
    -- If task creation fails, don't fail the whole stage progression
    RAISE NOTICE 'Task creation failed: %', SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 2: MAIN FIX - CASE-INSENSITIVE STAGE PROGRESSION
-- =============================================================================

-- Enhanced stage progression function with case-insensitive transition evaluation
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
  v_debug_info JSONB;
BEGIN
  -- 1. Validate inputs
  IF p_job_id IS NULL OR p_question_id IS NULL OR p_response_value IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;
  
  RAISE NOTICE '🔄 Processing response: job_id=%, question_id=%, response_value="%"', 
    p_job_id, p_question_id, p_response_value;
  
  -- 2. Get job details
  SELECT * INTO v_job_record
  FROM jobs
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  v_current_stage_id := v_job_record.current_stage_id;
  RAISE NOTICE '📍 Current stage ID: %', v_current_stage_id;
  
  -- 3. Get question details
  SELECT * INTO v_question_record
  FROM stage_questions
  WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found: %', p_question_id;
  END IF;
  
  RAISE NOTICE '❓ Question belongs to stage: %', v_question_record.stage_id;
  
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
    RAISE NOTICE '🔄 Updated existing response';
  ELSE
    -- Insert new response
    INSERT INTO user_responses (
      job_id, question_id, response_value, response_metadata,
      responded_by, response_source, created_at
    ) VALUES (
      p_job_id, p_question_id, p_response_value, p_response_metadata,
      p_user_id, p_response_source, NOW()
    );
    RAISE NOTICE '➕ Inserted new response';
  END IF;
  
  -- 7. Check for conditional skip logic
  v_should_skip := evaluate_skip_conditions(p_job_id, p_question_id, p_response_value);
  
  -- 8. Skip processing if conditions met
  IF v_should_skip THEN
    RAISE NOTICE '⏭️  Response processing skipped due to conditions';
    RETURN jsonb_build_object(
      'success', true,
      'action', 'skipped',
      'message', 'Question skipped due to conditional logic',
      'current_stage_id', v_current_stage_id,
      'next_stage_id', v_current_stage_id,
      'stage_progressed', false
    );
  END IF;
  
  -- 9. Determine next stage with improved debugging and case-insensitive comparison
  RAISE NOTICE '🔍 Looking for transitions from stage % with response "%"', v_current_stage_id, p_response_value;
  
  -- First, let's see what transitions exist for this stage
  RAISE NOTICE '📋 Available transitions for stage %:', v_current_stage_id;
  FOR v_transition_record IN 
    SELECT id, to_stage_id, trigger_response, conditions, is_automatic
    FROM stage_transitions 
    WHERE from_stage_id = v_current_stage_id
  LOOP
    RAISE NOTICE '  ➡️  Transition ID % -> stage %, trigger="%", conditions=%, auto=%',
      v_transition_record.id, v_transition_record.to_stage_id, 
      v_transition_record.trigger_response, v_transition_record.conditions, 
      v_transition_record.is_automatic;
  END LOOP;
  
  -- Now find the matching transition with case-insensitive comparison
  -- 🔧 KEY FIX: CASE-INSENSITIVE COMPARISON
  SELECT * INTO v_transition_record
  FROM stage_transitions
  WHERE from_stage_id = v_current_stage_id
  AND (
    -- Case-insensitive comparison for trigger_response
    UPPER(TRIM(trigger_response)) = UPPER(TRIM(p_response_value))
    OR (
      conditions->>'condition' IS NOT NULL
      AND evaluate_transition_condition(conditions->>'condition', p_response_value)
    )
  )
  ORDER BY is_automatic DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Enhanced debugging information
    v_debug_info := jsonb_build_object(
      'current_stage_id', v_current_stage_id,
      'response_value', p_response_value,
      'response_upper', UPPER(TRIM(p_response_value)),
      'available_transitions', (
        SELECT jsonb_agg(jsonb_build_object(
          'to_stage_id', to_stage_id,
          'trigger_response', trigger_response,
          'trigger_upper', UPPER(TRIM(trigger_response)),
          'conditions', conditions,
          'is_automatic', is_automatic
        ))
        FROM stage_transitions 
        WHERE from_stage_id = v_current_stage_id
      )
    );
    
    RAISE NOTICE '❌ No transition found. Debug info: %', v_debug_info;
    
    -- No transition found, stay in current stage
    RETURN jsonb_build_object(
      'success', true,
      'action', 'no_transition',
      'message', 'No stage transition triggered',
      'current_stage_id', v_current_stage_id,
      'next_stage_id', v_current_stage_id,
      'stage_progressed', false,
      'debug_info', v_debug_info
    );
  END IF;
  
  v_next_stage_id := v_transition_record.to_stage_id;
  RAISE NOTICE '✅ Found matching transition: % -> %', v_current_stage_id, v_next_stage_id;
  
  -- 10. Calculate duration in previous stage
  SELECT EXTRACT(EPOCH FROM (NOW() - stage_entered_at)) / 3600 INTO v_duration_hours
  FROM jobs
  WHERE id = p_job_id;
  
  -- 11. Update job stage atomically
  UPDATE jobs
  SET 
    current_stage_id = v_next_stage_id,
    stage_entered_at = NOW(),
    status = get_status_from_stage(v_next_stage_id),
    updated_at = NOW()
  WHERE id = p_job_id;
  
  RAISE NOTICE '🎯 Updated job stage to %', v_next_stage_id;
  
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
    v_job_record.status, get_status_from_stage(v_next_stage_id),
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
  
  RAISE NOTICE '🎉 Stage progression completed successfully: % -> %', v_current_stage_id, v_next_stage_id;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with proper handling of null to_stage_id constraint
    RAISE NOTICE '💥 ERROR in stage progression: %', SQLERRM;
    
    INSERT INTO stage_audit_log (
      job_id, from_stage_id, to_stage_id, trigger_source, triggered_by,
      trigger_details, created_at
    ) VALUES (
      p_job_id, v_current_stage_id, v_current_stage_id, 'error', p_user_id,
      jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE), NOW()
    );
    
    RAISE EXCEPTION 'Stage progression failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 3: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION validate_response_format(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_skip_conditions(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_status_from_stage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_transition_condition(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tasks_for_stage(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_stage_response(UUID, UUID, TEXT, UUID, VARCHAR, JSONB) TO authenticated;

COMMIT;

-- =============================================================================
-- STEP 4: VERIFICATION QUERIES
-- =============================================================================

-- Test case-insensitive comparison
SELECT 
  'Test Results:' as verification,
  UPPER(TRIM('Yes')) as response_upper,
  UPPER(TRIM(' yes ')) as trigger_upper,
  UPPER(TRIM('Yes')) = UPPER(TRIM(' yes ')) as should_match_now;

-- Check function deployment
SELECT 
  'Function Status:' as status,
  proname as function_name,
  pronargs as argument_count
FROM pg_proc 
WHERE proname = 'process_stage_response';

-- Show available stage transitions for debugging
SELECT 
  'Available Transitions:' as info,
  st.from_stage_id,
  st.to_stage_id,
  st.trigger_response,
  st.is_automatic,
  js_from.name as from_stage_name,
  js_to.name as to_stage_name
FROM stage_transitions st
LEFT JOIN job_stages js_from ON st.from_stage_id = js_from.id
LEFT JOIN job_stages js_to ON st.to_stage_id = js_to.id
WHERE js_from.name LIKE '%Lead Qualification%' OR js_from.name LIKE '%1/12%';

-- =============================================================================
-- DEPLOYMENT COMPLETE!
-- =============================================================================
-- 
-- ✅ WHAT WAS FIXED:
--   • Case-insensitive comparison: "Yes" = "yes" = "YES" 
--   • Whitespace trimming: " Yes " = "Yes"
--   • Enhanced debugging with RAISE NOTICE statements
--   • Comprehensive error handling and logging
--   • Helper function fallbacks
--
-- 🧪 TEST YOUR FIX:
--   1. Edit a job in "1/12 Lead Qualification" stage
--   2. Answer "Yes" to "Have you qualified this lead as a viable opportunity?"
--   3. Click "Update Job"
--   4. Check logs for: "Stage progression completed successfully"
--   5. Verify job advanced to "2/12 Initial Client Meeting"
--
-- 🎯 EXPECTED LOG OUTPUT:
--   ✅ Stage progression result: {
--     "action": "stage_transition", 
--     "stage_progressed": true,
--     "next_stage_id": "...",
--     "message": "Stage transition completed successfully"
--   }
-- =============================================================================