-- Complete Database Setup for JobTracker Pro
-- Run this in Supabase SQL Editor to set up all tables and functions

-- Create companies table (if not exists)
CREATE TABLE IF NOT EXISTS companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'foreman', 'worker')),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    force_password_change BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table (if not exists)
CREATE TABLE IF NOT EXISTS jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2),
    client_name VARCHAR(255),
    location TEXT,
    address_components JSONB,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create employee_id_sequence table for auto-generating employee IDs
CREATE TABLE IF NOT EXISTS employee_id_sequence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    next_sequence INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one sequence per company
    UNIQUE(company_id)
);

-- Create workers table (enhanced user profiles for workers)
CREATE TABLE IF NOT EXISTS workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE, -- Auto-generated employee number
    phone VARCHAR(20),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    address TEXT,
    hourly_rate DECIMAL(10,2),
    hire_date DATE,
    employment_status VARCHAR(20) DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'terminated')),
    notes TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_assignments table (many-to-many relationship between jobs and workers)
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL, -- Link to user account
    assignment_role VARCHAR(50) DEFAULT 'worker' CHECK (assignment_role IN ('lead', 'foreman', 'worker', 'specialist', 'apprentice')),
    assigned_date DATE DEFAULT CURRENT_DATE,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'removed')),
    notes TEXT,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique assignment per worker per job
    UNIQUE(job_id, worker_id)
);

-- Create worker_skills table for tracking certifications and specialties
CREATE TABLE IF NOT EXISTS worker_skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(50) CHECK (skill_category IN ('certification', 'specialty', 'equipment', 'software')),
    proficiency_level VARCHAR(20) DEFAULT 'intermediate' CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    certification_number VARCHAR(100),
    issued_date DATE,
    expiry_date DATE,
    issuing_authority VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'blocked')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create password_reset_tokens table for temporary password management
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers for all tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_assignments_updated_at BEFORE UPDATE ON job_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_skills_updated_at BEFORE UPDATE ON worker_skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_licenses_updated_at BEFORE UPDATE ON worker_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_id_sequence_updated_at BEFORE UPDATE ON employee_id_sequence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Create trigger to auto-generate employee ID
DROP TRIGGER IF EXISTS trigger_auto_generate_employee_id ON workers;
CREATE TRIGGER trigger_auto_generate_employee_id
    BEFORE INSERT ON workers
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_employee_id();

-- Function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_workers_company_id ON workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_employee_id ON workers(employee_id);
CREATE INDEX IF NOT EXISTS idx_workers_employment_status ON workers(employment_status);
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_user_id ON job_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(status);
CREATE INDEX IF NOT EXISTS idx_worker_skills_worker_id ON worker_skills(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_skills_category ON worker_skills(skill_category);
CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_employee_id_sequence_company_id ON employee_id_sequence(company_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_worker_id ON worker_licenses(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_expiry_date ON worker_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_status ON worker_licenses(status);

-- Note: RLS policies are disabled for development
-- To enable them, uncomment the policies in the respective schema files