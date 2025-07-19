-- Multi-Worker Task Assignment System
-- This enables multiple workers per task and auto job assignment
-- Run this in Supabase SQL Editor

-- Create task_assignments table for many-to-many relationship
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one assignment per task-worker pair
    UNIQUE(task_id, worker_id)
);

-- Remove the old assigned_to column from tasks table (if it exists)
-- We'll keep it for now to maintain compatibility, but deprecate it
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legacy_assigned_to UUID REFERENCES workers(id) ON DELETE SET NULL;

-- Copy existing assignments to new table
INSERT INTO task_assignments (task_id, worker_id, assigned_by)
SELECT id, assigned_to, created_by 
FROM tasks 
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, worker_id) DO NOTHING;

-- Function to auto-assign worker to job when assigned to task
CREATE OR REPLACE FUNCTION auto_assign_worker_to_job()
RETURNS TRIGGER AS $$
DECLARE
    task_job_id UUID;
    existing_assignment_count INTEGER;
BEGIN
    -- Get the job_id for this task
    SELECT job_id INTO task_job_id 
    FROM tasks 
    WHERE id = NEW.task_id;
    
    -- Check if worker is already assigned to this job
    SELECT COUNT(*) INTO existing_assignment_count
    FROM job_assignments 
    WHERE job_id = task_job_id AND worker_id = NEW.worker_id;
    
    -- If not already assigned, auto-assign to job
    IF existing_assignment_count = 0 THEN
        INSERT INTO job_assignments (job_id, worker_id, role, assigned_date, assigned_by, created_by)
        VALUES (
            task_job_id, 
            NEW.worker_id, 
            'worker', -- Default role for task-based assignments
            NEW.assigned_date,
            NEW.assigned_by,
            NEW.assigned_by
        );
        
        RAISE NOTICE 'Auto-assigned worker % to job % via task assignment', NEW.worker_id, task_job_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto job assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_worker_to_job ON task_assignments;

CREATE TRIGGER trigger_auto_assign_worker_to_job
    AFTER INSERT ON task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_worker_to_job();

-- Function to remove job assignment when last task assignment is removed
CREATE OR REPLACE FUNCTION check_remove_job_assignment()
RETURNS TRIGGER AS $$
DECLARE
    task_job_id UUID;
    remaining_task_count INTEGER;
    remaining_direct_assignment_count INTEGER;
BEGIN
    -- Get the job_id for this task
    SELECT job_id INTO task_job_id 
    FROM tasks 
    WHERE id = OLD.task_id;
    
    -- Count remaining task assignments for this worker in this job
    SELECT COUNT(*) INTO remaining_task_count
    FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    WHERE t.job_id = task_job_id AND ta.worker_id = OLD.worker_id;
    
    -- Count direct job assignments (not via tasks)
    SELECT COUNT(*) INTO remaining_direct_assignment_count
    FROM job_assignments
    WHERE job_id = task_job_id AND worker_id = OLD.worker_id;
    
    -- If no remaining task assignments and no direct assignment, 
    -- optionally remove from job (commented out for safety)
    -- IF remaining_task_count = 0 AND remaining_direct_assignment_count > 0 THEN
    --     DELETE FROM job_assignments 
    --     WHERE job_id = task_job_id AND worker_id = OLD.worker_id;
    --     
    --     RAISE NOTICE 'Removed worker % from job % (no remaining task assignments)', OLD.worker_id, task_job_id;
    -- END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for checking job assignment removal (optional)
DROP TRIGGER IF EXISTS trigger_check_remove_job_assignment ON task_assignments;

CREATE TRIGGER trigger_check_remove_job_assignment
    AFTER DELETE ON task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION check_remove_job_assignment();

-- Add updated_at trigger for task_assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_task_assignments_updated_at'
    ) THEN
        -- Add updated_at column if it doesn't exist
        ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        CREATE TRIGGER update_task_assignments_updated_at 
        BEFORE UPDATE ON task_assignments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_worker_id ON task_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);

-- Verify the setup
DO $$
BEGIN
    -- Check if task_assignments table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_assignments') THEN
        RAISE NOTICE '✅ task_assignments table ready';
    ELSE
        RAISE EXCEPTION '❌ task_assignments table creation failed';
    END IF;

    -- Check if auto-assignment function exists
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'auto_assign_worker_to_job') THEN
        RAISE NOTICE '✅ auto_assign_worker_to_job function ready';
    ELSE
        RAISE EXCEPTION '❌ auto_assign_worker_to_job function creation failed';
    END IF;

    -- Check if trigger exists
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_assign_worker_to_job') THEN
        RAISE NOTICE '✅ auto job assignment trigger ready';
    ELSE
        RAISE EXCEPTION '❌ auto job assignment trigger creation failed';
    END IF;

    RAISE NOTICE '🎉 Multi-worker task assignment system ready!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 New capabilities:';
    RAISE NOTICE '   ✅ Multiple workers per task';
    RAISE NOTICE '   ✅ Auto job assignment when assigned to task';
    RAISE NOTICE '   ✅ Maintains data integrity with foreign keys';
    RAISE NOTICE '   ✅ Prevents duplicate assignments';
END $$;