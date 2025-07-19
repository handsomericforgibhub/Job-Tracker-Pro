-- Debug script to check user and authentication issues

-- 1. Check if the user exists in the users table
SELECT 'User lookup:' as debug_step, id, email, role, company_id 
FROM users 
WHERE id = 'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID;

-- 2. Check all site_admin users
SELECT 'All site admins:' as debug_step, id, email, role, company_id 
FROM users 
WHERE role = 'site_admin';

-- 3. Check auth.users table (Supabase auth system)
SELECT 'Auth users:' as debug_step, id, email, raw_user_meta_data 
FROM auth.users 
WHERE id = 'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID;

-- 4. Check if there's a mismatch between auth.users and users table
SELECT 'Auth vs Users mismatch:' as debug_step, 
       a.id as auth_id, 
       a.email as auth_email,
       u.id as users_id,
       u.email as users_email,
       u.role
FROM auth.users a
LEFT JOIN users u ON a.id = u.id
WHERE a.id = 'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID;

-- 5. Check the job we're trying to update
SELECT 'Job details:' as debug_step, id, title, status, company_id, created_by, updated_by
FROM jobs 
WHERE id = 'cc854915-d69e-4c94-84a6-a7c22a0bcb43'::UUID;