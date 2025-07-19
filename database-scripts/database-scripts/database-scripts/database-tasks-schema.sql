-- Task Management Schema
-- Run this in Supabase SQL Editor

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'completed', 'blocked')) DEFAULT 'todo',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE, -- For subtasks
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Enable RLS on tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Company members can view tasks" ON tasks
  FOR SELECT USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Owners and foremen can manage tasks" ON tasks
  FOR ALL USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'foreman')
    )
  );

CREATE POLICY "Workers can update their assigned tasks" ON tasks
  FOR UPDATE USING (
    assigned_to = auth.uid() AND
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE tasks IS 'Tasks and subtasks for job management';
COMMENT ON COLUMN tasks.parent_task_id IS 'Reference to parent task for creating subtasks';
COMMENT ON COLUMN tasks.sort_order IS 'Order for displaying tasks within a job';
COMMENT ON COLUMN tasks.estimated_hours IS 'Estimated time to complete the task';
COMMENT ON COLUMN tasks.actual_hours IS 'Actual time spent on the task';