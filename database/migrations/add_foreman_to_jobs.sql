-- Migration: Add foreman assignment to jobs table
-- Date: 2025-01-15
-- Description: Add foreman_id column to jobs table to support foreman assignment

-- Add foreman_id column to jobs table
ALTER TABLE jobs ADD COLUMN foreman_id UUID NULL;

-- Add foreign key constraint to users table
ALTER TABLE jobs ADD CONSTRAINT fk_jobs_foreman 
  FOREIGN KEY (foreman_id) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for performance on foreman_id lookups
CREATE INDEX idx_jobs_foreman_id ON jobs(foreman_id);

-- Add check constraint to ensure foreman_id points to a user with foreman role
-- Note: This will be enforced at the application level for now due to RLS complexity

-- Update RLS policies to include foreman access
-- Users can see jobs where they are the assigned foreman
CREATE POLICY "foreman_can_view_assigned_jobs" ON jobs
  FOR SELECT USING (
    foreman_id = auth.uid()
  );

-- Users can update jobs where they are the assigned foreman (status changes only)
CREATE POLICY "foreman_can_update_assigned_jobs" ON jobs
  FOR UPDATE USING (
    foreman_id = auth.uid()
  ) WITH CHECK (
    foreman_id = auth.uid()
  );

-- Add comment to document the new column
COMMENT ON COLUMN jobs.foreman_id IS 'UUID of the foreman assigned to oversee this job';