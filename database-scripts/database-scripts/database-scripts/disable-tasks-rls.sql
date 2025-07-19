-- Temporarily disable RLS for tasks table during development
-- Run this in Supabase SQL Editor

-- Disable RLS on tasks table temporarily
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Company members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Owners and foremen can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Workers can update their assigned tasks" ON tasks;