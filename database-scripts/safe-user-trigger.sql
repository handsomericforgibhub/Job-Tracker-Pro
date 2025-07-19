-- Safe User Profile Creation Trigger
-- This completely replaces the problematic trigger with a safe version
-- Run this in Supabase SQL Editor

-- Drop the existing problematic trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a much safer function that only inserts, never updates
CREATE OR REPLACE FUNCTION public.handle_new_user_safe()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if the user doesn't already exist
  -- This prevents any UPDATE operations that could affect multiple records
  INSERT INTO public.users (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker'),
    (NEW.raw_user_meta_data->>'company_id')::UUID
  )
  ON CONFLICT (id) DO NOTHING;  -- CRITICAL: Do nothing on conflict, don't update
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new safe trigger
CREATE TRIGGER on_auth_user_created_safe
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_safe();

-- Test the trigger exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created_safe'
    ) THEN
        RAISE NOTICE '✅ Safe user creation trigger installed';
    ELSE
        RAISE NOTICE '❌ Safe user creation trigger failed to install';
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '🔧 Safe user trigger installed - this only creates new users, never updates existing ones';
    RAISE NOTICE '📝 Existing user data should now be safe from corruption';
    RAISE NOTICE '⚠️ Test worker editing carefully and check console logs for debugging info';
END $$;