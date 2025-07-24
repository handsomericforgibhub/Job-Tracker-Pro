-- TEMPORARY: Disable RLS on job_stages for debugging
-- This is a temporary workaround to test if RLS is the only issue
-- DO NOT USE IN PRODUCTION - this disables security

-- =============================================
-- OPTION 1: TEMPORARILY DISABLE RLS (LESS SECURE)
-- =============================================

-- Uncomment this to temporarily disable RLS entirely
-- ALTER TABLE job_stages DISABLE ROW LEVEL SECURITY;

-- =============================================
-- OPTION 2: CREATE VERY PERMISSIVE POLICY (SAFER)
-- =============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view stages" ON job_stages;
DROP POLICY IF EXISTS "Enable read access for all users" ON job_stages;
DROP POLICY IF EXISTS "Enable insert for admins and owners" ON job_stages;
DROP POLICY IF EXISTS "Enable update for admins and owners" ON job_stages;
DROP POLICY IF EXISTS "Enable delete for admins and owners" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can create stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can update stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can delete stages" ON job_stages;

-- Create very permissive policies for debugging
CREATE POLICY "Temp allow all read" ON job_stages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Temp allow all insert" ON job_stages
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' 
    AND created_by = auth.uid()
  );

CREATE POLICY "Temp allow all update" ON job_stages
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Temp allow all delete" ON job_stages
  FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- TEST THE POLICIES
-- =============================================

-- Test current user context
SELECT 
  'Testing user context' as test,
  auth.uid() as user_id,
  auth.role() as auth_role,
  (SELECT role FROM users WHERE id = auth.uid()) as user_role,
  (SELECT email FROM users WHERE id = auth.uid()) as email;

-- Test if we can now insert
DO $$
BEGIN
  INSERT INTO job_stages (
    name, 
    description, 
    color, 
    sequence_order, 
    maps_to_status, 
    company_id, 
    created_by
  ) VALUES (
    'Debug Test Stage',
    'Debug Description', 
    '#FF6600', 
    8888, 
    'planning',
    (SELECT company_id FROM users WHERE id = auth.uid()),
    auth.uid()
  );
  
  RAISE NOTICE 'SUCCESS: Temporary RLS policies allow insert';
  
  -- Clean up test record
  DELETE FROM job_stages WHERE name = 'Debug Test Stage';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'STILL FAILING: %', SQLERRM;
END $$;

-- =============================================
-- VERIFY POLICIES
-- =============================================

SELECT 
  'Current policies after temp fix' as info,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'job_stages'
ORDER BY cmd;