-- Core Progression Engine Functions
-- Comprehensive functions for question-driven stage progression with safeguards

BEGIN;

-- =============================================
-- 1. CORE PROGRESSION FUNCTIONS
-- =============================================

-- Enhanced stage progression with comprehensive validation
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
  
  -- 3. Get question details
  SELECT * INTO v_question_record
  FROM stage_questions
  WHERE id = p_question_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found: %', p_question_id;
  END IF;
  
  -- 4. Validate response format
  PERFORM validate_response_format(v_question_record.response_type, p_response_value);
  
  -- 5. Check for conditional skip logic
  v_should_skip := evaluate_skip_conditions(p_job_id, p_question_id, p_response_value);
  
  -- 6. Record the response
  INSERT INTO user_responses (
    job_id, question_id, response_value, response_metadata,
    responded_by, response_source, created_at
  ) VALUES (
    p_job_id, p_question_id, p_response_value, p_response_metadata,
    p_user_id, p_response_source, NOW()
  );
  
  -- 7. Skip processing if conditions met
  IF v_should_skip THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', 'skipped',
      'message', 'Question skipped due to conditional logic',
      'current_stage_id', v_current_stage_id,
      'next_stage_id', v_current_stage_id
    );
  END IF;
  
  -- 8. Determine next stage
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
      'next_stage_id', v_current_stage_id
    );
  END IF;
  
  v_next_stage_id := v_transition_record.to_stage_id;
  
  -- 9. Calculate duration in previous stage
  SELECT EXTRACT(EPOCH FROM (NOW() - stage_entered_at)) / 3600 INTO v_duration_hours
  FROM jobs
  WHERE id = p_job_id;
  
  -- 10. Update job stage atomically
  UPDATE jobs
  SET 
    current_stage_id = v_next_stage_id,
    stage_entered_at = NOW(),
    status = get_status_from_stage(v_next_stage_id),
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- 11. Create performance metrics record
  INSERT INTO stage_performance_metrics (
    job_id, stage_id, entered_at, exited_at, duration_hours
  ) VALUES (
    p_job_id, v_current_stage_id, v_job_record.stage_entered_at, NOW(), v_duration_hours
  );
  
  -- 12. Create audit log entry
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
  
  -- 13. Create tasks for new stage
  SELECT create_tasks_for_stage(p_job_id, v_next_stage_id, p_user_id) INTO v_created_tasks;
  
  -- 14. Build result
  v_result := jsonb_build_object(
    'success', true,
    'action', 'stage_transition',
    'message', 'Stage transition completed successfully',
    'current_stage_id', v_current_stage_id,
    'next_stage_id', v_next_stage_id,
    'tasks_created', v_created_tasks,
    'duration_hours', v_duration_hours,
    'audit_id', v_audit_id
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    INSERT INTO stage_audit_log (
      job_id, from_stage_id, to_stage_id, trigger_source, triggered_by,
      trigger_details, created_at
    ) VALUES (
      p_job_id, v_current_stage_id, NULL, 'error', p_user_id,
      jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE), NOW()
    );
    
    RAISE EXCEPTION 'Stage progression failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin override function with full audit trail
