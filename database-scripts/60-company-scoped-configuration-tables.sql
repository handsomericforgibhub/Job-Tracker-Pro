-- ADR Phase 1: Company-Scoped Configuration Tables
-- Purpose: Create multi-tenant tables for stages, status configs, and color schemes
-- This replaces hard-coded configurations with company-specific data

-- Enable RLS and UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Company Stages Table
-- =============================================
-- Replaces hard-coded stages from src/config/stages.ts
CREATE TABLE IF NOT EXISTS company_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6B7280', -- Gray-500 as default
    sequence_order INTEGER NOT NULL,
    stage_type TEXT NOT NULL DEFAULT 'job', -- 'job', 'project', 'task'
    maps_to_status TEXT NOT NULL, -- Maps to original status system
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_stage BOOLEAN NOT NULL DEFAULT false, -- For default stages
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(company_id, name, stage_type),
    CHECK (sequence_order > 0),
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$') -- Hex color validation
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_stages_company_id ON company_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_company_stages_type_order ON company_stages(company_id, stage_type, sequence_order);
CREATE INDEX IF NOT EXISTS idx_company_stages_active ON company_stages(company_id, is_active);

-- =============================================
-- Company Status Configurations Table
-- =============================================
-- Replaces hard-coded status configs from components
CREATE TABLE IF NOT EXISTS company_status_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status_type TEXT NOT NULL, -- 'job', 'task', 'worker', 'license', 'skill', etc.
    status_key TEXT NOT NULL, -- Unique key for the status
    label TEXT NOT NULL, -- Display label
    color TEXT NOT NULL DEFAULT '#6B7280',
    description TEXT,
    icon TEXT, -- Optional icon name
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_status BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(company_id, status_type, status_key),
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_status_configs_company_id ON company_status_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_company_status_configs_type ON company_status_configs(company_id, status_type);
CREATE INDEX IF NOT EXISTS idx_company_status_configs_active ON company_status_configs(company_id, is_active);

-- =============================================
-- Company Color Schemes Table
-- =============================================
-- Replaces hard-coded color schemes from src/config/colors.ts
CREATE TABLE IF NOT EXISTS company_color_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    scheme_type TEXT NOT NULL, -- 'stage', 'status', 'gantt', 'priority', 'category'
    color_key TEXT NOT NULL, -- Key for the color (e.g., 'primary', 'danger', 'success')
    color_value TEXT NOT NULL, -- Hex color value
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(company_id, scheme_type, color_key),
    CHECK (color_value ~ '^#[0-9A-Fa-f]{6}$')
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_color_schemes_company_id ON company_color_schemes(company_id);
CREATE INDEX IF NOT EXISTS idx_company_color_schemes_type ON company_color_schemes(company_id, scheme_type);

-- =============================================
-- Stage Transitions Table (Enhanced)
-- =============================================
-- Enhanced version of existing stage_transitions with company scope
CREATE TABLE IF NOT EXISTS company_stage_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES company_stages(id) ON DELETE CASCADE,
    to_stage_id UUID NOT NULL REFERENCES company_stages(id) ON DELETE CASCADE,
    stage_type TEXT NOT NULL DEFAULT 'job',
    transition_name TEXT NOT NULL,
    description TEXT,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approval_roles TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of roles that can approve
    auto_transition_conditions JSONB, -- Conditions for automatic transitions
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(company_id, from_stage_id, to_stage_id),
    CHECK (from_stage_id != to_stage_id OR from_stage_id IS NULL) -- Allow null for initial stage
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_stage_transitions_company_id ON company_stage_transitions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_stage_transitions_from_stage ON company_stage_transitions(from_stage_id);
CREATE INDEX IF NOT EXISTS idx_company_stage_transitions_to_stage ON company_stage_transitions(to_stage_id);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS
ALTER TABLE company_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_status_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_color_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_stage_transitions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their company's data
CREATE POLICY "Users can only access their company's stages" 
    ON company_stages FOR ALL 
    USING (company_id = (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can only access their company's status configs" 
    ON company_status_configs FOR ALL 
    USING (company_id = (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can only access their company's color schemes" 
    ON company_color_schemes FOR ALL 
    USING (company_id = (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
    ));

CREATE POLICY "Users can only access their company's stage transitions" 
    ON company_stage_transitions FOR ALL 
    USING (company_id = (
        SELECT company_id 
        FROM users 
        WHERE id = auth.uid()
    ));

-- =============================================
-- Updated At Triggers
-- =============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER update_company_stages_updated_at
    BEFORE UPDATE ON company_stages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_status_configs_updated_at
    BEFORE UPDATE ON company_status_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_color_schemes_updated_at
    BEFORE UPDATE ON company_color_schemes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_stage_transitions_updated_at
    BEFORE UPDATE ON company_stage_transitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Helper Functions
-- =============================================

-- Function to get company stages in order
CREATE OR REPLACE FUNCTION get_company_stages(
    p_company_id UUID,
    p_stage_type TEXT DEFAULT 'job'
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    color TEXT,
    sequence_order INTEGER,
    maps_to_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.name,
        cs.description,
        cs.color,
        cs.sequence_order,
        cs.maps_to_status
    FROM company_stages cs
    WHERE cs.company_id = p_company_id
      AND cs.stage_type = p_stage_type
      AND cs.is_active = true
    ORDER BY cs.sequence_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get company status configurations
CREATE OR REPLACE FUNCTION get_company_status_configs(
    p_company_id UUID,
    p_status_type TEXT
)
RETURNS TABLE (
    status_key TEXT,
    label TEXT,
    color TEXT,
    description TEXT,
    icon TEXT,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        csc.status_key,
        csc.label,
        csc.color,
        csc.description,
        csc.icon,
        csc.sort_order
    FROM company_status_configs csc
    WHERE csc.company_id = p_company_id
      AND csc.status_type = p_status_type
      AND csc.is_active = true
    ORDER BY csc.sort_order ASC, csc.label ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get company color scheme
CREATE OR REPLACE FUNCTION get_company_colors(
    p_company_id UUID,
    p_scheme_type TEXT
)
RETURNS TABLE (
    color_key TEXT,
    color_value TEXT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ccs.color_key,
        ccs.color_value,
        ccs.description
    FROM company_color_schemes ccs
    WHERE ccs.company_id = p_company_id
      AND ccs.scheme_type = p_scheme_type
      AND ccs.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON TABLE company_stages IS 'Company-specific job/project stages replacing hard-coded stage configurations';
COMMENT ON TABLE company_status_configs IS 'Company-specific status configurations for jobs, workers, licenses, etc.';
COMMENT ON TABLE company_color_schemes IS 'Company-specific color schemes for UI consistency';
COMMENT ON TABLE company_stage_transitions IS 'Defines allowed transitions between stages with approval workflows';

COMMENT ON FUNCTION get_company_stages IS 'Returns ordered list of active stages for a company and stage type';
COMMENT ON FUNCTION get_company_status_configs IS 'Returns status configurations for a specific company and type';
COMMENT ON FUNCTION get_company_colors IS 'Returns color scheme for a specific company and scheme type';