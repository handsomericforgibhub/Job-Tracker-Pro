-- Jobs table updates for project integration
-- This script modifies the jobs table to work within the project hierarchy

-- Add project relationship and stage tracking to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS project_stage_id UUID REFERENCES project_stages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_standalone BOOLEAN DEFAULT true; -- For backward compatibility

-- Add index for the new relationships
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_stage_id ON jobs(project_stage_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_standalone ON jobs(is_standalone);

-- Update RLS policies for jobs to consider project access
DROP POLICY IF EXISTS "Jobs are viewable by company members" ON jobs;
CREATE POLICY "Jobs are viewable by company members" ON jobs
    FOR SELECT USING (
        -- Direct company access (for standalone jobs)
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        -- Project-based access
        OR project_id IN (
            SELECT p.id FROM projects p
            WHERE p.company_id IN (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
        )
        -- Site admin access
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

DROP POLICY IF EXISTS "Jobs are editable by owners and foremen" ON jobs;
CREATE POLICY "Jobs are editable by owners and foremen" ON jobs
    FOR ALL USING (
        -- Direct company access (for standalone jobs)
        company_id IN (
            SELECT company_id FROM users 
            WHERE id = auth.uid() AND role IN ('owner', 'foreman')
        )
        -- Project-based access
        OR project_id IN (
            SELECT p.id FROM projects p
            WHERE p.company_id IN (
                SELECT company_id FROM users 
                WHERE id = auth.uid() AND role IN ('owner', 'foreman')
            )
        )
        -- Site admin access
        OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'site_admin'
        )
    );

-- Create a view for jobs with project information
CREATE OR REPLACE VIEW jobs_with_project_info AS
SELECT 
    j.*,
    p.name as project_name,
    p.status as project_status,
    p.client_name as project_client_name,
    p.site_address as project_site_address,
    p.project_manager_id,
    ps.stage_name,
    ps.sequence_order as stage_sequence,
    ps.color as stage_color,
    ps.status as stage_status,
    ps.completion_percentage as stage_completion
FROM jobs j
LEFT JOIN projects p ON j.project_id = p.id
LEFT JOIN project_stages ps ON j.project_stage_id = ps.id;

-- Create a function to automatically update project stage completion based on jobs
CREATE OR REPLACE FUNCTION update_project_stage_completion()
RETURNS TRIGGER AS $$
DECLARE
    stage_record RECORD;
    total_jobs INTEGER;
    completed_jobs INTEGER;
    new_completion INTEGER;
BEGIN
    -- Get the stage ID from either the new or old record
    IF TG_OP = 'DELETE' THEN
        stage_record.project_stage_id := OLD.project_stage_id;
    ELSE
        stage_record.project_stage_id := NEW.project_stage_id;
    END IF;
    
    -- Only process if there's a stage assigned
    IF stage_record.project_stage_id IS NOT NULL THEN
        -- Count total jobs and completed jobs for this stage
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
        INTO total_jobs, completed_jobs
        FROM jobs 
        WHERE project_stage_id = stage_record.project_stage_id;
        
        -- Calculate completion percentage
        IF total_jobs > 0 THEN
            new_completion := ROUND((completed_jobs::DECIMAL / total_jobs) * 100);
        ELSE
            new_completion := 0;
        END IF;
        
        -- Update the project stage completion
        UPDATE project_stages 
        SET 
            completion_percentage = new_completion,
            status = CASE 
                WHEN new_completion = 100 THEN 'completed'
                WHEN new_completion > 0 THEN 'in_progress'
                ELSE 'pending'
            END
        WHERE id = stage_record.project_stage_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create triggers to update stage completion when jobs change status
CREATE TRIGGER update_stage_completion_on_job_change
    AFTER INSERT OR UPDATE OF status, project_stage_id OR DELETE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_project_stage_completion();

-- Create a function to get project summary
CREATE OR REPLACE FUNCTION get_project_summary(project_uuid UUID)
RETURNS TABLE (
    project_id UUID,
    project_name VARCHAR,
    total_stages INTEGER,
    completed_stages INTEGER,
    total_jobs INTEGER,
    completed_jobs INTEGER,
    overall_completion DECIMAL,
    estimated_hours INTEGER,
    actual_hours INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as project_id,
        p.name as project_name,
        COUNT(DISTINCT ps.id)::INTEGER as total_stages,
        COUNT(DISTINCT CASE WHEN ps.status = 'completed' THEN ps.id END)::INTEGER as completed_stages,
        COUNT(DISTINCT j.id)::INTEGER as total_jobs,
        COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END)::INTEGER as completed_jobs,
        CASE 
            WHEN COUNT(DISTINCT ps.id) > 0 THEN
                ROUND(AVG(ps.completion_percentage), 2)
            ELSE 0
        END as overall_completion,
        SUM(DISTINCT ps.estimated_hours)::INTEGER as estimated_hours,
        SUM(DISTINCT ps.actual_hours)::INTEGER as actual_hours
    FROM projects p
    LEFT JOIN project_stages ps ON p.id = ps.project_id
    LEFT JOIN jobs j ON ps.id = j.project_stage_id
    WHERE p.id = project_uuid
    GROUP BY p.id, p.name;
END;
$$ language 'plpgsql';

-- Grant permissions on the new view and function
GRANT SELECT ON jobs_with_project_info TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_stage_completion() TO authenticated;

-- Add some helpful comments
COMMENT ON COLUMN jobs.project_id IS 'Links job to a project. NULL for standalone jobs.';
COMMENT ON COLUMN jobs.project_stage_id IS 'Links job to a specific stage within a project.';
COMMENT ON COLUMN jobs.is_standalone IS 'True for jobs not part of a project structure.';
COMMENT ON VIEW jobs_with_project_info IS 'Jobs with denormalized project and stage information for easy querying.';
COMMENT ON FUNCTION get_project_summary(UUID) IS 'Returns comprehensive project statistics including stage and job completion.';
COMMENT ON FUNCTION update_project_stage_completion() IS 'Automatically updates project stage completion percentage based on job statuses.';