-- Debug User Permissions and RLS Context
-- Run this in Supabase SQL Editor to understand current user context

-- =============================================
-- 1. CHECK CURRENT AUTH CONTEXT
-- =============================================

SELECT 
  'Current auth context' as info,
  auth.uid() as current_user_id,
  auth.role() as current_auth_role;

-- =============================================
-- 2. CHECK USER PROFILE DATA
-- =============================================

SELECT 
  'User profile data' as info,
  id,
  email,
  role,
  company_id,
  created_at
FROM users 
WHERE id = auth.uid();

-- =============================================
-- 3. CHECK COMPANY MEMBERSHIP
-- =============================================

SELECT 
  'Company membership' as info,
  c.id as company_id,
  c.name as company_name,
  u.role as user_role
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.id = auth.uid();

-- =============================================
-- 4. CHECK CURRENT RLS POLICIES ON JOB_STAGES
-- =============================================

SELECT 
  'Current RLS policies' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'job_stages';

-- =============================================
-- 5. TEST STAGE VISIBILITY
-- =============================================

SELECT 
  'Stages visible to current user' as info,
  id,
  name,
  company_id,
  sequence_order,
  created_by
FROM job_stages
ORDER BY sequence_order;

-- =============================================
-- 6. TEST INSERT PERMISSION (DRY RUN)
-- =============================================

-- This will show you what would happen if you tried to insert
EXPLAIN (ANALYZE, BUFFERS) 
INSERT INTO job_stages (
  name, 
  description, 
  color, 
  sequence_order, 
  maps_to_status, 
  company_id, 
  created_by
) VALUES (
  'Test Stage',
  'Test Description', 
  '#FF0000', 
  999, 
  'planning',
  (SELECT company_id FROM users WHERE id = auth.uid()),
  auth.uid()
);

-- Note: The above EXPLAIN will show the execution plan but won't actually insert