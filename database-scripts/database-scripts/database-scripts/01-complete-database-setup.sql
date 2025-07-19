-- JobTracker Pro - Complete Database Setup
-- Run this ENTIRE script in Supabase SQL Editor
-- This includes all core tables + enhancements in correct order

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function (used by multiple tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================
-- CORE TABLES (Phase 1-5)
-- ========================================

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (enhanced for worker management)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'foreman', 'worker')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  force_password_change BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table (enhanced with address components)
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
  address_components JSONB,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create enhanced workers table
CREATE TABLE IF NOT EXISTS workers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id VARCHAR(12) UNIQUE, -- Auto-generated EMP000001 format
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to user account
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Contact information
  phone VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  address TEXT,
  
  -- Employment details
  position VARCHAR(100),
  hourly_rate DECIMAL(8,2),
  hire_date DATE,
  employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'terminated')),
  
  -- Additional info
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  assigned_to UUID REFERENCES workers(id) ON DELETE SET NULL,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
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

-- Create worker_skills table
CREATE TABLE IF NOT EXISTS worker_skills (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  skill_category VARCHAR(20) DEFAULT 'specialty' CHECK (skill_category IN ('certification', 'specialty', 'equipment', 'software')),
  proficiency_level VARCHAR(20) CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')) DEFAULT 'intermediate',
  certification_number VARCHAR(100),
  issued_date DATE,
  expiry_date DATE,
  issuing_authority VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worker_id, skill_name)
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

-- ========================================
-- WORKER MANAGEMENT ENHANCEMENTS
-- ========================================

-- Create employee_id_sequence table for auto-generating employee IDs
CREATE TABLE IF NOT EXISTS employee_id_sequence (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    next_sequence INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one sequence per company
    UNIQUE(company_id)
);

-- Create password_reset_tokens table for temporary password management
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    temp_password_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create worker_licenses table for license management
CREATE TABLE IF NOT EXISTS worker_licenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    license_type VARCHAR(100) NOT NULL,
    license_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    issuing_authority VARCHAR(255),
    document_url TEXT, -- Supabase Storage URL
    document_filename VARCHAR(255),
    document_size INTEGER, -- File size in bytes
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to generate next employee ID
CREATE OR REPLACE FUNCTION generate_employee_id(company_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_seq INTEGER;
    employee_id TEXT;
BEGIN
    -- Get or create sequence for company
    INSERT INTO employee_id_sequence (company_id, next_sequence)
    VALUES (company_uuid, 1)
    ON CONFLICT (company_id) DO NOTHING;
    
    -- Get and increment sequence
    UPDATE employee_id_sequence 
    SET next_sequence = next_sequence + 1,
        updated_at = NOW()
    WHERE company_id = company_uuid
    RETURNING next_sequence - 1 INTO next_seq;
    
    -- Generate 6-digit employee ID (EMP000001 to EMP999999)
    employee_id := 'EMP' || LPAD(next_seq::TEXT, 6, '0');
    
    RETURN employee_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate employee ID on worker insert
CREATE OR REPLACE FUNCTION auto_generate_employee_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if employee_id is not provided or is empty
    IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
        NEW.employee_id := generate_employee_id(NEW.company_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS (with safe creation)
-- ========================================

-- Add updated_at triggers for core tables (safely)
DO $$
BEGIN
    -- Companies trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_companies_updated_at'
    ) THEN
        CREATE TRIGGER update_companies_updated_at 
        BEFORE UPDATE ON companies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Users trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_users_updated_at'
    ) THEN
        CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Jobs trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_jobs_updated_at'
    ) THEN
        CREATE TRIGGER update_jobs_updated_at 
        BEFORE UPDATE ON jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Workers trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_workers_updated_at'
    ) THEN
        CREATE TRIGGER update_workers_updated_at 
        BEFORE UPDATE ON workers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Tasks trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_tasks_updated_at'
    ) THEN
        CREATE TRIGGER update_tasks_updated_at 
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Worker skills trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_worker_skills_updated_at'
    ) THEN
        CREATE TRIGGER update_worker_skills_updated_at 
        BEFORE UPDATE ON worker_skills
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Employee ID sequence trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_employee_id_sequence_updated_at'
    ) THEN
        CREATE TRIGGER update_employee_id_sequence_updated_at 
        BEFORE UPDATE ON employee_id_sequence
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Worker licenses trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_worker_licenses_updated_at'
    ) THEN
        CREATE TRIGGER update_worker_licenses_updated_at 
        BEFORE UPDATE ON worker_licenses
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Auto-generate employee ID trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_auto_generate_employee_id'
    ) THEN
        CREATE TRIGGER trigger_auto_generate_employee_id
            BEFORE INSERT ON workers
            FOR EACH ROW
            EXECUTE FUNCTION auto_generate_employee_id();
    END IF;
