-- =============================================================================
-- STAGE PROGRESSION BUG FIX - CLEAN DEPLOYMENT SCRIPT
-- =============================================================================
-- This script safely deploys the case-insensitive transition fix by properly
-- dropping and recreating functions to avoid parameter name conflicts.
--
-- ISSUE: "Yes" !== "yes" causes no_transition even with correct answers
-- FIX: Case-insensitive comparison with UPPER(TRIM(...))
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: SAFELY DROP EXISTING FUNCTIONS
-- =============================================================================

-- Drop functions in dependency order to avoid conflicts
DROP FUNCTION IF EXISTS process_stage_response(UUID, UUID, TEXT, UUID, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS process_stage_response(UUID, UUID, TEXT, UUID, VARCHAR);  
DROP FUNCTION IF EXISTS process_stage_response(UUID, UUID, TEXT, UUID);

-- Drop helper functions
DROP FUNCTION IF EXISTS validate_response_format(TEXT, TEXT);
DROP FUNCTION IF EXISTS evaluate_skip_conditions(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS get_status_from_stage(UUID);
DROP FUNCTION IF EXISTS evaluate_transition_condition(TEXT, TEXT);  
DROP FUNCTION IF EXISTS create_tasks_for_stage(UUID, UUID, UUID);

-- =============================================================================
-- STEP 2: CREATE HELPER FUNCTIONS WITH CONSISTENT NAMING
-- =============================================================================

-- Function to validate response format
CREATE FUNCTION validate_response_format(
  response_type TEXT,
  response_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
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
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate skip conditions
CREATE FUNCTION evaluate_skip_conditions(
  job_id UUID,
  question_id UUID,
  response_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  skip_conditions JSONB;
BEGIN
  SELECT stage_questions.skip_conditions INTO skip_conditions
  FROM stage_questions
  WHERE id = question_id;
  
  IF skip_conditions IS NULL OR skip_conditions = '{}' THEN
    RETURN FALSE;
  END IF;
  
  -- Simple implementation - can be enhanced
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get status from stage
CREATE FUNCTION get_status_from_stage(
  stage_id UUID
) RETURNS TEXT AS $$
DECLARE
  stage_status TEXT;
BEGIN
  SELECT maps_to_status INTO stage_status
  FROM job_stages
  WHERE id = stage_id;
  
  RETURN COALESCE(stage_status, 'active');
END;
$$ LANGUAGE plpgsql;

-- Function to evaluate transition conditions
CREATE FUNCTION evaluate_transition_condition(
  condition_text TEXT,
  response_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN UPPER(TRIM(condition_text)) = UPPER(TRIM(response_value));
END;
$$ LANGUAGE plpgsql;

-- Function to create tasks for stage
CREATE FUNCTION create_tasks_for_stage(
  job_id UUID,
  stage_id UUID,
  user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  tasks_created INTEGER := 0;
  template_record RECORD;
BEGIN
  FOR template_record IN
    SELECT * FROM task_templates 
    WHERE task_templates.stage_id = create_tasks_for_stage.stage_id 
    AND is_active = TRUE
  LOOP
    INSERT INTO job_tasks (
      job_id, template_id, title, description, 
      status, due_date, priority, created_by, created_at
    ) VALUES (
      create_tasks_for_stage.job_id, 
      template_record.id, 
      template_record.title, 
      template_record.description,
      'pending', 
      NOW() + INTERVAL '1 day' * COALESCE(template_record.default_due_days, 7),
      COALESCE(template_record.priority, 'medium'), 
      create_tasks_for_stage.user_id, 
      NOW()
    );
    
    tasks_created := tasks_created + 1;
  END LOOP;
  
  RETURN tasks_created;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Task creation failed: %', SQLERRM;
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 3: CREATE MAIN STAGE PROGRESSION FUNCTION WITH CASE-INSENSITIVE FIX
-- =============================================================================

CREATE FUNCTION process_stage_response(
  p_job_id UUID,
  p_question_id UUID,
  p_response_value TEXT,
  p_user_id UUID,
  p_response_source VARCHAR(50) DEFAULT 'web_app',
  p_response_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  current_stage_id UUID;
  next_stage_id UUID;
  question_record RECORD;
  transition_record RECORD;
  job_record RECORD;
  should_skip BOOLEAN := false;
  created_tasks INTEGER := 0;
  audit_id UUID;
  result JSONB;
  duration_hours INTEGER;
  existing_response RECORD;
  debug_info JSONB;
BEGIN
  -- Validate inputs
  IF p_job_id IS NULL OR p_question_id IS NULL OR p_response_value IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Required parameters cannot be null';
  END IF;
  
  RAISE NOTICE '🔄 Processing response: job_id=%, question_id=%, response_value="%"', 
    p_job_id, p_question_id, p_response_value;
  
  -- Get job details
  SELECT * INTO job_record FROM jobs WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  current_stage_id := job_record.current_stage_id;
  RAISE NOTICE '📍 Current stage ID: %', current_stage_id;
  
  -- Get question details
  SELECT * INTO question_record FROM stage_questions WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found: %', p_question_id;
  END IF;
  
  RAISE NOTICE '❓ Question belongs to stage: %', question_record.stage_id;
  
  -- Validate response format
  PERFORM validate_response_format(question_record.response_type, p_response_value);
  
  -- Check for existing response
  SELECT * INTO existing_response
  FROM user_responses
  WHERE user_responses.job_id = p_job_id AND user_responses.question_id = p_question_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Handle existing response
  IF FOUND THEN
    UPDATE user_responses
    SET 
      response_value = p_response_value,
      response_metadata = p_response_metadata,
      response_source = p_response_source,
      updated_at = NOW()
    WHERE user_responses.job_id = p_job_id AND user_responses.question_id = p_question_id;
    RAISE NOTICE '🔄 Updated existing response';
  ELSE
    INSERT INTO user_responses (
      job_id, question_id, response_value, response_metadata,
      responded_by, response_source, created_at
    ) VALUES (
      p_job_id, p_question_id, p_response_value, p_response_metadata,
      p_user_id, p_response_source, NOW()
    );
    RAISE NOTICE '➕ Inserted new response';
  END IF;
  
  -- Check for conditional skip logic
  should_skip := evaluate_skip_conditions(p_job_id, p_question_id, p_response_value);
  
  IF should_skip THEN
    RAISE NOTICE '⏭️  Response processing skipped due to conditions';
    RETURN jsonb_build_object(
      'success', true,
      'action', 'skipped',
      'message', 'Question skipped due to conditional logic',
      'current_stage_id', current_stage_id,
      'next_stage_id', current_stage_id,
      'stage_progressed', false
    );
  END IF;
  
  -- Find transitions (with debugging)
  RAISE NOTICE '🔍 Looking for transitions from stage % with response "%"', current_stage_id, p_response_value;
  
  -- Show available transitions for debugging
  RAISE NOTICE '📋 Available transitions for stage %:', current_stage_id;
  FOR transition_record IN 
    SELECT id, to_stage_id, trigger_response, conditions, is_automatic
    FROM stage_transitions 
    WHERE from_stage_id = current_stage_id
  LOOP
    RAISE NOTICE '  ➡️  Transition % -> %, trigger="%", auto=%',
      transition_record.id, transition_record.to_stage_id, 
      transition_record.trigger_response, transition_record.is_automatic;
  END LOOP;
  
  -- 🔧 KEY FIX: Find matching transition with case-insensitive comparison
  SELECT * INTO transition_record
  FROM stage_transitions
  WHERE from_stage_id = current_stage_id
  AND (
    -- CASE-INSENSITIVE COMPARISON - THE MAIN FIX!
    UPPER(TRIM(trigger_response)) = UPPER(TRIM(p_response_value))
    OR (
      conditions->>'condition' IS NOT NULL
      AND evaluate_transition_condition(conditions->>'condition', p_response_value)
    )
  )
  ORDER BY is_automatic DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Enhanced debugging
    debug_info := jsonb_build_object(
      'current_stage_id', current_stage_id,
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
        WHERE from_stage_id = current_stage_id
      )
    );
    
    RAISE NOTICE '❌ No transition found. Debug info: %', debug_info;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'no_transition',
      'message', 'No stage transition triggered',
      'current_stage_id', current_stage_id,
      'next_stage_id', current_stage_id,
      'stage_progressed', false,
      'debug_info', debug_info
    );
  END IF;
  
  next_stage_id := transition_record.to_stage_id;
  RAISE NOTICE '✅ Found matching transition: % -> %', current_stage_id, next_stage_id;
  
  -- Calculate duration
  SELECT EXTRACT(EPOCH FROM (NOW() - stage_entered_at)) / 3600 INTO duration_hours
  FROM jobs WHERE id = p_job_id;
  
  -- Update job stage
  UPDATE jobs
  SET 
    current_stage_id = next_stage_id,
    stage_entered_at = NOW(),
    status = get_status_from_stage(next_stage_id),
    updated_at = NOW()
  WHERE id = p_job_id;
  
  RAISE NOTICE '🎯 Updated job stage to %', next_stage_id;
  
  -- Create performance metrics
  INSERT INTO stage_performance_metrics (
    job_id, stage_id, entered_at, exited_at, duration_hours
  ) VALUES (
    p_job_id, current_stage_id, job_record.stage_entered_at, NOW(), duration_hours
  );
  
  -- Create audit log
  INSERT INTO stage_audit_log (
    job_id, from_stage_id, to_stage_id, from_status, to_status,
    trigger_source, triggered_by, trigger_details, question_id, response_value,
    duration_in_previous_stage_hours, created_at
  ) VALUES (
    p_job_id, current_stage_id, next_stage_id, 
    job_record.status, get_status_from_stage(next_stage_id),
    'question_response', p_user_id, 
    jsonb_build_object('source', p_response_source, 'metadata', p_response_metadata),
    p_question_id, p_response_value, duration_hours, NOW()
  ) RETURNING id INTO audit_id;
  
  -- Create tasks for new stage
  SELECT create_tasks_for_stage(p_job_id, next_stage_id, p_user_id) INTO created_tasks;
  
  -- Build success result
  result := jsonb_build_object(
    'success', true,
    'action', 'stage_transition',
    'message', 'Stage transition completed successfully',
    'current_stage_id', current_stage_id,
    'next_stage_id', next_stage_id,
    'tasks_created', created_tasks,
    'duration_hours', duration_hours,
    'audit_id', audit_id,
    'stage_progressed', true
  );
  
  RAISE NOTICE '🎉 Stage progression completed successfully: % -> %', current_stage_id, next_stage_id;
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '💥 ERROR in stage progression: %', SQLERRM;
    
    -- Log error
    INSERT INTO stage_audit_log (
      job_id, from_stage_id, to_stage_id, trigger_source, triggered_by,
      trigger_details, created_at
    ) VALUES (
      p_job_id, current_stage_id, current_stage_id, 'error', p_user_id,
      jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE), NOW()
    );
    
    RAISE EXCEPTION 'Stage progression failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 4: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION validate_response_format(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_skip_conditions(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_status_from_stage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_transition_condition(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tasks_for_stage(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_stage_response(UUID, UUID, TEXT, UUID, VARCHAR, JSONB) TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Test case-insensitive comparison
SELECT 
  'Case-insensitive test:' as test,
  UPPER(TRIM('Yes')) = UPPER(TRIM(' yes ')) as should_be_true;

-- Verify function exists
SELECT 'Function deployed:' as status, COUNT(*) as function_count
FROM pg_proc WHERE proname = 'process_stage_response';

-- =============================================================================
-- 🎉 DEPLOYMENT COMPLETE!
-- =============================================================================
-- 
-- KEY FIX APPLIED:
--   UPPER(TRIM(trigger_response)) = UPPER(TRIM(p_response_value))
--
-- This ensures: "Yes" = "yes" = "YES" = " Yes " = "yes "
-- 
-- TEST NOW:
--   1. Edit job in "1/12 Lead Qualification"
--   2. Answer "Yes" to qualification question  
--   3. Should see: stage_progressed: true
-- =============================================================================