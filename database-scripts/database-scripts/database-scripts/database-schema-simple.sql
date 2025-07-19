-- JobTracker Pro Database Schema - Simple Version
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS daily_logs CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS worker_check_ins CASCADE;
DROP TABLE IF EXISTS job_assignments CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Create companies table first
CREATE TABLE companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table (references companies)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'foreman', 'worker')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')) DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(10,2),
  client_name TEXT,
  location TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (allowing all operations for now to get started)
CREATE POLICY "Enable read access for authenticated users" ON companies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON companies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON companies
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON users
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON jobs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON jobs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON jobs
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();