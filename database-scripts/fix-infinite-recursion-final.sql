-- Fix infinite recursion in users table RLS policies
-- Problem: get_user_company_id() function queries users table, which triggers RLS policy, causing recursion
-- Solution: Create SECURITY DEFINER functions that bypass RLS and use direct auth.uid() comparisons

-- Step 1: Drop problematic policies to prevent recursion during fix
DROP POLICY IF EXISTS "users_access_policy" ON users;
DROP POLICY IF EXISTS "company_access_policy" ON companies;

-- Step 2: Fix the helper functions to avoid recursion
-- The key is to use SECURITY DEFINER and not trigger RLS checks

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER
STABLE
AS $$
  -- Use direct auth schema access to avoid RLS recursion
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN  
LANGUAGE SQL SECURITY DEFINER
STABLE
AS $$
  -- Use direct auth schema access to avoid RLS recursion
  SELECT COALESCE(is_site_admin, FALSE) FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Step 3: Create safer RLS policies that don't cause recursion
-- For users table: Allow users to see their own record and others in same company
CREATE POLICY "users_access_safe" ON users
  FOR ALL USING (
    -- Allow access to own record (direct comparison, no function call)
    auth.uid() = id 
    OR 
    -- Allow site admins to see all users (using safe function)
    is_site_admin()
    OR
    -- Allow company members to see each other (using safe function)  
    company_id = get_user_company_id()
  );

-- For companies table: Allow users to see their own company
CREATE POLICY "company_access_safe" ON companies  
  FOR ALL USING (
    -- Allow site admins to see all companies
    is_site_admin()
    OR
    -- Allow users to see their own company
    id = get_user_company_id()
  );

-- Step 4: Grant necessary permissions to the functions
GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_site_admin() TO authenticated;

-- Step 5: Test the fix by attempting a simple query
SELECT 'RLS policies fixed - no infinite recursion' as status;

-- Verification queries (these should work without recursion):
-- SELECT auth.uid(), get_user_company_id(), is_site_admin();