-- Fix job_status_history RLS policies to allow site admins
-- This script updates the existing RLS policies to allow site_admin users to access job status history

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view job status history for their company's jobs" ON job_status_history;
DROP POLICY IF EXISTS "Users can insert job status history for their company's jobs" ON job_status_history;

-- Create updated RLS policies that allow site admins
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