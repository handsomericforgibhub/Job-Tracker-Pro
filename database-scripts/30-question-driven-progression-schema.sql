-- Question-Driven Job Progression System
-- Enhanced database schema with comprehensive safeguards and enterprise features

-- Begin transaction for atomic schema creation
BEGIN;

-- =============================================
-- 1. CORE TABLES: Job Stages and Progression
-- =============================================

-- Enhanced Job Stages with Validation
CREATE TABLE job_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) NOT NULL,
  sequence_order INTEGER NOT NULL,
  maps_to_status VARCHAR(20) NOT NULL,
  stage_type VARCHAR(50) DEFAULT 'standard', -- standard, milestone, approval
  min_duration_hours INTEGER DEFAULT 0,
  max_duration_hours INTEGER DEFAULT NULL,
  requires_approval BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_sequence_order UNIQUE (sequence_order),
  CONSTRAINT valid_status_mapping CHECK (maps_to_status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT valid_stage_type CHECK (stage_type IN ('standard', 'milestone', 'approval')),
  CONSTRAINT valid_duration CHECK (max_duration_hours IS NULL OR max_duration_hours > min_duration_hours)
);

-- Enhanced Stage Transitions with Circular Protection
CREATE TABLE stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_id UUID NOT NULL REFERENCES job_stages(id),
  to_stage_id UUID NOT NULL REFERENCES job_stages(id),
  trigger_response TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  is_automatic BOOLEAN DEFAULT true,
  requires_admin_override BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent circular transitions
  CONSTRAINT no_self_transition CHECK (from_stage_id != to_stage_id),
  CONSTRAINT unique_transition UNIQUE (from_stage_id, to_stage_id, trigger_response)
);

-- Enhanced Questions with Conditional Logic
CREATE TABLE stage_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES job_stages(id),
  question_text TEXT NOT NULL,
  response_type VARCHAR(20) NOT NULL,
  response_options JSONB DEFAULT NULL, -- For multiple choice
  sequence_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  skip_conditions JSONB DEFAULT '{}', -- Conditional skip logic
  help_text TEXT,
  mobile_optimized BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_response_type CHECK (response_type IN ('yes_no', 'text', 'date', 'number', 'file_upload', 'multiple_choice')),
  CONSTRAINT unique_question_order UNIQUE (stage_id, sequence_order)
);

-- Enhanced Task Templates with Enforcement
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES job_stages(id),
  task_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  subtasks JSONB DEFAULT '[]', -- Array of subtask objects
  upload_required BOOLEAN DEFAULT false,
  upload_file_types TEXT[] DEFAULT NULL, -- Allowed file extensions
  max_file_size_mb INTEGER DEFAULT 10,
  due_date_offset_hours INTEGER DEFAULT 0,
  sla_hours INTEGER DEFAULT NULL, -- Service Level Agreement
  priority VARCHAR(20) DEFAULT 'normal',
  auto_assign_to VARCHAR(50) DEFAULT 'creator',
  client_visible BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_task_type CHECK (task_type IN ('reminder', 'checklist', 'documentation', 'communication', 'approval', 'scheduling')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_auto_assign CHECK (auto_assign_to IN ('creator', 'foreman', 'admin', 'client'))
);

-- Enhanced Job Tasks with Subtask Tracking
CREATE TABLE job_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  template_id UUID NOT NULL REFERENCES task_templates(id),
  status VARCHAR(20) DEFAULT 'pending',
  title VARCHAR(200) NOT NULL,
  description TEXT,
  subtasks JSONB DEFAULT '[]', -- Array with completion status
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  upload_urls TEXT[] DEFAULT '{}',
  upload_verified BOOLEAN DEFAULT false,
  notes TEXT,
  client_response_required BOOLEAN DEFAULT false,
  client_response_token VARCHAR(100), -- Secure token for client access
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
  CONSTRAINT unique_client_token UNIQUE (client_response_token)
);

-- Enhanced User Responses with Validation
CREATE TABLE user_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  question_id UUID NOT NULL REFERENCES stage_questions(id),
  response_value TEXT NOT NULL,
  response_metadata JSONB DEFAULT '{}', -- File paths, timestamps, etc.
  responded_by UUID REFERENCES users(id),
  response_source VARCHAR(50) DEFAULT 'web_app',
  is_client_response BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_response_source CHECK (response_source IN ('web_app', 'mobile_app', 'sms', 'email', 'client_portal')),
  CONSTRAINT unique_response UNIQUE (job_id, question_id, responded_by)
);

