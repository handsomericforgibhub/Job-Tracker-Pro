-- Debug User Context and RLS Issue
-- Run this to understand why RLS is still blocking

-- =============================================
-- 1. CHECK CURRENT USER CONTEXT
-- =============================================

SELECT 'Current user context:' as check_type,
       auth.uid() as user_id,
       auth.role() as auth_role;

-- =============================================
-- 2. CHECK USER PROFILE
-- =============================================

SELECT 'User profile from users table:' as check_type,
       id,
       email,
       role,
       company_id,
       created_at
FROM users 
WHERE id = auth.uid();

-- =============================================
-- 3. CHECK IF USER EXISTS IN auth.users
-- =============================================

SELECT 'User exists in auth.users:' as check_type,
       EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid()) as exists_in_auth_users;

-- =============================================
-- 4. CHECK CURRENT RLS POLICIES
-- =============================================

SELECT 'Current RLS policies:' as check_type,
       policyname,
       cmd,
       qual,
       with_check
FROM pg_policies 
WHERE tablename = 'job_stages'
ORDER BY cmd, policyname;

-- =============================================
-- 5. SIMULATE POLICY CONDITIONS
-- =============================================

-- Test the exact conditions from our INSERT policy
SELECT 'Policy condition tests:' as check_type,
       auth.uid() as current_user_id,
       auth.role() = 'authenticated' as is_authenticated,
       (SELECT role FROM users WHERE id = auth.uid()) as user_role_from_table,
       (SELECT role FROM users WHERE id = auth.uid()) IN ('site_admin', 'owner') as has_required_role,
       (SELECT company_id FROM users WHERE id = auth.uid()) as user_company_id;

-- =============================================
-- 6. TEST SPECIFIC VALUES BEING INSERTED
-- =============================================

-- Test with the exact values from the failed insert
SELECT 'Testing with actual insert values:' as check_type,
       'ae74ceb9-464e-4b28-8c6c-846d4305f9f7'::uuid as company_id_from_request,
       '99325438-9795-4c5a-b529-2813498a5b65'::uuid as created_by_from_request,
       auth.uid() = '99325438-9795-4c5a-b529-2813498a5b65'::uuid as created_by_matches_auth_uid,
       (SELECT company_id FROM users WHERE id = auth.uid()) = 'ae74ceb9-464e-4b28-8c6c-846d4305f9f7'::uuid as company_matches;

-- =============================================
-- 7. MANUAL POLICY EVALUATION
-- =============================================

-- Manually evaluate our INSERT policy logic
SELECT 'Manual policy evaluation:' as check_type,
       -- Basic auth check
       auth.role() = 'authenticated' as auth_check,
       -- created_by check
       auth.uid() = '99325438-9795-4c5a-b529-2813498a5b65'::uuid as created_by_check,
       -- Role check
       (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin' as is_site_admin,
       (SELECT role FROM users WHERE id = auth.uid()) = 'owner' as is_owner,
       -- Company check for owners
       ('ae74ceb9-464e-4b28-8c6c-846d4305f9f7'::uuid IS NULL) as company_is_null,
       ('ae74ceb9-464e-4b28-8c6c-846d4305f9f7'::uuid = (SELECT company_id FROM users WHERE id = auth.uid())) as company_matches_user;

-- =============================================
-- 8. FINAL DIAGNOSIS
-- =============================================

-- Put it all together
SELECT 'Final diagnosis:' as check_type,
       CASE 
         WHEN auth.uid() IS NULL THEN 'FAIL: No authenticated user'
         WHEN auth.role() != 'authenticated' THEN 'FAIL: Not authenticated role'
         WHEN auth.uid() != '99325438-9795-4c5a-b529-2813498a5b65'::uuid THEN 'FAIL: created_by does not match auth.uid()'
         WHEN (SELECT role FROM users WHERE id = auth.uid()) NOT IN ('site_admin', 'owner') THEN 'FAIL: User role not site_admin or owner'
         WHEN (SELECT role FROM users WHERE id = auth.uid()) = 'owner' AND 
              'ae74ceb9-464e-4b28-8c6c-846d4305f9f7'::uuid IS NOT NULL AND
              'ae74ceb9-464e-4b28-8c6c-846d4305f9f7'::uuid != (SELECT company_id FROM users WHERE id = auth.uid()) 
              THEN 'FAIL: Owner trying to create stage for different company'
         ELSE 'PASS: All policy conditions should be met'
       END as policy_result;