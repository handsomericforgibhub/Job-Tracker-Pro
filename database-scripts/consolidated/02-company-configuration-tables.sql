-- ================================================
-- JobTracker Pro - Company Configuration Tables
-- ================================================
-- This script creates company-scoped configuration tables
-- that replace hard-coded business logic with dynamic configs
-- 
-- Order: 02
-- Dependencies: 01-core-database-setup.sql
-- Description: Company stages, status configs, color schemes
-- ================================================

-- ================================================
-- 1. COMPANY STAGES (Dynamic stage definitions)
-- ================================================

CREATE TABLE IF NOT EXISTS company_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sequence_order INTEGER NOT NULL,
  stage_type TEXT NOT NULL DEFAULT 'standard',
  maps_to_status TEXT NOT NULL,
  min_duration_hours INTEGER DEFAULT 0,
  max_duration_hours INTEGER,
  requires_approval BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_stage_type CHECK (stage_type IN ('standard', 'milestone', 'approval')),
  CONSTRAINT valid_maps_to_status CHECK (maps_to_status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT positive_sequence_order CHECK (sequence_order > 0),
  CONSTRAINT logical_duration CHECK (min_duration_hours >= 0 AND (max_duration_hours IS NULL OR max_duration_hours >= min_duration_hours)),
  UNIQUE (company_id, sequence_order),
  UNIQUE (company_id, name)
);

-- Company stages indexes
CREATE INDEX IF NOT EXISTS idx_company_stages_company_id ON company_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_company_stages_sequence_order ON company_stages(company_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_company_stages_maps_to_status ON company_stages(company_id, maps_to_status);

-- Enable RLS on company stages
ALTER TABLE company_stages ENABLE ROW LEVEL SECURITY;

-- Company stages RLS policy
CREATE POLICY "company_stages_access_policy" ON company_stages
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 2. COMPANY STATUS CONFIGS (Dynamic status definitions)
-- ================================================

CREATE TABLE IF NOT EXISTS company_status_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL,
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  background_color TEXT,
  text_color TEXT,
  icon_name TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_final_state BOOLEAN DEFAULT FALSE,
  allowed_transitions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_status_type CHECK (status_type IN ('job', 'task', 'worker', 'project', 'time_entry')),
  CONSTRAINT valid_job_status_key CHECK (
    status_type != 'job' OR 
    status_key IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')
  ),
  CONSTRAINT valid_task_status_key CHECK (
    status_type != 'task' OR 
    status_key IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')
  ),
  UNIQUE (company_id, status_type, status_key)
);

-- Company status configs indexes
CREATE INDEX IF NOT EXISTS idx_company_status_configs_company_id ON company_status_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_company_status_configs_type_key ON company_status_configs(company_id, status_type, status_key);
CREATE INDEX IF NOT EXISTS idx_company_status_configs_sort_order ON company_status_configs(company_id, status_type, sort_order);

-- Enable RLS on company status configs
ALTER TABLE company_status_configs ENABLE ROW LEVEL SECURITY;

-- Company status configs RLS policy
CREATE POLICY "company_status_configs_access_policy" ON company_status_configs
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 3. COMPANY COLOR SCHEMES (Dynamic color palettes)
-- ================================================

CREATE TABLE IF NOT EXISTS company_color_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scheme_type TEXT NOT NULL,
  color_key TEXT NOT NULL,
  color_value TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_scheme_type CHECK (scheme_type IN ('stage', 'status', 'gantt', 'chart', 'ui_theme')),
  CONSTRAINT valid_color_format CHECK (color_value ~ '^#[0-9A-Fa-f]{6}$'),
  UNIQUE (company_id, scheme_type, color_key)
);

-- Company color schemes indexes
CREATE INDEX IF NOT EXISTS idx_company_color_schemes_company_id ON company_color_schemes(company_id);
CREATE INDEX IF NOT EXISTS idx_company_color_schemes_type_key ON company_color_schemes(company_id, scheme_type, color_key);

-- Enable RLS on company color schemes
ALTER TABLE company_color_schemes ENABLE ROW LEVEL SECURITY;

-- Company color schemes RLS policy
CREATE POLICY "company_color_schemes_access_policy" ON company_color_schemes
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 4. CONFIGURATION HELPER FUNCTIONS
-- ================================================

