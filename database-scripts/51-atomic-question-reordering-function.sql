-- Atomic Question Reordering Function
-- This function safely reorders stage questions without constraint violations

-- Drop the function if it exists
DROP FUNCTION IF EXISTS reorder_stage_questions(UUID, JSONB);

-- Create the atomic reordering function
CREATE OR REPLACE FUNCTION reorder_stage_questions(
  p_stage_id UUID,
  p_question_updates JSONB
) RETURNS JSONB AS $$
DECLARE
  temp_offset INTEGER := 10000;
  update_record RECORD;
  result_questions JSONB := '[]'::JSONB;
  updated_question RECORD;
BEGIN
  -- Validate inputs
  IF p_stage_id IS NULL THEN
    RAISE EXCEPTION 'Stage ID cannot be null';
  END IF;

  IF p_question_updates IS NULL OR jsonb_array_length(p_question_updates) = 0 THEN
    RAISE EXCEPTION 'Question updates array cannot be null or empty';
  END IF;

  -- Start transaction (implicit in function)
  RAISE NOTICE 'Starting atomic reorder for stage % with % questions', 
    p_stage_id, jsonb_array_length(p_question_updates);

  -- PHASE 1: Move all questions to temporary sequence_order values
  RAISE NOTICE 'Phase 1: Moving to temporary sequence orders...';
  
  FOR update_record IN 
    SELECT 
      (value->>'question_id')::UUID as question_id,
      (value->>'new_sequence_order')::INTEGER as new_sequence_order
    FROM jsonb_array_elements(p_question_updates)
  LOOP
    UPDATE stage_questions 
    SET sequence_order = update_record.new_sequence_order + temp_offset
    WHERE id = update_record.question_id 
      AND stage_id = p_stage_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Question % not found in stage %', 
        update_record.question_id, p_stage_id;
    END IF;
  END LOOP;

  -- PHASE 2: Set final sequence_order values
  RAISE NOTICE 'Phase 2: Setting final sequence orders...';
  
  FOR update_record IN 
    SELECT 
      (value->>'question_id')::UUID as question_id,
      (value->>'new_sequence_order')::INTEGER as new_sequence_order
    FROM jsonb_array_elements(p_question_updates)
  LOOP
    UPDATE stage_questions 
    SET sequence_order = update_record.new_sequence_order
    WHERE id = update_record.question_id 
      AND stage_id = p_stage_id
    RETURNING * INTO updated_question;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Question % not found during final update in stage %', 
        update_record.question_id, p_stage_id;
    END IF;

    -- Add to result array
    result_questions := result_questions || jsonb_build_object(
      'id', updated_question.id,
      'stage_id', updated_question.stage_id,
      'question_text', updated_question.question_text,
      'response_type', updated_question.response_type,
      'sequence_order', updated_question.sequence_order,
      'help_text', updated_question.help_text,
      'is_required', updated_question.is_required
    );
  END LOOP;

  RAISE NOTICE 'Successfully reordered % questions atomically', 
    jsonb_array_length(result_questions);

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', jsonb_array_length(result_questions),
    'questions', result_questions
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Atomic reorder failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION reorder_stage_questions(UUID, JSONB) TO service_role;

-- Test the function (optional)
-- SELECT reorder_stage_questions(
--   'test-stage-id'::UUID,
--   '[{"question_id": "test-q1", "new_sequence_order": 2}, {"question_id": "test-q2", "new_sequence_order": 1}]'::JSONB
-- );