-- Worker Applications and Assignment Sharing Schema
-- This script adds support for public worker onboarding and assignment sharing

-- Worker Applications Table
CREATE TABLE IF NOT EXISTS worker_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Personal Information
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    
    -- Work Information
    desired_hourly_rate NUMERIC(10,2),
    availability TEXT, -- JSON string for schedule availability
    work_experience TEXT,
    previous_employer VARCHAR(255),
    years_experience INTEGER,
    
    -- Skills and Certifications (JSON arrays)
    skills TEXT, -- JSON array of skills
    certifications TEXT, -- JSON array of certifications
    licenses TEXT, -- JSON array of licenses
    
    -- Documents
    resume_url TEXT,
    resume_filename VARCHAR(255),
    resume_size INTEGER,
    cover_letter TEXT,
    
    -- References
    reference1_name VARCHAR(255),
    reference1_phone VARCHAR(20),
    reference1_email VARCHAR(255),
    reference1_relationship VARCHAR(100),
    reference2_name VARCHAR(255),
    reference2_phone VARCHAR(20),
    reference2_email VARCHAR(255),
    reference2_relationship VARCHAR(100),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    
    -- Application Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    reviewer_notes TEXT,
    rejection_reason TEXT,
    
    -- Tracking
    source VARCHAR(100), -- How they found out about the position
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for worker applications
CREATE INDEX IF NOT EXISTS idx_worker_applications_company ON worker_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_worker_applications_status ON worker_applications(status);
CREATE INDEX IF NOT EXISTS idx_worker_applications_email ON worker_applications(email);
CREATE INDEX IF NOT EXISTS idx_worker_applications_applied_at ON worker_applications(applied_at);

-- Extend job_assignments table with sharing functionality
ALTER TABLE job_assignments 
ADD COLUMN IF NOT EXISTS share_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMP WITH TIME ZONE;

-- Assignment Access Log Table
CREATE TABLE IF NOT EXISTS assignment_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES job_assignments(id) ON DELETE CASCADE,
    share_token VARCHAR(255),
    accessed_by_worker_id UUID REFERENCES workers(id),
    access_type VARCHAR(20) DEFAULT 'view' CHECK (access_type IN ('view', 'download', 'update')),
    client_ip INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for assignment access logs
CREATE INDEX IF NOT EXISTS idx_assignment_access_logs_assignment ON assignment_access_logs(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_access_logs_token ON assignment_access_logs(share_token);
CREATE INDEX IF NOT EXISTS idx_assignment_access_logs_accessed_at ON assignment_access_logs(accessed_at);

-- Create trigger function for generating share tokens for assignments
CREATE OR REPLACE FUNCTION generate_assignment_share_token()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate token if is_public is set to true and no token exists
    IF NEW.is_public = TRUE AND (OLD.is_public IS NULL OR OLD.is_public = FALSE OR NEW.share_token IS NULL) THEN
        NEW.share_token := encode(gen_random_bytes(32), 'base64url');
        NEW.shared_at := NOW();
        
        -- Set default expiration to 30 days if not specified
        IF NEW.share_expires_at IS NULL THEN
            NEW.share_expires_at := NOW() + INTERVAL '30 days';
        END IF;
    END IF;
    
    -- Clear token if is_public is set to false
    IF NEW.is_public = FALSE THEN
        NEW.share_token := NULL;
        NEW.share_expires_at := NULL;
        NEW.shared_at := NULL;
        NEW.shared_by := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job_assignments share token generation
DROP TRIGGER IF EXISTS trigger_generate_assignment_share_token ON job_assignments;
CREATE TRIGGER trigger_generate_assignment_share_token
    BEFORE INSERT OR UPDATE ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION generate_assignment_share_token();

-- Update function for worker_applications updated_at
CREATE OR REPLACE FUNCTION update_worker_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for worker_applications updated_at
DROP TRIGGER IF EXISTS trigger_update_worker_applications_updated_at ON worker_applications;
CREATE TRIGGER trigger_update_worker_applications_updated_at
    BEFORE UPDATE ON worker_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_worker_applications_updated_at();

-- Create storage bucket for worker application documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-applications', 'worker-applications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for worker applications bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can upload application documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners and foremen can view application documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners and foremen can delete application documents" ON storage.objects;

-- Create new policies
CREATE POLICY "Anyone can upload application documents"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'worker-applications');

CREATE POLICY "Owners and foremen can view application documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'worker-applications' AND
    auth.uid() IN (
        SELECT u.id FROM users u 
        WHERE u.role IN ('owner', 'foreman')
    )
);

CREATE POLICY "Owners and foremen can delete application documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'worker-applications' AND
    auth.uid() IN (
        SELECT u.id FROM users u 
        WHERE u.role IN ('owner', 'foreman')
    )
);

-- Add indexes for sharing functionality
CREATE INDEX IF NOT EXISTS idx_job_assignments_share_token ON job_assignments(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_assignments_public ON job_assignments(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_assignments_expires ON job_assignments(share_expires_at) WHERE share_expires_at IS NOT NULL;

COMMENT ON TABLE worker_applications IS 'Public worker application system for onboarding new workers';
COMMENT ON TABLE assignment_access_logs IS 'Access logging for shared job assignments';
COMMENT ON COLUMN job_assignments.share_token IS 'Public sharing token for assignment access';
COMMENT ON COLUMN job_assignments.is_public IS 'Whether the assignment is publicly shareable';
COMMENT ON COLUMN job_assignments.share_expires_at IS 'Expiration date for public sharing';