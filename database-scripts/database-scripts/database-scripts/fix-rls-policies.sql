-- Fix RLS Policies for Registration
-- Run this in your Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON users;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON companies;

-- New policies for users table
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- New policies for companies table
CREATE POLICY "Users can view all companies" ON companies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create companies" ON companies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Company owners can update their company" ON companies
  FOR UPDATE USING (
    id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() AND role = 'owner'
    )
  );