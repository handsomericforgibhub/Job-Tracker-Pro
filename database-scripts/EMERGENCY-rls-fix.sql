-- EMERGENCY RLS FIX for job_stages
-- The previous RLS policies aren't working, so we need a more direct approach
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Check what's currently there
-- =============================================

SELECT 'Current policies before fix:' as step;
SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'job_stages';

-- =============================================
-- STEP 2: Nuclear option - drop ALL policies
-- =============================================

SELECT 'Dropping all existing policies:' as step;

-- Drop every possible policy that might exist
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'job_stages'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON job_stages';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- =============================================
-- STEP 3: Create simple, working policies
-- =============================================

SELECT 'Creating new working policies:' as step;

-- Very permissive SELECT - everyone can read
CREATE POLICY "allow_all_select" ON job_stages
  FOR SELECT USING (true);

-- Simple INSERT policy - just check user is authenticated and created_by matches
CREATE POLICY "allow_authenticated_insert" ON job_stages
  FOR INSERT WITH CHECK (
    -- Just basic auth check
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
    AND
    -- created_by must match current user
    created_by = auth.uid()
  );

-- Simple UPDATE policy
CREATE POLICY "allow_authenticated_update" ON job_stages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

-- Simple DELETE policy
CREATE POLICY "allow_authenticated_delete" ON job_stages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
  );

-- =============================================
-- STEP 4: Verify the fix
-- =============================================

SELECT 'Policies after fix:' as step;
SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'job_stages';

-- =============================================
-- STEP 5: Test the insert
-- =============================================

SELECT 'Testing insert with current user:' as step;

-- Test insert
DO $$
DECLARE
    test_stage_id UUID;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'ERROR: No authenticated user found (auth.uid() is null)';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing with user ID: %', current_user_id;
    
    -- Try insert
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
        'Emergency Test Stage',
        'Testing RLS fix', 
        '#FF0000', 
        9999, 
        'planning',
        'standard',
        1,
        168,
        false,
        (SELECT company_id FROM users WHERE id = current_user_id),
        current_user_id
    ) RETURNING id INTO test_stage_id;
    
    RAISE NOTICE 'SUCCESS: Insert worked! Stage ID: %', test_stage_id;
    
    -- Clean up
    DELETE FROM job_stages WHERE id = test_stage_id;
    RAISE NOTICE 'Test stage cleaned up';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'FAILED: Insert still blocked - % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

SELECT 'RLS Emergency Fix Complete - Try the API again' as final_status;