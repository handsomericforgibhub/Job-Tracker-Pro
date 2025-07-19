-- Add address-related columns to jobs table
-- Run this in Supabase SQL Editor

-- Add structured address data columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS address_components JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add comments for documentation
COMMENT ON COLUMN jobs.address_components IS 'Structured address data from geocoding API (street, city, state, etc.)';
COMMENT ON COLUMN jobs.latitude IS 'Latitude coordinate for the job location';
COMMENT ON COLUMN jobs.longitude IS 'Longitude coordinate for the job location';