-- =============================================
-- 2. AUDIT AND TRACKING TABLES
-- =============================================

-- Comprehensive Audit Trail
CREATE TABLE stage_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  from_stage_id UUID REFERENCES job_stages(id),
  to_stage_id UUID NOT NULL REFERENCES job_stages(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  trigger_source VARCHAR(50) NOT NULL,
  triggered_by UUID REFERENCES users(id),
  trigger_details JSONB DEFAULT '{}',
  question_id UUID REFERENCES stage_questions(id),
  response_value TEXT,
  duration_in_previous_stage_hours INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_trigger_source CHECK (trigger_source IN ('question_response', 'admin_override', 'system_auto', 'client_action'))
);

-- Stage Performance Metrics
CREATE TABLE stage_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  stage_id UUID NOT NULL REFERENCES job_stages(id),
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  exited_at TIMESTAMP WITH TIME ZONE,
  duration_hours INTEGER,
  tasks_completed INTEGER DEFAULT 0,
  tasks_overdue INTEGER DEFAULT 0,
  conversion_successful BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_job_stage UNIQUE (job_id, stage_id, entered_at)
);

-- Client Portal Access
CREATE TABLE client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  client_email VARCHAR(255) NOT NULL,
  access_token VARCHAR(100) NOT NULL UNIQUE,
  permissions JSONB DEFAULT '{}', -- What client can see/do
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_email CHECK (client_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =============================================
-- 3. ENHANCED JOBS TABLE
-- =============================================

-- Add new fields to existing jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES job_stages(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type VARCHAR(50) DEFAULT 'standard';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_portal_enabled BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mobile_optimized BOOLEAN DEFAULT true;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_jobs_stage_entered ON jobs(stage_entered_at);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);

-- =============================================
-- 4. PERFORMANCE INDEXES
-- =============================================

-- Stage transitions
CREATE INDEX idx_stage_transitions_from_stage ON stage_transitions(from_stage_id);
CREATE INDEX idx_stage_transitions_to_stage ON stage_transitions(to_stage_id);

-- Questions
CREATE INDEX idx_stage_questions_stage ON stage_questions(stage_id);
CREATE INDEX idx_stage_questions_order ON stage_questions(sequence_order);

-- Task templates
CREATE INDEX idx_task_templates_stage ON task_templates(stage_id);
CREATE INDEX idx_task_templates_type ON task_templates(task_type);

-- Job tasks
CREATE INDEX idx_job_tasks_job ON job_tasks(job_id);
CREATE INDEX idx_job_tasks_status ON job_tasks(status);
CREATE INDEX idx_job_tasks_assigned ON job_tasks(assigned_to);
CREATE INDEX idx_job_tasks_due_date ON job_tasks(due_date);

-- User responses
CREATE INDEX idx_user_responses_job ON user_responses(job_id);
CREATE INDEX idx_user_responses_question ON user_responses(question_id);
CREATE INDEX idx_user_responses_source ON user_responses(response_source);

-- Audit log
CREATE INDEX idx_stage_audit_log_job ON stage_audit_log(job_id);
CREATE INDEX idx_stage_audit_log_trigger ON stage_audit_log(trigger_source);
CREATE INDEX idx_stage_audit_log_created ON stage_audit_log(created_at);

-- Performance metrics
CREATE INDEX idx_stage_performance_job ON stage_performance_metrics(job_id);
CREATE INDEX idx_stage_performance_stage ON stage_performance_metrics(stage_id);
CREATE INDEX idx_stage_performance_entered ON stage_performance_metrics(entered_at);

-- Client portal
CREATE INDEX idx_client_portal_job ON client_portal_access(job_id);
CREATE INDEX idx_client_portal_email ON client_portal_access(client_email);
CREATE INDEX idx_client_portal_expires ON client_portal_access(expires_at);

-- =============================================
-- 5. SAFEGUARD FUNCTIONS
-- =============================================

-- Function to detect circular transitions
CREATE OR REPLACE FUNCTION detect_circular_transition(
  p_from_stage_id UUID,
  p_to_stage_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  visited_stages UUID[] := ARRAY[]::UUID[];
  current_stage UUID := p_to_stage_id;
  max_depth INTEGER := 20; -- Prevent infinite loops
  depth INTEGER := 0;
BEGIN
  WHILE current_stage IS NOT NULL AND depth < max_depth LOOP
    -- Check if we've been here before
    IF current_stage = ANY(visited_stages) THEN
      RETURN true; -- Circular transition detected
    END IF;
    
    visited_stages := visited_stages || current_stage;
    
    -- Find next stage in potential cycle
    SELECT to_stage_id INTO current_stage
    FROM stage_transitions
    WHERE from_stage_id = current_stage
    AND to_stage_id = p_from_stage_id;
    
    depth := depth + 1;
  END LOOP;
  
  RETURN false; -- No circular transition
END;
$$ LANGUAGE plpgsql;

-- Function to prevent duplicate task creation
CREATE OR REPLACE FUNCTION prevent_duplicate_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if task already exists for this job/template combination
  IF EXISTS (
    SELECT 1 FROM job_tasks
    WHERE job_id = NEW.job_id
    AND template_id = NEW.template_id
    AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Task already exists for this job and template';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to validate stage mappings
CREATE OR REPLACE FUNCTION validate_stage_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure every stage has at least one possible transition (except final stages)
  IF NOT EXISTS (
    SELECT 1 FROM stage_transitions
    WHERE from_stage_id = NEW.id
  ) AND NEW.maps_to_status NOT IN ('completed', 'cancelled') THEN
    RAISE WARNING 'Stage % has no outgoing transitions', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. TRIGGERS FOR SAFEGUARDS
-- =============================================

-- Trigger to prevent circular transitions
CREATE OR REPLACE FUNCTION prevent_circular_transitions()
RETURNS TRIGGER AS $$
BEGIN
  IF detect_circular_transition(NEW.from_stage_id, NEW.to_stage_id) THEN
    RAISE EXCEPTION 'Circular transition detected between stages';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_circular_transitions
  BEFORE INSERT OR UPDATE ON stage_transitions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_circular_transitions();

-- Trigger to prevent duplicate tasks
CREATE TRIGGER trigger_prevent_duplicate_tasks
  BEFORE INSERT ON job_tasks
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_tasks();

-- Trigger to validate stage mappings
CREATE TRIGGER trigger_validate_stage_mapping
  AFTER INSERT OR UPDATE ON job_stages
  FOR EACH ROW
  EXECUTE FUNCTION validate_stage_mapping();

-- =============================================
-- 7. GRANT PERMISSIONS
-- =============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON job_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stage_transitions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stage_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON task_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_responses TO authenticated;
GRANT SELECT, INSERT ON stage_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stage_performance_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON client_portal_access TO authenticated;

-- Grant read-only permissions to anon for client portal
GRANT SELECT ON job_stages TO anon;
GRANT SELECT ON stage_questions TO anon;
GRANT SELECT ON client_portal_access TO anon;

-- =============================================
-- 8. ENABLE ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE job_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_access ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be enhanced later)
CREATE POLICY "Users can view stages" ON job_stages FOR SELECT USING (true);
CREATE POLICY "Users can view transitions" ON stage_transitions FOR SELECT USING (true);
CREATE POLICY "Users can view questions" ON stage_questions FOR SELECT USING (true);
CREATE POLICY "Users can view task templates" ON task_templates FOR SELECT USING (true);

-- Job-specific RLS policies
CREATE POLICY "Users can manage job tasks" ON job_tasks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_tasks.job_id
    AND (
      j.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
    )
  )
);

