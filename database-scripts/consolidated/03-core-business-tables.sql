-- ================================================
-- JobTracker Pro - Core Business Tables
-- ================================================
-- This script creates the main business entity tables
-- with proper multi-tenant architecture and RLS policies
-- 
-- Order: 03
-- Dependencies: 01-core-database-setup.sql, 02-company-configuration-tables.sql
-- Description: Jobs, Workers, Projects, Tasks, Time Tracking
-- ================================================

-- ================================================
-- 1. PROJECTS TABLE (Job grouping and hierarchy)
-- ================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  start_date DATE,
  end_date DATE,
  estimated_budget DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'medium',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_project_status CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT valid_project_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT logical_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Project indexes
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(company_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_client_name ON projects(company_id, client_name);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(company_id, start_date);

-- Enable RLS on projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Projects RLS policy
CREATE POLICY "projects_access_policy" ON projects
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 2. JOBS TABLE (Primary work units)
-- ================================================

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'medium',
  job_type TEXT,
  
  -- Location fields
  address TEXT,
  city TEXT,
  state TEXT, 
  postal_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Client information
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_contact_person TEXT,
  
  -- Scheduling
  scheduled_start_date DATE,
  scheduled_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  
  -- Financial
  estimated_cost DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  billable_hours DECIMAL(8,2) DEFAULT 0,
  
  -- Question-driven progression
  current_stage_id UUID,
  stage_entered_at TIMESTAMPTZ,
  client_portal_enabled BOOLEAN DEFAULT FALSE,
  mobile_optimized BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_job_status CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT valid_job_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT logical_scheduled_dates CHECK (scheduled_end_date IS NULL OR scheduled_start_date IS NULL OR scheduled_end_date >= scheduled_start_date),
  CONSTRAINT logical_actual_dates CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date)
);

-- Job indexes
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage_id ON jobs(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_name ON jobs(company_id, client_name);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start_date ON jobs(company_id, scheduled_start_date);
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(company_id, city, state);

-- Enable RLS on jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Jobs RLS policy
CREATE POLICY "jobs_access_policy" ON jobs
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 3. WORKERS TABLE (Company employees/contractors)
-- ================================================

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  worker_number TEXT,
  
  -- Personal information
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Employment details
  hire_date DATE,
  employment_type TEXT DEFAULT 'employee',
  hourly_rate DECIMAL(8,2),
  salary DECIMAL(12,2),
  
  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  
  -- Status and flags
  is_active BOOLEAN DEFAULT TRUE,
  is_foreman BOOLEAN DEFAULT FALSE,
  can_be_assigned_jobs BOOLEAN DEFAULT TRUE,
  requires_license_verification BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_employment_type CHECK (employment_type IN ('employee', 'contractor', 'temporary', 'intern')),
  CONSTRAINT unique_worker_number_per_company UNIQUE (company_id, worker_number),
  CONSTRAINT positive_rates CHECK (hourly_rate IS NULL OR hourly_rate >= 0)
);

-- Worker indexes
CREATE INDEX IF NOT EXISTS idx_workers_company_id ON workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_is_active ON workers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workers_is_foreman ON workers(company_id, is_foreman);
CREATE INDEX IF NOT EXISTS idx_workers_full_name ON workers(company_id, full_name);

-- Enable RLS on workers
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Workers RLS policy
CREATE POLICY "workers_access_policy" ON workers
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 4. WORKER SKILLS TABLE (Employee competencies)
-- ================================================

CREATE TABLE IF NOT EXISTS worker_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level TEXT NOT NULL DEFAULT 'beginner',
  years_experience INTEGER DEFAULT 0,
  certification_name TEXT,
  certification_expiry DATE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_proficiency_level CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  CONSTRAINT non_negative_experience CHECK (years_experience >= 0),
  UNIQUE (worker_id, skill_name)
);

-- Worker skills indexes
CREATE INDEX IF NOT EXISTS idx_worker_skills_company_id ON worker_skills(company_id);
CREATE INDEX IF NOT EXISTS idx_worker_skills_worker_id ON worker_skills(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_skills_skill_name ON worker_skills(company_id, skill_name);

-- Enable RLS on worker skills
ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;

-- Worker skills RLS policy
CREATE POLICY "worker_skills_access_policy" ON worker_skills
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 5. WORKER LICENSES TABLE (Legal certifications)
-- ================================================

CREATE TABLE IF NOT EXISTS worker_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  license_number TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  issuing_authority TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT logical_license_dates CHECK (expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date),
  UNIQUE (worker_id, license_type, license_number)
);

