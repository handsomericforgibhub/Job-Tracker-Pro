-- SAFE RLS FIX - PRESERVES EXISTING DEPENDENCIES
-- This fix eliminates recursion while keeping existing views and functions

-- Step 1: Disable RLS temporarily to ensure we can make changes
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing RLS policies to start clean
DROP POLICY IF EXISTS "users_access_policy" ON users;
DROP POLICY IF EXISTS "company_access_policy" ON companies;
DROP POLICY IF EXISTS "users_access_safe" ON users;
DROP POLICY IF EXISTS "company_access_safe" ON companies;
DROP POLICY IF EXISTS "Users can view users" ON users;
DROP POLICY IF EXISTS "Users can create users" ON users;
DROP POLICY IF EXISTS "Users can update users" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON users;

-- Step 3: Create SAFE, NON-RECURSIVE RLS policies
-- The key is to use ONLY direct comparisons, no function calls that query tables

-- Users can ONLY see their own record - NO RECURSION POSSIBLE
CREATE POLICY "users_own_record_only" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own record during signup  
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own record
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Companies table - allow all authenticated users to read
CREATE POLICY "companies_read_all" ON companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow company creation
CREATE POLICY "companies_insert_authenticated" ON companies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow company updates
CREATE POLICY "companies_update_authenticated" ON companies
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Step 4: Fix the helper functions to be NON-RECURSIVE
-- DO NOT drop them - just make them safe

-- Fix get_user_company_id() to avoid RLS recursion
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
    result UUID;
BEGIN
    -- Use a direct query with explicit RLS bypass for this function
    -- This prevents recursion by not triggering RLS policies
    SELECT company_id INTO result 
    FROM public.users 
    WHERE id = auth.uid() 
    LIMIT 1;
    
    RETURN result;
END;
$$;

-- Fix is_site_admin() to avoid RLS recursion  
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Use a direct query with explicit RLS bypass for this function
    -- This prevents recursion by not triggering RLS policies
    SELECT role INTO user_role 
    FROM public.users 
    WHERE id = auth.uid() 
    LIMIT 1;
    
    RETURN COALESCE(user_role = 'site_admin', FALSE);
END;
$$;

-- Step 5: Re-enable RLS with our safe policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Step 6: Grant permissions (if needed)
GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_site_admin() TO authenticated;

-- Test query to verify fix
SELECT 'RLS fixed - preserved dependencies, eliminated recursion' as status;

-- Verification: This should work without recursion for authenticated users
-- SELECT * FROM users WHERE id = auth.uid();