-- Helper functions for stage progression - Fallbacks if missing
-- These are simple implementations to ensure stage progression works

BEGIN;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_response_format(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_skip_conditions(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_status_from_stage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_transition_condition(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_tasks_for_stage(UUID, UUID, UUID) TO authenticated;

COMMIT;