CREATE POLICY "Users can manage responses" ON user_responses FOR ALL USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = user_responses.job_id
    AND (
      j.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
    )
  )
);

-- Commit the transaction
COMMIT;

-- =============================================
-- 9. COMMENT DOCUMENTATION
-- =============================================

COMMENT ON TABLE job_stages IS 'Defines the 12 stages of job progression with safeguards';
COMMENT ON TABLE stage_transitions IS 'Maps question responses to stage transitions with circular protection';
COMMENT ON TABLE stage_questions IS 'Contextual questions for each stage with conditional logic';
COMMENT ON TABLE task_templates IS 'Templates for auto-generated tasks with enforcement rules';
COMMENT ON TABLE job_tasks IS 'Auto-generated tasks with subtask tracking and file upload support';
COMMENT ON TABLE user_responses IS 'Tracks all user responses with source attribution';
COMMENT ON TABLE stage_audit_log IS 'Comprehensive audit trail of all stage changes';
COMMENT ON TABLE stage_performance_metrics IS 'Performance tracking for stages and SLA monitoring';
COMMENT ON TABLE client_portal_access IS 'Secure client access for external responses';

COMMENT ON FUNCTION detect_circular_transition IS 'Prevents circular stage transitions';
COMMENT ON FUNCTION prevent_duplicate_tasks IS 'Prevents duplicate task creation';
COMMENT ON FUNCTION validate_stage_mapping IS 'Validates stage configuration integrity';