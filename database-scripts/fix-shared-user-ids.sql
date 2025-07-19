-- Fix Shared User IDs Problem
-- This script creates separate user accounts for workers that are sharing the same user_id
-- Run this in Supabase SQL Editor

-- Step 1: Identify workers sharing the same user_id
DO $$
DECLARE
    shared_user_id UUID := '397daecd-a8dc-4f03-ac4d-54e572d7bb64';
    worker_record RECORD;
    new_user_id UUID;
    worker_count INTEGER := 0;
BEGIN
    -- Count how many workers are sharing this user_id
    SELECT COUNT(*) INTO worker_count 
    FROM workers 
    WHERE user_id = shared_user_id;
    
    RAISE NOTICE '🔍 Found % workers sharing user_id: %', worker_count, shared_user_id;
    
    -- Loop through each worker (except the first one) and create new user accounts
    FOR worker_record IN 
        SELECT * FROM workers 
        WHERE user_id = shared_user_id 
        ORDER BY created_at 
        OFFSET 1  -- Skip the first worker (let it keep the original user)
    LOOP
        -- Generate new UUID for the new user
        new_user_id := uuid_generate_v4();
        
        RAISE NOTICE '📝 Creating new user for worker % (employee_id: %)', worker_record.id, worker_record.employee_id;
        
        -- Create new user record based on the original
        INSERT INTO users (id, email, full_name, role, company_id, created_at, updated_at)
        SELECT 
            new_user_id,
            'worker' || worker_record.employee_id || '@temp.local',  -- Temporary unique email
            'Worker ' || worker_record.employee_id,  -- Temporary unique name
            'worker',
            worker_record.company_id,
            NOW(),
            NOW()
        FROM users 
        WHERE id = shared_user_id;
        
        -- Update the worker to point to the new user
        UPDATE workers 
        SET user_id = new_user_id,
            updated_at = NOW()
        WHERE id = worker_record.id;
        
        RAISE NOTICE '✅ Created new user % for worker % (employee_id: %)', 
            new_user_id, worker_record.id, worker_record.employee_id;
    END LOOP;
    
    RAISE NOTICE '🎉 Fixed shared user_id issue. Each worker now has their own user account.';
    RAISE NOTICE '⚠️  Note: New workers have temporary emails like workerEMP000002@temp.local';
    RAISE NOTICE '📝 You should update these emails through the worker edit form to real emails.';
END $$;

-- Step 2: Verify the fix
SELECT 
    w.id as worker_id,
    w.employee_id,
    w.user_id,
    u.full_name,
    u.email,
    u.role
FROM workers w
LEFT JOIN users u ON u.id = w.user_id
WHERE w.company_id = '49bbd0d3-a52b-4168-ab37-1a18b447c8f8'
ORDER BY w.employee_id;