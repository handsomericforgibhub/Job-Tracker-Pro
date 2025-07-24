-- Check Current RLS Policies on job_stages
-- Run this in Supabase SQL Editor to see what policies exist

-- =============================================
-- 1. CHECK CURRENT RLS POLICIES
-- =============================================

SELECT 
  'Current RLS policies on job_stages' as info,
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
-- 2. CHECK RLS STATUS
-- =============================================

SELECT 
  'RLS status' as info,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'job_stages';

-- =============================================
-- 3. CHECK TABLE STRUCTURE
-- =============================================

SELECT 
  'job_stages table structure' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'job_stages'
ORDER BY ordinal_position;

-- =============================================
-- 4. CHECK CURRENT USER CONTEXT
-- =============================================

SELECT 
  'Current user context' as info,
  auth.uid() as user_id,
  auth.role() as auth_role,
  (SELECT role FROM users WHERE id = auth.uid()) as user_role,
  (SELECT company_id FROM users WHERE id = auth.uid()) as user_company_id,
  (SELECT email FROM users WHERE id = auth.uid()) as user_email;

-- =============================================
-- 5. SIMULATE INSERT TO SEE WHAT FAILS
-- =============================================

-- Test what would happen with a real insert
BEGIN;

-- Try inserting a test stage
INSERT INTO job_stages (
  name, 
  description, 
  color, 
  sequence_order, 
  maps_to_status, 
  company_id, 
  created_by
) VALUES (
  'Test Stage RLS',
  'Test Description', 
  '#FF0000', 
  999, 
  'planning',
  (SELECT company_id FROM users WHERE id = auth.uid()),
  auth.uid()
);

-- Rollback to not actually insert
ROLLBACK;

-- If the above fails, the error will show what's wrong with RLS policy