-- Worker licenses indexes
CREATE INDEX IF NOT EXISTS idx_worker_licenses_company_id ON worker_licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_worker_id ON worker_licenses(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_expiry_date ON worker_licenses(company_id, expiry_date) WHERE is_active = TRUE;

-- Enable RLS on worker licenses
ALTER TABLE worker_licenses ENABLE ROW LEVEL SECURITY;

-- Worker licenses RLS policy
CREATE POLICY "worker_licenses_access_policy" ON worker_licenses
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 6. JOB ASSIGNMENTS TABLE (Worker-to-job relationships)
-- ================================================

CREATE TABLE IF NOT EXISTS job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  status TEXT NOT NULL DEFAULT 'assigned',
  start_date DATE,
  end_date DATE,
  hourly_rate DECIMAL(8,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_assignment_role CHECK (role IN ('worker', 'foreman', 'supervisor', 'specialist')),
  CONSTRAINT valid_assignment_status CHECK (status IN ('assigned', 'active', 'completed', 'cancelled')),
  CONSTRAINT logical_assignment_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  UNIQUE (job_id, worker_id)
);

-- Job assignments indexes
CREATE INDEX IF NOT EXISTS idx_job_assignments_company_id ON job_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(company_id, status);

-- Enable RLS on job assignments
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- Job assignments RLS policy
CREATE POLICY "job_assignments_access_policy" ON job_assignments
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 7. TASKS TABLE (Work items within jobs)
-- ================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  
  -- Assignment
  assigned_to UUID REFERENCES workers(id),
  estimated_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),
  
  -- Scheduling
  due_date DATE,
  start_date DATE,
  completion_date DATE,
  
  -- Dependencies
  depends_on_task_id UUID REFERENCES tasks(id),
  sequence_order INTEGER DEFAULT 0,
  
  -- Metadata
  is_milestone BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_task_status CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  CONSTRAINT valid_task_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT positive_hours CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  CONSTRAINT logical_task_dates CHECK (completion_date IS NULL OR start_date IS NULL OR completion_date >= start_date)
);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(company_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks(depends_on_task_id) WHERE depends_on_task_id IS NOT NULL;

-- Enable RLS on tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Tasks RLS policy
CREATE POLICY "tasks_access_policy" ON tasks
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 8. TIME ENTRIES TABLE (Time tracking)
-- ================================================

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Time tracking
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  break_duration_minutes INTEGER DEFAULT 0,
  
  -- Classification
  entry_type TEXT NOT NULL DEFAULT 'work',
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Location (for mobile check-ins)
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  
  -- Approval workflow
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  
  CONSTRAINT valid_entry_type CHECK (entry_type IN ('work', 'break', 'travel', 'overtime')),
  CONSTRAINT valid_time_entry_status CHECK (status IN ('active', 'completed', 'approved', 'rejected')),
  CONSTRAINT logical_time_range CHECK (end_time IS NULL OR end_time >= start_time),
  CONSTRAINT non_negative_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  CONSTRAINT non_negative_break CHECK (break_duration_minutes >= 0)
);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_worker_id ON time_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(company_id, start_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(company_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_approval ON time_entries(company_id, is_approved) WHERE is_approved = FALSE;

-- Enable RLS on time entries
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Time entries RLS policy
CREATE POLICY "time_entries_access_policy" ON time_entries
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 9. UPDATED_AT TRIGGERS
-- ================================================

-- Apply updated_at triggers to all tables
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_skills_updated_at ON worker_skills;
CREATE TRIGGER update_worker_skills_updated_at
  BEFORE UPDATE ON worker_skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_licenses_updated_at ON worker_licenses;
CREATE TRIGGER update_worker_licenses_updated_at
  BEFORE UPDATE ON worker_licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_assignments_updated_at ON job_assignments;
CREATE TRIGGER update_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

-- Insert migration record
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('03-core-business-tables', NOW())
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE projects IS 'Project groupings for jobs with client and budget tracking';
COMMENT ON TABLE jobs IS 'Primary work units with multi-stage progression support';
COMMENT ON TABLE workers IS 'Company employees and contractors with skills tracking';
COMMENT ON TABLE worker_skills IS 'Employee competencies and certifications';
COMMENT ON TABLE worker_licenses IS 'Legal certifications and license tracking';
COMMENT ON TABLE job_assignments IS 'Worker-to-job assignment relationships';
COMMENT ON TABLE tasks IS 'Individual work items within jobs';
COMMENT ON TABLE time_entries IS 'Time tracking with location and approval workflow';