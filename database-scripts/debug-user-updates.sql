-- Debug User Update Issues
-- Run this to identify and fix user update problems

-- First, let's check the current trigger
SELECT 
    tgname as trigger_name,
    tgtype,
    tgenabled,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Check if there are any other problematic triggers on users table
SELECT 
    t.tgname as trigger_name,
    t.tgtype,
    t.tgenabled,
    c.relname as table_name,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'users'
  AND t.tgname != 'update_users_updated_at';

-- Let's also check for any RLS policies that might be causing issues
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users';

-- Check if RLS is enabled on users table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';

-- Sample query to test user updates (replace with actual user_id)
-- UPDATE users SET full_name = 'Test Update' WHERE id = 'specific-user-id-here';
-- SELECT id, full_name, updated_at FROM users ORDER BY updated_at DESC LIMIT 5;

-- To temporarily disable the problematic trigger if needed:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DO $$
BEGIN
    RAISE NOTICE '🔍 User update debug information collected';
    RAISE NOTICE 'Check the results above for any problematic triggers or policies';
    RAISE NOTICE 'If you see any suspicious triggers, we may need to drop them temporarily';
END $$;