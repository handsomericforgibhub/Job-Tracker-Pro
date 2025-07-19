-- Worker Management Database Schema
-- Run this in Supabase SQL Editor

-- Create workers table (enhanced user profiles for workers)
CREATE TABLE IF NOT EXISTS workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE, -- Optional employee number
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workers_company_id ON workers(company_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_employment_status ON workers(employment_status);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_worker_id ON job_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_user_id ON job_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(status);

CREATE INDEX IF NOT EXISTS idx_worker_skills_worker_id ON worker_skills(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_skills_category ON worker_skills(skill_category);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_assignments_updated_at BEFORE UPDATE ON job_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_skills_updated_at BEFORE UPDATE ON worker_skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (temporarily disabled for development)
-- Uncomment when ready to enable RLS

-- ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;

-- Workers policies
-- CREATE POLICY "Company members can view workers" ON workers
--     FOR SELECT USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- CREATE POLICY "Owners and foremen can manage workers" ON workers
--     FOR ALL USING (
--         company_id = (SELECT company_id FROM users WHERE id = auth.uid()) AND
--         (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'foreman')
--     );

-- Job assignments policies
-- CREATE POLICY "Company members can view job assignments" ON job_assignments
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             WHERE w.id = job_assignments.worker_id 
--             AND w.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
--         )
--     );

-- CREATE POLICY "Owners and foremen can manage job assignments" ON job_assignments
--     FOR ALL USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             WHERE w.id = job_assignments.worker_id 
--             AND w.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
--             AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'foreman')
--         )
--     );

-- Worker skills policies
-- CREATE POLICY "Company members can view worker skills" ON worker_skills
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             WHERE w.id = worker_skills.worker_id 
--             AND w.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
--         )
--     );

-- CREATE POLICY "Owners and foremen can manage worker skills" ON worker_skills
--     FOR ALL USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             WHERE w.id = worker_skills.worker_id 
--             AND w.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
--             AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'foreman')
--         )
--     );

-- Insert some sample skills categories for reference
INSERT INTO worker_skills (worker_id, skill_name, skill_category, proficiency_level, notes) VALUES
(NULL, 'OSHA 10 Hour', 'certification', 'expert', 'Sample skill - remove after testing'),
(NULL, 'Electrical Work', 'specialty', 'advanced', 'Sample skill - remove after testing'),
(NULL, 'Forklift Operation', 'equipment', 'intermediate', 'Sample skill - remove after testing'),
(NULL, 'AutoCAD', 'software', 'beginner', 'Sample skill - remove after testing')
ON CONFLICT DO NOTHING;

-- Clean up sample data (these will fail gracefully if constraints prevent insertion)
DELETE FROM worker_skills WHERE worker_id IS NULL;