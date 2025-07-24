-- FINAL FIX: job_stages RLS Policy Issue
-- This should resolve the "violates row-level security policy" error
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. COMPLETE POLICY CLEANUP
-- =============================================

-- Drop ALL possible policy names that might exist
DROP POLICY IF EXISTS "Users can view stages" ON job_stages;
DROP POLICY IF EXISTS "Users can manage stages" ON job_stages;
DROP POLICY IF EXISTS "Site admins can manage all stages" ON job_stages;
DROP POLICY IF EXISTS "Owners can manage company stages" ON job_stages;
DROP POLICY IF EXISTS "Users can view company stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can create stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can update stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can delete stages" ON job_stages;
DROP POLICY IF EXISTS "Enable read access for all users" ON job_stages;
DROP POLICY IF EXISTS "Enable insert for admins and owners" ON job_stages;
DROP POLICY IF EXISTS "Enable update for admins and owners" ON job_stages;
DROP POLICY IF EXISTS "Enable delete for admins and owners" ON job_stages;
DROP POLICY IF EXISTS "Temp allow all read" ON job_stages;
DROP POLICY IF EXISTS "Temp allow all insert" ON job_stages;
DROP POLICY IF EXISTS "Temp allow all update" ON job_stages;
DROP POLICY IF EXISTS "Temp allow all delete" ON job_stages;

-- =============================================
-- 2. CREATE WORKING RLS POLICIES
-- =============================================

-- SELECT: All authenticated users can read stages
CREATE POLICY "job_stages_select_policy" ON job_stages
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- INSERT: Allow authenticated users with proper role to insert
CREATE POLICY "job_stages_insert_policy" ON job_stages
  FOR INSERT 
  WITH CHECK (
    -- Must be authenticated
    auth.role() = 'authenticated'
    AND
    -- Must have created_by set to current user
    created_by = auth.uid()
    AND
    -- Must be site_admin OR owner with matching company
    (
      -- Site admins can create any stages
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR
      -- Owners can create stages for their company or global stages
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
        AND
        (
          company_id IS NULL 
          OR 
          company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

-- UPDATE: Allow authenticated users with proper role to update
CREATE POLICY "job_stages_update_policy" ON job_stages
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
        AND
        (
          company_id IS NULL 
          OR 
          company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
        AND
        (
          company_id IS NULL 
          OR 
          company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

-- DELETE: Allow authenticated users with proper role to delete
CREATE POLICY "job_stages_delete_policy" ON job_stages
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
        AND
        (
          company_id IS NULL 
          OR 
          company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        )
      )
    )
  );

-- =============================================
-- 3. VERIFY SETUP
-- =============================================

-- Check that RLS is enabled
SELECT 
  'RLS Status Check' as verification,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'job_stages';

-- Check that policies were created
SELECT 
  'Policy Creation Check' as verification,
  policyname,
  cmd,
  with_check IS NOT NULL as has_with_check
FROM pg_policies 
WHERE tablename = 'job_stages'
ORDER BY cmd, policyname;

-- Check current user context
SELECT 
  'User Context Check' as verification,
  auth.uid() as user_id,
  auth.role() as auth_role,
  (SELECT role FROM users WHERE id = auth.uid()) as user_role,
  (SELECT company_id FROM users WHERE id = auth.uid()) as company_id,
  (SELECT email FROM users WHERE id = auth.uid()) as email;

-- =============================================
-- 4. TEST INSERT
-- =============================================

-- Test the insert in a transaction we can rollback
DO $$
DECLARE
  test_id UUID;
BEGIN
  -- Try to insert a test stage
  INSERT INTO job_stages (
    name, 
    description, 
    color, 
    sequence_order, 
    maps_to_status, 
    stage_type,
    min_duration_hours,
    max_duration_hours,
    requires_approval,
    company_id, 
    created_by
  ) VALUES (
    'RLS Test Stage ' || extract(epoch from now()),
    'Test stage for RLS verification', 
    '#00AA00', 
    6666, 
    'planning',
    'standard',
    1,
    168,
    false,
    (SELECT company_id FROM users WHERE id = auth.uid()),
    auth.uid()
  ) RETURNING id INTO test_id;
  
  -- If we get here, insert worked
  RAISE NOTICE 'SUCCESS: RLS policies allow insert. Test stage ID: %', test_id;
  
  -- Clean up the test record
  DELETE FROM job_stages WHERE id = test_id;
  RAISE NOTICE 'Test cleanup completed';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: Insert still blocked - %', SQLERRM;
    RAISE NOTICE 'SQL State: %', SQLSTATE;
END $$;

-- =============================================
-- 5. FINAL STATUS
-- =============================================

SELECT 
  'Final Status' as status,
  'job_stages RLS policies have been reset and configured' as message,
  'Try the stage creation API again' as next_step;