-- JobTracker Pro Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'foreman', 'worker')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')) DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(10,2),
  client_name TEXT,
  location TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workers table (for non-auth workers)
CREATE TABLE IF NOT EXISTS workers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  hourly_rate DECIMAL(8,2),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, worker_id)
);

-- Create worker_check_ins table
CREATE TABLE IF NOT EXISTS worker_check_ins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
  check_out_time TIMESTAMP WITH TIME ZONE,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'contract', 'permit', 'report', 'other')),
  url TEXT NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily_logs table
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL,
  weather_conditions TEXT,
  work_completed TEXT NOT NULL,
  materials_used TEXT,
  workers_present INTEGER,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, log_date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Companies: Users can read their own company, owners can manage their company
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert companies" ON companies
  FOR INSERT WITH CHECK (true); -- Allow during registration

CREATE POLICY "Owners can update their company" ON companies
  FOR UPDATE USING (
    id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Users: Users can read company members, users can update themselves
CREATE POLICY "Users can view company members" ON users
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Jobs: Company members can read jobs, owners/foremen can manage
CREATE POLICY "Company members can view jobs" ON jobs
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and foremen can manage jobs" ON jobs
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'foreman')
    )
  );

-- Workers: Company members can read, owners/foremen can manage
CREATE POLICY "Company members can view workers" ON workers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and foremen can manage workers" ON workers
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'foreman')
    )
  );

-- Job assignments: Company members can read, owners/foremen can manage
CREATE POLICY "Company members can view job assignments" ON job_assignments
  FOR SELECT USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Owners and foremen can manage job assignments" ON job_assignments
  FOR ALL USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'foreman')
    )
  );

-- Worker check-ins: Company members can read, workers can insert their own
CREATE POLICY "Company members can view check-ins" ON worker_check_ins
  FOR SELECT USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Workers can manage their check-ins" ON worker_check_ins
  FOR ALL USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    )
  );

-- Documents: Company members can read, all can upload
CREATE POLICY "Company members can view documents" ON documents
  FOR SELECT USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    ) OR job_id IS NULL
  );

CREATE POLICY "Company members can upload documents" ON documents
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    (job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    ) OR job_id IS NULL)
  );

-- Daily logs: Company members can read, foremen can manage
CREATE POLICY "Company members can view daily logs" ON daily_logs
  FOR SELECT USING (
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Foremen can manage daily logs" ON daily_logs
  FOR ALL USING (
    created_by = auth.uid() AND
    job_id IN (
      SELECT j.id FROM jobs j
      JOIN users u ON u.company_id = j.company_id
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'foreman')
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;