END $$;

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_workers_company_id ON workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_employee_id ON workers(employee_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id ON job_assignments(worker_id);

-- Enhancement table indexes
CREATE INDEX IF NOT EXISTS idx_employee_id_sequence_company_id ON employee_id_sequence(company_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_worker_id ON worker_licenses(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_expiry_date ON worker_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_status ON worker_licenses(status);
CREATE INDEX IF NOT EXISTS idx_worker_skills_worker_id ON worker_skills(worker_id);

-- ========================================
-- ROW LEVEL SECURITY (DISABLED FOR DEVELOPMENT)
-- ========================================

-- Disable RLS for development - you can enable this later for production
-- ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE worker_check_ins ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PERMISSIONS
-- ========================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify setup completed successfully
DO $$
BEGIN
    -- Check core tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        RAISE NOTICE '✅ companies table ready';
    ELSE
        RAISE EXCEPTION '❌ companies table creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE NOTICE '✅ users table ready';
    ELSE
        RAISE EXCEPTION '❌ users table creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
        RAISE NOTICE '✅ jobs table ready';
    ELSE
        RAISE EXCEPTION '❌ jobs table creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workers') THEN
        RAISE NOTICE '✅ workers table ready';
    ELSE
        RAISE EXCEPTION '❌ workers table creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        RAISE NOTICE '✅ tasks table ready';
    ELSE
        RAISE EXCEPTION '❌ tasks table creation failed';
    END IF;

    -- Check enhancement tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_id_sequence') THEN
        RAISE NOTICE '✅ employee_id_sequence table ready';
    ELSE
        RAISE EXCEPTION '❌ employee_id_sequence table creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens') THEN
        RAISE NOTICE '✅ password_reset_tokens table ready';
    ELSE
        RAISE EXCEPTION '❌ password_reset_tokens table creation failed';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'worker_licenses') THEN
        RAISE NOTICE '✅ worker_licenses table ready';
    ELSE
        RAISE EXCEPTION '❌ worker_licenses table creation failed';
    END IF;

    -- Check functions
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'generate_employee_id') THEN
        RAISE NOTICE '✅ generate_employee_id function ready';
    ELSE
        RAISE EXCEPTION '❌ generate_employee_id function creation failed';
    END IF;

    -- Check triggers
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_generate_employee_id') THEN
        RAISE NOTICE '✅ auto_generate_employee_id trigger ready';
    ELSE
        RAISE EXCEPTION '❌ auto_generate_employee_id trigger creation failed';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 JobTracker Pro database setup completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Ready features:';
    RAISE NOTICE '   ✅ Auto-generating employee IDs (EMP000001-EMP999999)';
    RAISE NOTICE '   ✅ Password reset with temporary passwords';
    RAISE NOTICE '   ✅ License management with file uploads';
    RAISE NOTICE '   ✅ Enhanced worker profiles';
    RAISE NOTICE '   ✅ Address autocomplete support';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 You can now test worker creation and all features!';
END $$;