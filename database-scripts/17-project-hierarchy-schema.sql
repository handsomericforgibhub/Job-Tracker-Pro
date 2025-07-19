-- Project Hierarchy Schema - Phase 1 of Job-Ops Migration
-- This script creates the project-centric structure required by Job-Ops specs

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table - Top level entity for organizing jobs
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    
    -- Client and location information
    client_name VARCHAR(255),
    site_address TEXT,
    address_components JSONB, -- Structured address from Geoapify
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Timeline and budget
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    total_budget DECIMAL(12, 2),
    
    -- Team assignments
    project_manager_id UUID REFERENCES users(id),
    
    -- Company and audit
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project stage templates for reusable workflows
CREATE TABLE IF NOT EXISTS project_stage_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template metadata
    industry_type VARCHAR(100), -- 'construction', 'maintenance', 'renovation', etc.
    project_type VARCHAR(100), -- 'residential', 'commercial', 'infrastructure', etc.
    is_system_template BOOLEAN DEFAULT false, -- Platform-wide vs company-specific
    
    -- Company association (null for system templates)
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Template stages (JSON array of stage definitions)
    stages JSONB NOT NULL, -- [{"name": "Foundation", "color": "#ff6b6b", "sequence": 1, "estimated_days": 5}]
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project stages - individual phases within a project
CREATE TABLE IF NOT EXISTS project_stages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Stage definition
    stage_name VARCHAR(255) NOT NULL,
    description TEXT,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color for Gantt display
    
    -- Status and timeline
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    
    -- Client meeting requirements
    requires_client_meeting BOOLEAN DEFAULT false,
    client_meeting_scheduled_at TIMESTAMPTZ,
    client_meeting_completed BOOLEAN DEFAULT false,
    
    -- Weather sensitivity
    weather_sensitive BOOLEAN DEFAULT false,
    
    -- Dependencies
    depends_on_stage_ids UUID[], -- Array of stage IDs that must complete first
    
    -- Assignments
    assigned_foreman_id UUID REFERENCES users(id),
    
    -- Progress tracking
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(project_id, sequence_order)
);

-- Project stage history for audit trail
CREATE TABLE IF NOT EXISTS project_stage_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stage_id UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
    
    -- Change tracking
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    old_completion_percentage INTEGER,
    new_completion_percentage INTEGER,
    
    -- Change metadata
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    change_reason TEXT,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager_id ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

CREATE INDEX IF NOT EXISTS idx_project_stage_templates_company_id ON project_stage_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_project_stage_templates_industry_type ON project_stage_templates(industry_type);
CREATE INDEX IF NOT EXISTS idx_project_stage_templates_is_system ON project_stage_templates(is_system_template);

CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_status ON project_stages(status);
CREATE INDEX IF NOT EXISTS idx_project_stages_sequence ON project_stages(project_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_project_stages_foreman ON project_stages(assigned_foreman_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_dates ON project_stages(planned_start_date, planned_end_date);

CREATE INDEX IF NOT EXISTS idx_project_stage_history_stage_id ON project_stage_history(stage_id);
CREATE INDEX IF NOT EXISTS idx_project_stage_history_changed_by ON project_stage_history(changed_by);

-- Add RLS policies for security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stage_history ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Projects are viewable by company members" ON projects
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
            UNION 
            SELECT company_id FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

CREATE POLICY "Projects are editable by owners and foremen" ON projects
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users 
            WHERE id = auth.uid() AND role IN ('owner', 'foreman')
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

-- Project stage templates policies
CREATE POLICY "Stage templates are viewable by company members" ON project_stage_templates
    FOR SELECT USING (
        company_id IS NULL -- System templates
        OR company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

CREATE POLICY "Stage templates are editable by owners" ON project_stage_templates
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM users 
            WHERE id = auth.uid() AND role IN ('owner')
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

-- Project stages policies
CREATE POLICY "Project stages are viewable by project members" ON project_stages
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE company_id IN (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

CREATE POLICY "Project stages are editable by owners and foremen" ON project_stages
    FOR ALL USING (
        project_id IN (
            SELECT id FROM projects 
            WHERE company_id IN (
                SELECT company_id FROM users 
                WHERE id = auth.uid() AND role IN ('owner', 'foreman')
            )
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

-- Project stage history policies
CREATE POLICY "Project stage history is viewable by project members" ON project_stage_history
    FOR SELECT USING (
        stage_id IN (
            SELECT ps.id FROM project_stages ps
            JOIN projects p ON ps.project_id = p.id
            WHERE p.company_id IN (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
        )
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_stage_templates_updated_at BEFORE UPDATE ON project_stage_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_stages_updated_at BEFORE UPDATE ON project_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for project stage history tracking
CREATE OR REPLACE FUNCTION track_project_stage_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track significant changes
    IF (OLD.status IS DISTINCT FROM NEW.status) OR 
       (OLD.completion_percentage IS DISTINCT FROM NEW.completion_percentage) THEN
        
        INSERT INTO project_stage_history (
            stage_id,
            old_status,
            new_status,
            old_completion_percentage,
            new_completion_percentage,
            changed_by,
            change_reason
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            OLD.completion_percentage,
            NEW.completion_percentage,
            auth.uid(),
            'Automatic change tracking'
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_project_stage_changes_trigger
    AFTER UPDATE ON project_stages
    FOR EACH ROW
    EXECUTE FUNCTION track_project_stage_changes();

-- Insert some default system stage templates
-- First, create templates with a fallback for created_by if no site_admin exists
DO $$
DECLARE
    admin_user_id UUID;
    fallback_user_id UUID;
BEGIN
    -- Try to find a site_admin user
    SELECT id INTO admin_user_id FROM users WHERE role = 'site_admin' LIMIT 1;
    
    -- If no site_admin, find any user as fallback
    IF admin_user_id IS NULL THEN
        SELECT id INTO fallback_user_id FROM users LIMIT 1;
    END IF;
    
    -- Use admin_user_id if available, otherwise fallback_user_id, otherwise generate a random UUID
    INSERT INTO project_stage_templates (template_name, description, industry_type, project_type, is_system_template, stages, created_by, company_id)
    VALUES 
    (
        'Standard Construction Project',
        'Default stages for typical construction projects',
        'construction',
        'general',
        true,
        '[
            {"name": "Planning & Permits", "color": "#6366f1", "sequence": 1, "estimated_days": 14},
            {"name": "Site Preparation", "color": "#8b5cf6", "sequence": 2, "estimated_days": 5},
            {"name": "Foundation", "color": "#a855f7", "sequence": 3, "estimated_days": 10},
            {"name": "Framing", "color": "#d946ef", "sequence": 4, "estimated_days": 15},
            {"name": "Utilities Installation", "color": "#ec4899", "sequence": 5, "estimated_days": 12},
            {"name": "Insulation & Drywall", "color": "#f43f5e", "sequence": 6, "estimated_days": 8},
            {"name": "Flooring & Interior", "color": "#ef4444", "sequence": 7, "estimated_days": 10},
            {"name": "Final Inspection", "color": "#f97316", "sequence": 8, "estimated_days": 3}
        ]'::jsonb,
        COALESCE(admin_user_id, fallback_user_id, uuid_generate_v4()),
        NULL
    ),
    (
        'Residential Renovation',
        'Stages for home renovation projects',
        'construction',
        'residential',
        true,
        '[
            {"name": "Assessment & Planning", "color": "#06b6d4", "sequence": 1, "estimated_days": 7},
            {"name": "Demolition", "color": "#0891b2", "sequence": 2, "estimated_days": 3},
            {"name": "Structural Work", "color": "#0e7490", "sequence": 3, "estimated_days": 8},
            {"name": "Electrical & Plumbing", "color": "#155e75", "sequence": 4, "estimated_days": 6},
            {"name": "Finishing Work", "color": "#164e63", "sequence": 5, "estimated_days": 12},
            {"name": "Final Touches", "color": "#1e3a8a", "sequence": 6, "estimated_days": 5}
        ]'::jsonb,
        COALESCE(admin_user_id, fallback_user_id, uuid_generate_v4()),
        NULL
    ),
    (
        'Maintenance Project',
        'Simple stages for maintenance and repair work',
        'maintenance',
        'general',
        true,
        '[
            {"name": "Assessment", "color": "#059669", "sequence": 1, "estimated_days": 2},
            {"name": "Parts & Materials", "color": "#047857", "sequence": 2, "estimated_days": 3},
            {"name": "Repair Work", "color": "#065f46", "sequence": 3, "estimated_days": 5},
            {"name": "Testing & Validation", "color": "#064e3b", "sequence": 4, "estimated_days": 2}
        ]'::jsonb,
        COALESCE(admin_user_id, fallback_user_id, uuid_generate_v4()),
        NULL
    );
END $$;

-- Grant permissions
GRANT ALL ON projects TO authenticated;
GRANT ALL ON project_stage_templates TO authenticated;
GRANT ALL ON project_stages TO authenticated;
GRANT ALL ON project_stage_history TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;