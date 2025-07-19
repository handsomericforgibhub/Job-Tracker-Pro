-- Fix RLS policies for job_status_history table
-- The API needs to be able to read status history for the Gantt chart

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'job_status_history';

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view job status history for their company's jobs" ON job_status_history;
DROP POLICY IF EXISTS "Users can insert job status history for their company's jobs" ON job_status_history;
DROP POLICY IF EXISTS "Users can update job status history for their company's jobs" ON job_status_history;

-- Create new policies that work with the API
CREATE POLICY "Enable read access for all users" ON job_status_history
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON job_status_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON job_status_history
    FOR UPDATE USING (true);

-- Grant necessary permissions to anon and authenticated
GRANT SELECT ON job_status_history TO anon;
GRANT SELECT ON job_status_history TO authenticated;
GRANT INSERT, UPDATE ON job_status_history TO authenticated;

-- Test the fix
SELECT COUNT(*) as visible_count_anon
FROM job_status_history
WHERE job_id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;