-- Fix job_assignments table schema
-- Add missing assigned_by column and update existing data
-- Run this in Supabase SQL Editor

-- Add assigned_by column to track who made the assignment
ALTER TABLE job_assignments 
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add created_by column for consistency (if not exists)
ALTER TABLE job_assignments 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Update existing job_assignments to have a default assigned_by value
-- Set to the first owner/foreman found in each company, or the creator if available
UPDATE job_assignments 
SET assigned_by = (
    SELECT u.id 
    FROM users u 
    JOIN workers w ON w.user_id = u.id 
    WHERE w.id = job_assignments.worker_id 
    AND u.role IN ('owner', 'foreman')
    LIMIT 1
)
WHERE assigned_by IS NULL;

-- If still null, set to any user from the same company
UPDATE job_assignments 
SET assigned_by = (
    SELECT u.id 
    FROM users u 
    JOIN workers w ON w.user_id = u.id 
    WHERE w.id = job_assignments.worker_id 
    LIMIT 1
)
WHERE assigned_by IS NULL;

-- Add updated_at column for consistency
ALTER TABLE job_assignments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger for updated_at (safely)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_job_assignments_updated_at'
    ) THEN
        CREATE TRIGGER update_job_assignments_updated_at 
        BEFORE UPDATE ON job_assignments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_job_assignments_assigned_by ON job_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_job_assignments_created_by ON job_assignments(created_by);

-- Verify the schema is correct
DO $$
BEGIN
    -- Check if assigned_by column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_assignments' AND column_name = 'assigned_by'
    ) THEN
        RAISE NOTICE '✅ assigned_by column added to job_assignments';
    ELSE
        RAISE EXCEPTION '❌ assigned_by column missing from job_assignments';
    END IF;

    -- Check if updated_at column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'job_assignments' AND column_name = 'updated_at'
    ) THEN
        RAISE NOTICE '✅ updated_at column added to job_assignments';
    ELSE
        RAISE EXCEPTION '❌ updated_at column missing from job_assignments';
    END IF;

    -- Check if trigger exists
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_job_assignments_updated_at'
    ) THEN
        RAISE NOTICE '✅ job_assignments updated_at trigger ready';
    ELSE
        RAISE EXCEPTION '❌ job_assignments updated_at trigger missing';
    END IF;

    RAISE NOTICE '🎉 job_assignments table schema updated successfully!';
END $$;