-- Comprehensive RLS Debugging for job_stages
-- Run this step by step to identify the exact issue

-- =============================================
-- STEP 1: CHECK RLS STATUS AND POLICIES
-- =============================================

SELECT '=== STEP 1: RLS Status and Policies ===' as debug_step;

-- Check if RLS is enabled
SELECT 
  'RLS Status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'job_stages';

-- Check existing policies
SELECT 
  'Current Policies' as check_type,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'job_stages'
ORDER BY cmd, policyname;

-- =============================================
-- STEP 2: CHECK USER CONTEXT
-- =============================================

SELECT '=== STEP 2: User Context ===' as debug_step;

-- Check current authentication context
SELECT 
  'Auth Context' as check_type,
  auth.uid() as current_user_id,
  auth.role() as current_auth_role;

-- Check user profile
SELECT 
  'User Profile' as check_type,
  id,
  email,
  role,
  company_id,
  created_at
FROM users 
WHERE id = auth.uid();

-- =============================================
-- STEP 3: CHECK TABLE PERMISSIONS
-- =============================================

SELECT '=== STEP 3: Table Permissions ===' as debug_step;

-- Check table grants
SELECT 
  'Table Grants' as check_type,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'job_stages' 
AND grantee IN ('authenticated', 'anon', 'public', current_user);

-- =============================================
-- STEP 4: TEST INSERT COMPONENTS
-- =============================================

SELECT '=== STEP 4: Testing Insert Components ===' as debug_step;

-- Test if user lookup works
SELECT 
  'User Lookup Test' as check_type,
  auth.uid() as auth_uid,
  (SELECT id FROM users WHERE id = auth.uid()) as user_exists,
  (SELECT role FROM users WHERE id = auth.uid()) as user_role,
  (SELECT company_id FROM users WHERE id = auth.uid()) as user_company;

-- Test the exact values that would be inserted
SELECT 
  'Insert Values Test' as check_type,
  'Test Stage' as name,
  'Test Description' as description,
  '#FF0000' as color,
  999 as sequence_order,
  'planning' as maps_to_status,
  (SELECT company_id FROM users WHERE id = auth.uid()) as company_id,
  auth.uid() as created_by,
  'standard' as stage_type,
  1 as min_duration_hours,
  168 as max_duration_hours,
  false as requires_approval;

-- =============================================
-- STEP 5: MANUAL POLICY EVALUATION
-- =============================================

SELECT '=== STEP 5: Manual Policy Evaluation ===' as debug_step;

-- Check if user meets INSERT policy criteria
SELECT 
  'Policy Check - Auth Role' as check_type,
  auth.role() = 'authenticated' as is_authenticated;

SELECT 
  'Policy Check - User Role' as check_type,
  (SELECT role FROM users WHERE id = auth.uid()) as user_role,
  (SELECT role FROM users WHERE id = auth.uid()) IN ('site_admin', 'owner') as has_required_role;

SELECT 
  'Policy Check - Company Match' as check_type,
  (SELECT company_id FROM users WHERE id = auth.uid()) as user_company,
  (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin' as is_site_admin,
  true as company_id_null_allowed;

-- =============================================
-- STEP 6: ATTEMPT INSERT WITH EXPLICIT ROLLBACK
-- =============================================

SELECT '=== STEP 6: Testing Actual Insert ===' as debug_step;

-- Use a transaction that we can rollback
BEGIN;

-- Try to insert
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
  'Debug Test Stage ' || extract(epoch from now()),
  'Debug test description', 
  '#00FF00', 
  7777, 
  'planning',
  'standard',
  1,
  168,
  false,
  (SELECT company_id FROM users WHERE id = auth.uid()),
  auth.uid()
);

-- If we get here, the insert worked
SELECT 'SUCCESS: Insert completed without RLS violation' as result;

-- Always rollback to clean up
ROLLBACK;

-- Note: If there's an RLS violation, the transaction will fail before reaching the SELECT