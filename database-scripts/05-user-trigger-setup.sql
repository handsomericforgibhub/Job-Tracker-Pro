-- User Profile Auto-Creation Trigger
-- This ensures user profiles are automatically created when auth users sign up
-- Run this in Supabase SQL Editor after the main setup

-- Function to automatically create user profile from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile when a new auth user is created
  INSERT INTO public.users (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'worker'),
    (NEW.raw_user_meta_data->>'company_id')::UUID
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    role = COALESCE(EXCLUDED.role, users.role),
    company_id = COALESCE(EXCLUDED.company_id, users.company_id),
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table (if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify trigger was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE '✅ User auto-creation trigger installed';
    ELSE
        RAISE NOTICE '❌ User auto-creation trigger failed to install';
    END IF;
END $$;