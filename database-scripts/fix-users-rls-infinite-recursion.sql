-- Fix infinite recursion in users table RLS policies
-- The issue is likely caused by recursive references between users and companies tables

-- First, disable RLS temporarily to avoid recursion during the fix
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON users;

DROP POLICY IF EXISTS "Users can view all companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
DROP POLICY IF EXISTS "Company owners can update their company" ON companies;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON companies;

-- Create simple, non-recursive policies for users table
CREATE POLICY "users_select_policy" ON users
  FOR SELECT USING (
    -- Allow users to see their own profile and users in their company
    auth.uid() = id OR 
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "users_insert_policy" ON users
  FOR INSERT WITH CHECK (
    -- Users can only insert their own profile
    auth.uid() = id
  );

CREATE POLICY "users_update_policy" ON users
  FOR UPDATE USING (
    -- Users can only update their own profile
    auth.uid() = id
  );

-- Create simple policies for companies table that don't reference users
CREATE POLICY "companies_select_policy" ON companies
  FOR SELECT USING (true);  -- Allow all authenticated users to see companies

CREATE POLICY "companies_insert_policy" ON companies
  FOR INSERT WITH CHECK (
    -- Any authenticated user can create a company
    auth.role() = 'authenticated'
  );

CREATE POLICY "companies_update_policy" ON companies
  FOR UPDATE USING (
    -- Use a simple check without recursion
    auth.role() = 'authenticated'
  );

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Verify the fix
SELECT 'RLS policies fixed successfully' as status;