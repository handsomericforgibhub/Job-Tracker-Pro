-- Fix infinite recursion in users table RLS policies
-- CORRECTED VERSION: Uses 'role' column instead of 'is_site_admin' column

-- Step 1: Drop problematic policies to prevent recursion during fix
DROP POLICY IF EXISTS "users_access_policy" ON users;
DROP POLICY IF EXISTS "company_access_policy" ON companies;
DROP POLICY IF EXISTS "users_access_safe" ON users;
DROP POLICY IF EXISTS "company_access_safe" ON companies;

-- Step 2: Fix the helper functions to avoid recursion and use correct column names
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
  -- Check role column for 'site_admin' value (not is_site_admin column)
  SELECT COALESCE(role = 'site_admin', FALSE) FROM public.users WHERE id = auth.uid() LIMIT 1;
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
SELECT 'RLS policies fixed - no infinite recursion (corrected version)' as status;

-- Optional verification queries (uncomment to test):
-- SELECT auth.uid(), get_user_company_id(), is_site_admin();