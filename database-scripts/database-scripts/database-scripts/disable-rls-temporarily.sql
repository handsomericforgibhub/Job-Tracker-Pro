-- Temporarily disable RLS to get authentication working
-- Run this in your Supabase SQL Editor

-- Disable RLS on all tables temporarily
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view all companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;
DROP POLICY IF EXISTS "Company owners can update their company" ON companies;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON jobs;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON jobs;