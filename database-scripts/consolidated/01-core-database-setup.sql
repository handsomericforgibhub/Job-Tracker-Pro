-- ================================================
-- JobTracker Pro - Core Database Setup
-- ================================================
-- This script establishes the complete database schema 
-- for the multi-tenant JobTracker application
-- 
-- Order: 01
-- Dependencies: None
-- Description: Creates core tables, users, companies, RLS policies
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- 1. COMPANIES TABLE (Root of multi-tenancy)
-- ================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'basic',
  subscription_status TEXT DEFAULT 'trial',
  max_users INTEGER DEFAULT 10,
  max_jobs INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- Company indexes
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON companies(subscription_status);

-- Enable RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 2. USERS TABLE (Company-scoped users)
-- ================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'worker',
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_site_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_role CHECK (role IN ('site_admin', 'owner', 'admin', 'foreman', 'worker', 'client'))
);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 3. RLS HELPER FUNCTIONS
-- ================================================

-- Function to get current user's company ID
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$;

-- Function to check if user is site admin
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT COALESCE(is_site_admin, FALSE) FROM users WHERE id = auth.uid();
$$;

-- Function to check if user has access to a specific company
CREATE OR REPLACE FUNCTION has_company_access(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (company_id = target_company_id OR is_site_admin = TRUE)
  );
$$;

-- ================================================
-- 4. RLS POLICIES
-- ================================================

-- Companies RLS: Users can only see their own company (unless site admin)
CREATE POLICY "company_access_policy" ON companies
  FOR ALL USING (
    is_site_admin() OR 
    id = get_user_company_id()
  );

-- Users RLS: Users can only see users in their company (unless site admin)
CREATE POLICY "users_access_policy" ON users
  FOR ALL USING (
    is_site_admin() OR 
    company_id = get_user_company_id()
  );

-- ================================================
-- 5. USER PROFILE AUTO-CREATION TRIGGER
-- ================================================

-- Function to automatically create user profile from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile when a new auth user is created
  INSERT INTO public.users (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker'),
    (NEW.raw_user_meta_data->>'company_id')::UUID
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    company_id = EXCLUDED.company_id,
    updated_at = NOW()
  WHERE users.id = EXCLUDED.id;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- 6. AUDIT TABLES
-- ================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'))
);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs RLS policy
CREATE POLICY "audit_logs_access_policy" ON audit_logs
  FOR ALL USING (has_company_access(company_id));

-- ================================================
-- 7. UPDATED_AT TRIGGER FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

-- Insert migration record
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('01-core-database-setup', NOW())
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE companies IS 'Multi-tenant companies - root of all data isolation';
COMMENT ON TABLE users IS 'Company-scoped users with role-based access';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all data changes';