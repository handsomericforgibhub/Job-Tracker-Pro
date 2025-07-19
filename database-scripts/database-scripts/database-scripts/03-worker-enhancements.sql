-- Worker Management Enhancements Database Schema
-- Run this in Supabase SQL Editor

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

-- Add force_password_change field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- Add updated_at triggers for new tables
CREATE TRIGGER update_employee_id_sequence_updated_at BEFORE UPDATE ON employee_id_sequence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_licenses_updated_at BEFORE UPDATE ON worker_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_id_sequence_company_id ON employee_id_sequence(company_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_worker_id ON worker_licenses(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_expiry_date ON worker_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_status ON worker_licenses(status);

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

-- Insert common Australian license types as reference data
INSERT INTO worker_licenses (worker_id, license_type, status, notes) VALUES
(NULL, 'Driver License', 'active', 'Sample license type - remove after testing'),
(NULL, 'Working with Children Check', 'active', 'Sample license type - remove after testing'),
(NULL, 'White Card (Construction)', 'active', 'Sample license type - remove after testing'),
(NULL, 'Forklift License', 'active', 'Sample license type - remove after testing'),
(NULL, 'Crane Operator License', 'active', 'Sample license type - remove after testing'),
(NULL, 'Electrical License', 'active', 'Sample license type - remove after testing'),
(NULL, 'Plumbing License', 'active', 'Sample license type - remove after testing'),
(NULL, 'First Aid Certificate', 'active', 'Sample license type - remove after testing')
ON CONFLICT DO NOTHING;

-- Clean up sample data (these will fail gracefully if constraints prevent insertion)
DELETE FROM worker_licenses WHERE worker_id IS NULL;

-- RLS Policies (temporarily disabled for development)
-- Uncomment when ready to enable RLS

-- ALTER TABLE employee_id_sequence ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE worker_licenses ENABLE ROW LEVEL SECURITY;

-- Employee ID sequence policies
-- CREATE POLICY "Company owners can manage employee sequences" ON employee_id_sequence
--     FOR ALL USING (
--         company_id = (SELECT company_id FROM users WHERE id = auth.uid()) AND
--         (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
--     );

-- Password reset tokens policies
-- CREATE POLICY "Owners and foremen can manage password resets" ON password_reset_tokens
--     FOR ALL USING (
--         EXISTS (
--             SELECT 1 FROM users u 
--             WHERE u.id = auth.uid() 
--             AND u.role IN ('owner', 'foreman')
--             AND u.company_id = (SELECT company_id FROM users WHERE id = password_reset_tokens.user_id)
--         )
--     );

-- Worker licenses policies
-- CREATE POLICY "Company members can view worker licenses" ON worker_licenses
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             JOIN users u ON w.user_id = u.id
--             WHERE w.id = worker_licenses.worker_id 
--             AND u.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
--         )
--     );

-- CREATE POLICY "Owners and foremen can manage worker licenses" ON worker_licenses
--     FOR ALL USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             JOIN users u ON w.user_id = u.id
--             WHERE w.id = worker_licenses.worker_id 
--             AND u.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
--             AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'foreman')
--         )
--     );

-- CREATE POLICY "Workers can view their own licenses" ON worker_licenses
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM workers w 
--             WHERE w.id = worker_licenses.worker_id 
--             AND w.user_id = auth.uid()
--         )
--     );