-- Simplified debug script for standard Supabase auth schema

-- Check the auth.users record with only existing columns
SELECT 
    id,
    email,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at
FROM auth.users 
WHERE id = 'fc9d1c91-2a75-4350-8823-f6e13ad98af3'::UUID;