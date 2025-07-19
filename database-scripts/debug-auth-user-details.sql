-- Debug script to check exactly how the site admin role is stored

-- Check the full auth.users record for this user
SELECT 
    id,
    email,
    raw_user_meta_data,
    raw_app_meta_data,
    user_metadata,
    app_metadata,
    created_at,
    updated_at
FROM auth.users 
WHERE id = 'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID;

-- Check if there's a separate admin/roles table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%admin%' OR table_name LIKE '%role%';

-- Check if the site admin is defined elsewhere
SELECT * FROM information_schema.tables WHERE table_name = 'site_admins';
SELECT * FROM information_schema.tables WHERE table_name = 'admin_users';