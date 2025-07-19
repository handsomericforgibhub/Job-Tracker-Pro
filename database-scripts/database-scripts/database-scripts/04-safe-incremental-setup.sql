-- Safe Database Setup for JobTracker Pro
-- Run this in Supabase SQL Editor - handles existing objects safely

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add force_password_change field to users table (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

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

-- Add updated_at triggers for new tables (safely)
DO $$
BEGIN
    -- Employee ID sequence trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_employee_id_sequence_updated_at'
    ) THEN
        CREATE TRIGGER update_employee_id_sequence_updated_at 
        BEFORE UPDATE ON employee_id_sequence
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Password reset tokens trigger (no updated_at column)
    
    -- Worker licenses trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_worker_licenses_updated_at'
    ) THEN
        CREATE TRIGGER update_worker_licenses_updated_at 
        BEFORE UPDATE ON worker_licenses
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

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

-- Create trigger to auto-generate employee ID (safely)
DO $$
BEGIN
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

-- Function to clean up expired password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better performance (safely)
CREATE INDEX IF NOT EXISTS idx_employee_id_sequence_company_id ON employee_id_sequence(company_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_worker_id ON worker_licenses(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_expiry_date ON worker_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_worker_licenses_status ON worker_licenses(status);

-- Verify tables were created
DO $$
BEGIN
    -- Check if employee_id_sequence table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_id_sequence') THEN
        RAISE NOTICE '✅ employee_id_sequence table ready';
    ELSE
        RAISE EXCEPTION '❌ employee_id_sequence table creation failed';
    END IF;

    -- Check if password_reset_tokens table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_tokens') THEN
        RAISE NOTICE '✅ password_reset_tokens table ready';
    ELSE
        RAISE EXCEPTION '❌ password_reset_tokens table creation failed';
    END IF;

    -- Check if worker_licenses table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'worker_licenses') THEN
        RAISE NOTICE '✅ worker_licenses table ready';
    ELSE
        RAISE EXCEPTION '❌ worker_licenses table creation failed';
    END IF;

    -- Check if generate_employee_id function exists
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'generate_employee_id') THEN
        RAISE NOTICE '✅ generate_employee_id function ready';
    ELSE
        RAISE EXCEPTION '❌ generate_employee_id function creation failed';
    END IF;

    -- Check if trigger exists
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_generate_employee_id') THEN
        RAISE NOTICE '✅ auto_generate_employee_id trigger ready';
    ELSE
        RAISE EXCEPTION '❌ auto_generate_employee_id trigger creation failed';
    END IF;

    RAISE NOTICE '🎉 Database setup completed successfully!';
END $$;