CREATE OR REPLACE FUNCTION admin_override_stage(
  p_job_id UUID,
  p_target_stage_id UUID,
  p_admin_id UUID,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_current_stage_id UUID;
  v_job_record RECORD;
  v_admin_record RECORD;
  v_duration_hours INTEGER;
  v_audit_id UUID;
BEGIN
  -- 1. Validate admin permissions
  SELECT * INTO v_admin_record
  FROM users
  WHERE id = p_admin_id;
  
  IF NOT FOUND OR v_admin_record.role NOT IN ('owner', 'site_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions for stage override';
  END IF;
  
  -- 2. Get job details
  SELECT * INTO v_job_record
  FROM jobs
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  v_current_stage_id := v_job_record.current_stage_id;
  
  -- 3. Validate target stage exists
  IF NOT EXISTS (SELECT 1 FROM job_stages WHERE id = p_target_stage_id) THEN
    RAISE EXCEPTION 'Target stage not found: %', p_target_stage_id;
  END IF;
  
  -- 4. Calculate duration in previous stage
  SELECT EXTRACT(EPOCH FROM (NOW() - stage_entered_at)) / 3600 INTO v_duration_hours
  FROM jobs
  WHERE id = p_job_id;
  
  -- 5. Update job stage
  UPDATE jobs
  SET 
    current_stage_id = p_target_stage_id,
    stage_entered_at = NOW(),
    status = get_status_from_stage(p_target_stage_id),
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- 6. Create performance metrics if moving from a stage
  IF v_current_stage_id IS NOT NULL THEN
    INSERT INTO stage_performance_metrics (
      job_id, stage_id, entered_at, exited_at, duration_hours
    ) VALUES (
      p_job_id, v_current_stage_id, v_job_record.stage_entered_at, NOW(), v_duration_hours
    );
  END IF;
  
  -- 7. Create audit log entry
  INSERT INTO stage_audit_log (
    job_id, from_stage_id, to_stage_id, from_status, to_status,
    trigger_source, triggered_by, trigger_details,
    duration_in_previous_stage_hours, created_at
  ) VALUES (
    p_job_id, v_current_stage_id, p_target_stage_id,
    v_job_record.status, get_status_from_stage(p_target_stage_id),
    'admin_override', p_admin_id,
    jsonb_build_object('reason', p_reason, 'admin_email', v_admin_record.email),
    v_duration_hours, NOW()
  ) RETURNING id INTO v_audit_id;
  
  -- 8. Create tasks for new stage
  PERFORM create_tasks_for_stage(p_job_id, p_target_stage_id, p_admin_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'admin_override',
    'message', 'Stage override completed successfully',
    'from_stage_id', v_current_stage_id,
    'to_stage_id', p_target_stage_id,
    'audit_id', v_audit_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Admin override failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. HELPER FUNCTIONS
-- =============================================

-- Validate response format based on question type
CREATE OR REPLACE FUNCTION validate_response_format(
  p_response_type VARCHAR(20),
  p_response_value TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  CASE p_response_type
    WHEN 'yes_no' THEN
      IF p_response_value NOT IN ('Yes', 'No') THEN
        RAISE EXCEPTION 'Invalid yes/no response: %', p_response_value;
      END IF;
    
    WHEN 'number' THEN
      IF NOT (p_response_value ~ '^[0-9]+(\.[0-9]+)?$') THEN
        RAISE EXCEPTION 'Invalid number format: %', p_response_value;
      END IF;
    
    WHEN 'date' THEN
      BEGIN
        PERFORM p_response_value::DATE;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE EXCEPTION 'Invalid date format: %', p_response_value;
      END;
    
    WHEN 'file_upload' THEN
      IF LENGTH(p_response_value) < 1 THEN
        RAISE EXCEPTION 'File upload response cannot be empty';
      END IF;
    
    ELSE
      -- text and multiple_choice don't need validation
      NULL;
  END CASE;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Evaluate skip conditions
CREATE OR REPLACE FUNCTION evaluate_skip_conditions(
  p_job_id UUID,
  p_question_id UUID,
  p_response_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_question_record RECORD;
  v_job_record RECORD;
  v_condition JSONB;
  v_prev_response RECORD;
BEGIN
  -- Get question with skip conditions
  SELECT * INTO v_question_record
  FROM stage_questions
  WHERE id = p_question_id;
  
  -- No skip conditions defined
  IF v_question_record.skip_conditions IS NULL OR v_question_record.skip_conditions = '{}' THEN
    RETURN FALSE;
  END IF;
  
  -- Get job details
  SELECT * INTO v_job_record
  FROM jobs
  WHERE id = p_job_id;
  
  -- Check job type-based skipping
  IF v_question_record.skip_conditions ? 'job_types' THEN
    IF v_job_record.job_type = ANY(
      SELECT jsonb_array_elements_text(v_question_record.skip_conditions->'job_types')
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Check previous response-based skipping
  IF v_question_record.skip_conditions ? 'previous_responses' THEN
    FOR v_condition IN SELECT jsonb_array_elements(v_question_record.skip_conditions->'previous_responses') LOOP
      SELECT * INTO v_prev_response
      FROM user_responses
      WHERE job_id = p_job_id
      AND question_id = (v_condition->>'question_id')::UUID
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF FOUND AND v_prev_response.response_value = (v_condition->>'response_value') THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Evaluate transition conditions
CREATE OR REPLACE FUNCTION evaluate_transition_condition(
  p_condition TEXT,
  p_response_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_numeric_response NUMERIC;
  v_condition_parts TEXT[];
  v_operator TEXT;
  v_threshold NUMERIC;
BEGIN
  -- Parse condition like ">=90" or "<50"
  IF p_condition ~ '^[><=]+[0-9]+(\.[0-9]+)?$' THEN
    -- Extract operator and threshold
    v_condition_parts := regexp_split_to_array(p_condition, '[0-9]');
    v_operator := v_condition_parts[1];
    v_threshold := substring(p_condition from '[0-9]+(\.[0-9]+)?')::NUMERIC;
    
    -- Convert response to numeric
    BEGIN
      v_numeric_response := p_response_value::NUMERIC;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN FALSE;
    END;
    
    -- Evaluate condition
    CASE v_operator
      WHEN '>=' THEN RETURN v_numeric_response >= v_threshold;
      WHEN '>' THEN RETURN v_numeric_response > v_threshold;
      WHEN '<=' THEN RETURN v_numeric_response <= v_threshold;
      WHEN '<' THEN RETURN v_numeric_response < v_threshold;
      WHEN '=' THEN RETURN v_numeric_response = v_threshold;
      ELSE RETURN FALSE;
    END CASE;
  END IF;
  
  -- String comparison
  RETURN p_response_value = p_condition;
END;
$$ LANGUAGE plpgsql;

-- Get status from stage mapping
CREATE OR REPLACE FUNCTION get_status_from_stage(
  p_stage_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT maps_to_status INTO v_status
  FROM job_stages
  WHERE id = p_stage_id;
  
  RETURN COALESCE(v_status, 'planning');
END;
$$ LANGUAGE plpgsql;

-- Create tasks for stage
CREATE OR REPLACE FUNCTION create_tasks_for_stage(
  p_job_id UUID,
  p_stage_id UUID,
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_template_record RECORD;
  v_task_id UUID;
  v_created_count INTEGER := 0;
  v_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get all task templates for this stage
  FOR v_template_record IN
    SELECT * FROM task_templates WHERE stage_id = p_stage_id
  LOOP
    -- Calculate due date
    v_due_date := CASE
      WHEN v_template_record.due_date_offset_hours > 0 THEN
        NOW() + (v_template_record.due_date_offset_hours * INTERVAL '1 hour')
      ELSE
        NULL
    END;
    
    -- Create task
    INSERT INTO job_tasks (
      job_id, template_id, title, description, subtasks,
      assigned_to, due_date, status, created_at, updated_at
    ) VALUES (
      p_job_id, v_template_record.id, v_template_record.title,
      v_template_record.description, v_template_record.subtasks,
      get_assigned_user(p_job_id, v_template_record.auto_assign_to, p_user_id),
      v_due_date, 'pending', NOW(), NOW()
    ) RETURNING id INTO v_task_id;
    
    v_created_count := v_created_count + 1;
  END LOOP;
  
  RETURN v_created_count;
END;
$$ LANGUAGE plpgsql;

-- Get assigned user for task
CREATE OR REPLACE FUNCTION get_assigned_user(
  p_job_id UUID,
  p_auto_assign_to VARCHAR(50),
  p_creator_id UUID
) RETURNS UUID AS $$
DECLARE
  v_assigned_user UUID;
BEGIN
  CASE p_auto_assign_to
    WHEN 'creator' THEN
      RETURN p_creator_id;
    
    WHEN 'foreman' THEN
      SELECT foreman_id INTO v_assigned_user
      FROM jobs
      WHERE id = p_job_id;
      
      RETURN COALESCE(v_assigned_user, p_creator_id);
    
    WHEN 'admin' THEN
      SELECT id INTO v_assigned_user
      FROM users
      WHERE role IN ('owner', 'site_admin')
      AND company_id = (SELECT company_id FROM jobs WHERE id = p_job_id)
      ORDER BY created_at ASC
      LIMIT 1;
      
      RETURN COALESCE(v_assigned_user, p_creator_id);
    
    ELSE
      RETURN p_creator_id;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. REPORTING AND ANALYTICS FUNCTIONS
-- =============================================

-- Get stage performance report
CREATE OR REPLACE FUNCTION get_stage_performance_report(
  p_company_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
) RETURNS TABLE (
  stage_name VARCHAR(100),
  total_entries BIGINT,
  avg_duration_hours NUMERIC,
  median_duration_hours NUMERIC,
  avg_tasks_completed NUMERIC,
  avg_tasks_overdue NUMERIC,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    js.name as stage_name,
    COUNT(*) as total_entries,
    AVG(spm.duration_hours) as avg_duration_hours,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY spm.duration_hours) as median_duration_hours,
    AVG(spm.tasks_completed) as avg_tasks_completed,
    AVG(spm.tasks_overdue) as avg_tasks_overdue,
    AVG(CASE WHEN spm.conversion_successful THEN 1.0 ELSE 0.0 END) as conversion_rate
  FROM stage_performance_metrics spm
  JOIN job_stages js ON spm.stage_id = js.id
  JOIN jobs j ON spm.job_id = j.id
  WHERE j.company_id = p_company_id
  AND (p_date_from IS NULL OR spm.created_at >= p_date_from)
  AND (p_date_to IS NULL OR spm.created_at <= p_date_to)
  GROUP BY js.id, js.name, js.sequence_order
  ORDER BY js.sequence_order;
END;
$$ LANGUAGE plpgsql;

-- Check SLA violations
CREATE OR REPLACE FUNCTION check_sla_violations(
  p_company_id UUID DEFAULT NULL
) RETURNS TABLE (
  task_id UUID,
  job_id UUID,
  task_title VARCHAR(200),
  sla_hours INTEGER,
  hours_overdue NUMERIC,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jt.id as task_id,
    jt.job_id,
    jt.title as task_title,
    tt.sla_hours,
    EXTRACT(EPOCH FROM (NOW() - jt.created_at)) / 3600 - tt.sla_hours as hours_overdue,
    CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - jt.created_at)) / 3600 - tt.sla_hours > 48 THEN 'critical'
      WHEN EXTRACT(EPOCH FROM (NOW() - jt.created_at)) / 3600 - tt.sla_hours > 24 THEN 'high'
      WHEN EXTRACT(EPOCH FROM (NOW() - jt.created_at)) / 3600 - tt.sla_hours > 8 THEN 'medium'
      ELSE 'low'
    END as severity
  FROM job_tasks jt
  JOIN task_templates tt ON jt.template_id = tt.id
  JOIN jobs j ON jt.job_id = j.id
  WHERE jt.status IN ('pending', 'in_progress')
  AND tt.sla_hours IS NOT NULL
  AND jt.created_at + (tt.sla_hours * INTERVAL '1 hour') < NOW()
  AND (p_company_id IS NULL OR j.company_id = p_company_id)
  ORDER BY hours_overdue DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_stage_response(UUID, UUID, TEXT, UUID, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_override_stage(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_stage_performance_report(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION check_sla_violations(UUID) TO authenticated;

COMMIT;

-- =============================================
-- 4. VERIFICATION
-- =============================================

-- Test function creation
SELECT 
  proname as function_name,
  pronargs as argument_count,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN (
  'process_stage_response',
  'admin_override_stage',
  'get_stage_performance_report',
  'check_sla_violations'
)
ORDER BY proname;