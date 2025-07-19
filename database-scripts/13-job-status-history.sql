-- Job Status History Schema
-- This table tracks all status changes for jobs with timestamps and user information

-- Create the job_status_history table
CREATE TABLE IF NOT EXISTS job_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_changed_at ON job_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_job_status_history_status ON job_status_history(status);
CREATE INDEX IF NOT EXISTS idx_job_status_history_job_changed_at ON job_status_history(job_id, changed_at);

-- Enable RLS
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view job status history for their company's jobs" 
ON job_status_history FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND (
            jobs.company_id = (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
            OR
            (
                SELECT role FROM users WHERE id = auth.uid()
            ) = 'site_admin'
        )
    )
);

CREATE POLICY "Users can insert job status history for their company's jobs" 
ON job_status_history FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM jobs 
        WHERE jobs.id = job_status_history.job_id 
        AND (
            jobs.company_id = (
                SELECT company_id FROM users WHERE id = auth.uid()
            )
            OR
            (
                SELECT role FROM users WHERE id = auth.uid()
            ) = 'site_admin'
        )
    )
);

-- Create a function to automatically log status changes
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO job_status_history (job_id, status, changed_by, changed_at)
        VALUES (NEW.id, NEW.status, auth.uid(), NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log status changes
DROP TRIGGER IF EXISTS trigger_log_job_status_change ON jobs;
CREATE TRIGGER trigger_log_job_status_change
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_job_status_change();

-- Create initial status history entries for existing jobs
-- This ensures all existing jobs have at least one status history entry
INSERT INTO job_status_history (job_id, status, changed_at, changed_by)
SELECT 
    id as job_id,
    status,
    created_at as changed_at,
    created_by as changed_by
FROM jobs
WHERE NOT EXISTS (
    SELECT 1 FROM job_status_history 
    WHERE job_status_history.job_id = jobs.id
)
ON CONFLICT DO NOTHING;

-- Create a function to get job status timeline
CREATE OR REPLACE FUNCTION get_job_status_timeline(p_job_id UUID)
RETURNS TABLE (
    status TEXT,
    changed_at TIMESTAMP WITH TIME ZONE,
    changed_by UUID,
    changed_by_name TEXT,
    notes TEXT,
    duration_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH status_periods AS (
        SELECT 
            jsh.status,
            jsh.changed_at,
            jsh.changed_by,
            u.full_name as changed_by_name,
            jsh.notes,
            LEAD(jsh.changed_at) OVER (ORDER BY jsh.changed_at) as next_change_at
        FROM job_status_history jsh
        LEFT JOIN users u ON jsh.changed_by = u.id
        WHERE jsh.job_id = p_job_id
        ORDER BY jsh.changed_at
    )
    SELECT 
        sp.status,
        sp.changed_at,
        sp.changed_by,
        sp.changed_by_name,
        sp.notes,
        CASE 
            WHEN sp.next_change_at IS NULL THEN 
                EXTRACT(DAY FROM (NOW() - sp.changed_at))::INTEGER
            ELSE 
                EXTRACT(DAY FROM (sp.next_change_at - sp.changed_at))::INTEGER
        END as duration_days
    FROM status_periods sp
    ORDER BY sp.changed_at;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying of current status with history
CREATE OR REPLACE VIEW job_status_with_history AS
SELECT 
    j.id,
    j.title,
    j.status as current_status,
    j.start_date,
    j.end_date,
    j.company_id,
    first_status.changed_at as first_status_change,
    last_status.changed_at as last_status_change,
    EXTRACT(DAY FROM (NOW() - first_status.changed_at))::INTEGER as days_since_first_status,
    EXTRACT(DAY FROM (NOW() - last_status.changed_at))::INTEGER as days_since_last_status,
    (
        SELECT COUNT(*) 
        FROM job_status_history jsh 
        WHERE jsh.job_id = j.id
    ) as total_status_changes
FROM jobs j
LEFT JOIN (
    SELECT DISTINCT ON (job_id) 
        job_id, changed_at 
    FROM job_status_history 
    ORDER BY job_id, changed_at ASC
) first_status ON j.id = first_status.job_id
LEFT JOIN (
    SELECT DISTINCT ON (job_id) 
        job_id, changed_at 
    FROM job_status_history 
    ORDER BY job_id, changed_at DESC
) last_status ON j.id = last_status.job_id;

-- Grant permissions
GRANT SELECT, INSERT ON job_status_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_status_timeline(UUID) TO authenticated;
GRANT SELECT ON job_status_with_history TO authenticated;