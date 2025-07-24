-- Simple RLS Policy Fix for job_stages
-- This fixes the "violates row-level security policy" error
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. REMOVE ALL EXISTING POLICIES
-- =============================================

-- Drop all existing policies on job_stages
DROP POLICY IF EXISTS "Users can view stages" ON job_stages;
DROP POLICY IF EXISTS "Users can manage stages" ON job_stages;
DROP POLICY IF EXISTS "Site admins can manage all stages" ON job_stages;
DROP POLICY IF EXISTS "Owners can manage company stages" ON job_stages;
DROP POLICY IF EXISTS "Users can view company stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can create stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can update stages" ON job_stages;
DROP POLICY IF EXISTS "Authorized users can delete stages" ON job_stages;

-- =============================================
-- 2. CREATE SIMPLE BUT SECURE POLICIES
-- =============================================

-- SELECT: Allow all authenticated users to view stages
CREATE POLICY "Enable read access for all users" ON job_stages
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: Allow site_admin and owner roles to insert stages
CREATE POLICY "Enable insert for admins and owners" ON job_stages
  FOR INSERT WITH CHECK (
    -- Must be authenticated
    auth.role() = 'authenticated' 
    AND
    -- Must have admin or owner role
    (
      (SELECT role FROM users WHERE id = auth.uid()) IN ('site_admin', 'owner')
    )
    AND
    -- created_by must match current user
    created_by = auth.uid()
    AND
    -- For owners: if company_id is set, it must match their company
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR 
      company_id IS NULL
      OR 
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- UPDATE: Allow site_admin and owner roles to update stages
CREATE POLICY "Enable update for admins and owners" ON job_stages
  FOR UPDATE USING (
    auth.role() = 'authenticated' 
    AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('site_admin', 'owner')
    AND
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR 
      company_id IS NULL
      OR 
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
  ) WITH CHECK (
    auth.role() = 'authenticated' 
    AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('site_admin', 'owner')
    AND
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR 
      company_id IS NULL
      OR 
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- DELETE: Allow site_admin and owner roles to delete stages
CREATE POLICY "Enable delete for admins and owners" ON job_stages
  FOR DELETE USING (
    auth.role() = 'authenticated' 
    AND
    (SELECT role FROM users WHERE id = auth.uid()) IN ('site_admin', 'owner')
    AND
    (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR 
      company_id IS NULL
      OR 
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- =============================================
-- 3. VERIFY POLICIES WERE CREATED
-- =============================================

-- Check that policies exist
SELECT 
  'Verification: RLS policies created' as status,
  policyname,
  cmd,
  with_check IS NOT NULL as has_with_check
FROM pg_policies 
WHERE tablename = 'job_stages'
ORDER BY cmd, policyname;

-- =============================================
-- 4. TEST INSERT (WILL ROLLBACK)
-- =============================================

-- Test the insert with current user
DO $$
BEGIN
  -- Test insert
  INSERT INTO job_stages (
    name, 
    description, 
    color, 
    sequence_order, 
    maps_to_status, 
    company_id, 
    created_by
  ) VALUES (
    'RLS Test Stage',
    'Test Description', 
    '#00FF00', 
    9999, 
    'planning',
    (SELECT company_id FROM users WHERE id = auth.uid()),
    auth.uid()
  );
  
  -- Delete the test record
  DELETE FROM job_stages WHERE name = 'RLS Test Stage';
  
  RAISE NOTICE 'SUCCESS: RLS policies allow insert/delete for current user';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: RLS policies still blocking: %', SQLERRM;
END $$;