-- Get company stage definitions
CREATE OR REPLACE FUNCTION get_company_stage_definitions(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  color TEXT,
  sequence_order INTEGER,
  stage_type TEXT,
  maps_to_status TEXT,
  min_duration_hours INTEGER,
  max_duration_hours INTEGER,
  requires_approval BOOLEAN
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    cs.id,
    cs.name,
    cs.description,
    cs.color,
    cs.sequence_order,
    cs.stage_type,
    cs.maps_to_status,
    cs.min_duration_hours,
    cs.max_duration_hours,
    cs.requires_approval
  FROM company_stages cs
  WHERE cs.company_id = p_company_id 
    AND cs.is_active = TRUE
  ORDER BY cs.sequence_order;
$$;

-- Get company default stage (first stage)
CREATE OR REPLACE FUNCTION get_company_default_stage(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  maps_to_status TEXT
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    cs.id,
    cs.name,
    cs.maps_to_status
  FROM company_stages cs
  WHERE cs.company_id = p_company_id 
    AND cs.is_active = TRUE
  ORDER BY cs.sequence_order
  LIMIT 1;
$$;

-- Get stage color by name
CREATE OR REPLACE FUNCTION get_company_stage_color(p_company_id UUID, p_stage_name TEXT)
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT color 
  FROM company_stages 
  WHERE company_id = p_company_id 
    AND name = p_stage_name 
    AND is_active = TRUE;
$$;

-- Get status configurations by type
CREATE OR REPLACE FUNCTION get_company_status_configs_by_type(p_company_id UUID, p_status_type TEXT)
RETURNS TABLE (
  status_key TEXT,
  label TEXT,
  color TEXT,
  background_color TEXT,
  text_color TEXT,
  icon_name TEXT,
  description TEXT,
  is_final_state BOOLEAN,
  allowed_transitions TEXT[]
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    csc.status_key,
    csc.label,
    csc.color,
    csc.background_color,
    csc.text_color,
    csc.icon_name,
    csc.description,
    csc.is_final_state,
    csc.allowed_transitions
  FROM company_status_configs csc
  WHERE csc.company_id = p_company_id 
    AND csc.status_type = p_status_type
    AND csc.is_active = TRUE
  ORDER BY csc.sort_order;
$$;

-- Get single status config
CREATE OR REPLACE FUNCTION get_company_status_config(p_company_id UUID, p_status_type TEXT, p_status_key TEXT)
RETURNS TABLE (
  status_key TEXT,
  label TEXT,
  color TEXT,
  background_color TEXT,
  text_color TEXT,
  icon_name TEXT,
  description TEXT,
  is_final_state BOOLEAN,
  allowed_transitions TEXT[]
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    csc.status_key,
    csc.label,
    csc.color,
    csc.background_color,
    csc.text_color,
    csc.icon_name,
    csc.description,
    csc.is_final_state,
    csc.allowed_transitions
  FROM company_status_configs csc
  WHERE csc.company_id = p_company_id 
    AND csc.status_type = p_status_type
    AND csc.status_key = p_status_key
    AND csc.is_active = TRUE;
$$;

-- Get company colors by scheme type
CREATE OR REPLACE FUNCTION get_company_colors(p_company_id UUID, p_scheme_type TEXT)
RETURNS TABLE (
  color_key TEXT,
  color_value TEXT,
  description TEXT
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    ccs.color_key,
    ccs.color_value,
    ccs.description
  FROM company_color_schemes ccs
  WHERE ccs.company_id = p_company_id 
    AND ccs.scheme_type = p_scheme_type
    AND ccs.is_active = TRUE
  ORDER BY ccs.sort_order;
$$;

-- Get chart colors for a company
CREATE OR REPLACE FUNCTION get_company_chart_colors(p_company_id UUID)
RETURNS TABLE (
  color_key TEXT,
  color_value TEXT
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    ccs.color_key,
    ccs.color_value
  FROM company_color_schemes ccs
  WHERE ccs.company_id = p_company_id 
    AND ccs.scheme_type = 'chart'
    AND ccs.is_active = TRUE
  ORDER BY ccs.sort_order;
$$;

-- Get status config formatted for API responses
CREATE OR REPLACE FUNCTION get_status_config_for_api(p_company_id UUID, p_status_type TEXT)
RETURNS JSONB
LANGUAGE SQL SECURITY DEFINER
AS $$
DECLARE
  result JSONB := '{}'::JSONB;
  config_record RECORD;
BEGIN
  FOR config_record IN
    SELECT * FROM get_company_status_configs_by_type(p_company_id, p_status_type)
  LOOP
    result := result || jsonb_build_object(
      config_record.status_key,
      jsonb_build_object(
        'label', config_record.label,
        'color', config_record.color,
        'background_color', config_record.background_color,
        'text_color', config_record.text_color,
        'icon_name', config_record.icon_name,
        'description', config_record.description,
        'is_final_state', config_record.is_final_state,
        'allowed_transitions', config_record.allowed_transitions
      )
    );
  END LOOP;
  
  RETURN result;
END;
$$;

-- ================================================
-- 5. UPDATED_AT TRIGGERS
-- ================================================

-- Apply updated_at trigger to company_stages
DROP TRIGGER IF EXISTS update_company_stages_updated_at ON company_stages;
CREATE TRIGGER update_company_stages_updated_at
  BEFORE UPDATE ON company_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to company_status_configs
DROP TRIGGER IF EXISTS update_company_status_configs_updated_at ON company_status_configs;
CREATE TRIGGER update_company_status_configs_updated_at
  BEFORE UPDATE ON company_status_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to company_color_schemes
DROP TRIGGER IF EXISTS update_company_color_schemes_updated_at ON company_color_schemes;
CREATE TRIGGER update_company_color_schemes_updated_at
  BEFORE UPDATE ON company_color_schemes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

-- Insert migration record
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('02-company-configuration-tables', NOW())
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE company_stages IS 'Company-specific job progression stages';
COMMENT ON TABLE company_status_configs IS 'Dynamic status configurations for all entity types';
COMMENT ON TABLE company_color_schemes IS 'Company-branded color palettes for UI theming';